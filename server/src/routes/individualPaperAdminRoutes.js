const router = require('express').Router()
const fs = require('fs')
const { authenticate, authorize } = require('../middleware/auth')
const { upload, withUploadCleanup, isPdf, resolveStoredPaper } = require('../middleware/studentPaperFiles')
const { eligibleStudentIds, hasApprovedEnrollment } = require('../middleware/studentPaperEligibility')
const { IndividualStudentPaper, StudentPaperCategory, Enrollment, Payment, StudentProfile } = require('../models/AcademicContent')
const User = require('../models/User')
const { AuditLog } = require('../models/AcademicContent')

router.use(authenticate, authorize('admin'))

router.get('/students', async (req, res, next) => {
  try {
    const filter = { role: 'student' }
    if (req.query.search) {
      const escaped = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      filter.$or = [{ name: new RegExp(escaped, 'i') }, { email: new RegExp(escaped, 'i') }, { studentId: new RegExp(escaped, 'i') }]
    }
    const students = await User.find(filter).select('studentId name email active').sort('name').lean()
    const ids = students.map(student => student._id)
    const [enrollments, profiles, latestPayments, eligibleIds] = await Promise.all([
      Enrollment.find({ student: { $in: ids } }).populate({ path: 'batch', select: 'name year', populate: { path: 'year', select: 'year' } }).sort('-createdAt').lean(),
      StudentProfile.find({ user: { $in: ids } }).populate({ path: 'batches', select: 'name year', populate: { path: 'year', select: 'year' } }).lean(),
      Payment.find({ student: { $in: ids } }).sort({ date: -1, createdAt: -1 }).select('student status').lean(),
      eligibleStudentIds(ids),
    ])
    const enrollmentByStudent = new Map()
    for (const enrollment of enrollments) {
      const id = String(enrollment.student)
      if (!enrollmentByStudent.has(id)) enrollmentByStudent.set(id, [])
      enrollmentByStudent.get(id).push(enrollment)
    }
    const profileByStudent = new Map(profiles.map(profile => [String(profile.user), profile]))
    const latestPaymentByStudent = new Map()
    for (const payment of latestPayments) if (!latestPaymentByStudent.has(String(payment.student))) latestPaymentByStudent.set(String(payment.student), payment.status)
    res.json({ items: students.map(student => {
      const studentEnrollments = enrollmentByStudent.get(String(student._id)) || []
      const batchById = new Map()
      for (const enrollment of studentEnrollments) if (enrollment.batch) batchById.set(String(enrollment.batch._id), enrollment.batch)
      for (const batch of profileByStudent.get(String(student._id))?.batches || []) if (batch) batchById.set(String(batch._id), batch)
      const approved = student.active && eligibleIds.has(String(student._id))
      return {
        id: String(student._id), studentId: student.studentId, name: student.name, email: student.email,
        active: student.active, batches: [...batchById.values()], paymentStatus: approved ? 'paid' : latestPaymentByStudent.get(String(student._id)) || 'none', eligible: Boolean(approved),
      }
    }) })
  } catch (error) { next(error) }
})

router.get('/student/:studentId', async (req, res, next) => {
  try {
    const student = await User.findOne({ _id: req.params.studentId, role: 'student' }).select('name email studentId')
    if (!student) return res.status(404).json({ message: 'Student not found' })
    const [categories, items] = await Promise.all([
      StudentPaperCategory.find({ student: student._id }).sort('createdAt').lean(),
      IndividualStudentPaper.find({ student: student._id }).sort({ uploadDate: -1, createdAt: -1 }).lean(),
    ])
    const categoriesWithPapers = categories.map(category => ({ ...category, papers: items.filter(item => String(item.category) === String(category._id)) }))
    res.json({ student, categories: categoriesWithPapers, items })
  } catch (error) { next(error) }
})

router.post('/categories', async (req, res, next) => {
  try {
    const { studentId, name } = req.body
    if (!studentId || !String(name || '').trim()) return res.status(400).json({ message: 'Choose a student and enter a category name' })
    const student = await User.findOne({ _id: studentId, role: 'student', active: true }).select('_id name')
    if (!student) return res.status(404).json({ message: 'Active student account not found' })
    if (!await hasApprovedEnrollment(student._id)) return res.status(403).json({ message: 'An active enrollment with an approved payment is required before assigning categories' })
    const category = await StudentPaperCategory.create({ student: student._id, studentName: student.name, name: String(name).trim() })
    await AuditLog.create({ actor: req.user._id, action: 'student_paper_category_created', entity: 'StudentPaperCategory', entityId: String(category._id), details: { student: String(student._id), name: category.name } }).catch(() => {})
    res.status(201).json(category)
  } catch (error) { next(error) }
})

router.patch('/categories/:categoryId', async (req, res, next) => {
  try {
    const name = String(req.body.name || '').trim()
    if (!name) return res.status(400).json({ message: 'Enter a category name' })
    const category = await StudentPaperCategory.findByIdAndUpdate(req.params.categoryId, { $set: { name } }, { new: true, runValidators: true })
    if (!category) return res.status(404).json({ message: 'Paper category not found' })
    res.json(category)
  } catch (error) { next(error) }
})

router.delete('/categories/:categoryId', async (req, res, next) => {
  try {
    const category = await StudentPaperCategory.findByIdAndDelete(req.params.categoryId)
    if (!category) return res.status(404).json({ message: 'Paper category not found' })
    const papers = await IndividualStudentPaper.find({ student: category.student, category: category._id }).select('pdfFile')
    await IndividualStudentPaper.deleteMany({ student: category.student, category: category._id })
    await Promise.all(papers.map(paper => { const filePath = resolveStoredPaper(paper.pdfFile); return filePath ? fs.promises.unlink(filePath).catch(() => {}) : Promise.resolve() }))
    res.status(204).end()
  } catch (error) { next(error) }
})

router.post('/categories/:categoryId/papers', withUploadCleanup(upload.array('pdfs', 10)), async (req, res, next) => {
  try {
    const files = req.files || []
    if (!files.length) return res.status(400).json({ message: 'Choose one or more PDF files (up to 10 files, 30 MB each)' })
    for (const file of files) {
      if (!await isPdf(file.path)) {
        await Promise.all(files.map(item => fs.promises.unlink(item.path).catch(() => {})))
        return res.status(400).json({ message: 'One or more selected files are not valid PDFs' })
      }
    }
    const category = await StudentPaperCategory.findById(req.params.categoryId)
    if (!category) {
      await Promise.all(files.map(item => fs.promises.unlink(item.path).catch(() => {})))
      return res.status(404).json({ message: 'Paper category not found' })
    }
    if (!await hasApprovedEnrollment(category.student)) {
      await Promise.all(files.map(item => fs.promises.unlink(item.path).catch(() => {})))
      return res.status(403).json({ message: 'An active enrollment with an approved payment is required before uploading papers' })
    }
    const uploadDate = req.body.uploadDate ? new Date(`${req.body.uploadDate}T00:00:00.000Z`) : new Date()
    if (Number.isNaN(uploadDate.getTime()) || uploadDate > new Date(Date.now() + 86400000)) {
      await Promise.all(files.map(item => fs.promises.unlink(item.path).catch(() => {})))
      return res.status(400).json({ message: 'Choose a valid upload date' })
    }
    const papers = await IndividualStudentPaper.create(files.map(file => ({
      student: category.student, category: category._id,
      title: String(req.body.title || file.originalname.replace(/\.pdf$/i, '')).trim().slice(0, 180),
      subject: String(req.body.subject || '').trim(), description: String(req.body.description || '').trim().slice(0, 2000),
      pdfFile: file.filename, pdfName: file.originalname.slice(0, 255), uploadDate,
    })))
    await AuditLog.create({ actor: req.user._id, action: 'student_paper_category_files_uploaded', entity: 'StudentPaperCategory', entityId: String(category._id), details: { student: String(category.student), files: papers.length } }).catch(() => {})
    res.status(201).json({ items: papers })
  } catch (error) {
    await IndividualStudentPaper.deleteMany({ pdfFile: { $in: (req.files || []).map(file => file.filename) } }).catch(() => {})
    await Promise.all((req.files || []).map(file => fs.promises.unlink(file.path).catch(() => {})))
    next(error)
  }
})

router.post('/upload', withUploadCleanup(upload.single('pdf')), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose a PDF file no larger than 30 MB' })
    if (!await isPdf(req.file.path)) {
      await fs.promises.unlink(req.file.path).catch(() => {})
      return res.status(400).json({ message: 'The selected file is not a valid PDF' })
    }
    const { studentId, title, subject, description = '', uploadDate } = req.body
    if (!studentId || !String(title || '').trim() || !String(subject || '').trim()) {
      await fs.promises.unlink(req.file.path).catch(() => {})
      return res.status(400).json({ message: 'Student, paper title, and subject are required' })
    }
    const student = await User.findOne({ _id: studentId, role: 'student', active: true }).select('_id')
    if (!student) {
      await fs.promises.unlink(req.file.path).catch(() => {})
      return res.status(404).json({ message: 'Active student account not found' })
    }
    if (!await hasApprovedEnrollment(student._id)) {
      await fs.promises.unlink(req.file.path).catch(() => {})
      return res.status(403).json({ message: 'An active enrollment with an approved payment is required before assigning papers' })
    }
    const paperDate = uploadDate ? new Date(`${uploadDate}T00:00:00.000Z`) : new Date()
    if (Number.isNaN(paperDate.getTime()) || paperDate > new Date(Date.now() + 86400000)) {
      await fs.promises.unlink(req.file.path).catch(() => {})
      return res.status(400).json({ message: 'Choose a valid upload date' })
    }
    const paper = await IndividualStudentPaper.create({
      student: student._id,
      title: String(title).trim(),
      subject: String(subject).trim(),
      description: String(description).trim(),
      pdfFile: req.file.filename,
      pdfName: req.file.originalname.slice(0, 255),
      uploadDate: paperDate,
    })
    await AuditLog.create({ actor: req.user._id, action: 'individual_paper_uploaded', entity: 'IndividualStudentPaper', entityId: String(paper._id), details: { student: String(student._id), title: paper.title } }).catch(() => {})
    res.status(201).json(paper)
  } catch (error) {
    if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {})
    next(error)
  }
})

router.get('/:paperId/file', async (req, res, next) => {
  try {
    const paper = await IndividualStudentPaper.findById(req.params.paperId)
    const filePath = paper && resolveStoredPaper(paper.pdfFile)
    if (!paper || !filePath || !fs.existsSync(filePath)) return res.status(404).json({ message: 'Paper file not found' })
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${String(paper.pdfName).replace(/[\r\n"\\]/g, '_')}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
    res.sendFile(filePath, error => { if (error && !res.headersSent) next(error) })
  } catch (error) { next(error) }
})

router.patch('/:paperId', async (req, res, next) => {
  try {
    const updates = {}
    for (const key of ['title', 'subject', 'description']) if (typeof req.body[key] === 'string') updates[key] = req.body[key].trim()
    if (req.body.uploadDate) updates.uploadDate = new Date(`${req.body.uploadDate}T00:00:00.000Z`)
    const paper = await IndividualStudentPaper.findByIdAndUpdate(req.params.paperId, updates, { new: true, runValidators: true })
    if (!paper) return res.status(404).json({ message: 'Paper not found' })
    res.json(paper)
  } catch (error) { next(error) }
})

router.post('/:paperId/replace', withUploadCleanup(upload.single('pdf')), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose a PDF file no larger than 30 MB' })
    if (!await isPdf(req.file.path)) {
      await fs.promises.unlink(req.file.path).catch(() => {})
      return res.status(400).json({ message: 'The selected file is not a valid PDF' })
    }
    const paper = await IndividualStudentPaper.findById(req.params.paperId)
    if (!paper) {
      await fs.promises.unlink(req.file.path).catch(() => {})
      return res.status(404).json({ message: 'Paper not found' })
    }
    if (!await hasApprovedEnrollment(paper.student)) {
      await fs.promises.unlink(req.file.path).catch(() => {})
      return res.status(403).json({ message: 'An active enrollment with an approved payment is required before replacing assigned papers' })
    }
    const previous = resolveStoredPaper(paper.pdfFile)
    paper.pdfFile = req.file.filename
    paper.pdfName = req.file.originalname.slice(0, 255)
    await paper.save()
    if (previous) await fs.promises.unlink(previous).catch(() => {})
    res.json(paper)
  } catch (error) {
    if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {})
    next(error)
  }
})

router.delete('/:paperId', async (req, res, next) => {
  try {
    const paper = await IndividualStudentPaper.findByIdAndDelete(req.params.paperId)
    if (!paper) return res.status(404).json({ message: 'Paper not found' })
    const filePath = resolveStoredPaper(paper.pdfFile)
    if (filePath) await fs.promises.unlink(filePath).catch(() => {})
    res.status(204).end()
  } catch (error) { next(error) }
})

module.exports = router
