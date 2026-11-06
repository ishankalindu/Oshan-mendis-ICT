const router = require('express').Router()
const fs = require('fs')
const { authenticate, authorize } = require('../middleware/auth')
const { upload, withUploadCleanup, isPdf, resolveStoredPaper } = require('../middleware/studentPaperFiles')
const { TuteSubmission, Enrollment, Batch, AuditLog } = require('../models/AcademicContent')

router.use(authenticate, authorize('student'))

router.get('/', async (req, res, next) => {
  try {
    const enrollments = await Enrollment.find({ student: req.user._id, status: 'active' }).select('batch')
    const batchIds = enrollments.map(item => item.batch)
    const [items, batches] = await Promise.all([
      TuteSubmission.find({ student: req.user._id }).populate({ path: 'batch', select: 'name year subject', populate: { path: 'year', select: 'year' } }).sort({ submittedAt: -1 }).lean(),
      Batch.find({ _id: { $in: batchIds } }).select('name year subject').populate('year', 'year').sort('year').lean(),
    ])
    res.set('Cache-Control', 'private, no-store')
    res.json({ items, batches })
  } catch (error) { next(error) }
})

router.post('/', withUploadCleanup(upload.single('pdf')), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose a PDF file no larger than 30 MB' })
    if (!await isPdf(req.file.path)) {
      await fs.promises.unlink(req.file.path).catch(() => {})
      return res.status(400).json({ message: 'The selected file is not a valid PDF' })
    }
    const tuteNumber = String(req.body.tuteNumber || '').trim()
    const tuteName = String(req.body.tuteName || '').trim()
    const batchId = String(req.body.batchId || '').trim()
    if (!tuteNumber || tuteNumber.length > 40 || !tuteName || tuteName.length > 160 || !batchId) {
      await fs.promises.unlink(req.file.path).catch(() => {})
      return res.status(400).json({ message: 'Choose your batch and enter a Tute number and name' })
    }
    const enrollment = await Enrollment.findOne({ student: req.user._id, batch: batchId, status: 'active' }).select('batch')
    if (!enrollment) {
      await fs.promises.unlink(req.file.path).catch(() => {})
      return res.status(403).json({ message: 'You can submit papers only for one of your active batches' })
    }
    const submission = await TuteSubmission.create({
      student: req.user._id,
      studentName: req.user.name,
      studentId: req.user.studentId || '',
      batch: enrollment.batch,
      tuteNumber,
      tuteName,
      pdfFile: req.file.filename,
      pdfName: req.file.originalname.slice(0, 255),
      submittedAt: new Date(),
      status: 'submitted',
    }).catch(async error => {
      await fs.promises.unlink(req.file.path).catch(() => {})
      if (error.code === 11000) return null
      throw error
    })
    if (!submission) return res.status(409).json({ message: 'You already submitted this Tute for the selected batch. Replace the existing submission instead.' })
    await AuditLog.create({ actor: req.user._id, action: 'tute_paper_submitted', entity: 'TuteSubmission', entityId: String(submission._id), details: { batch: String(submission.batch), tuteNumber } }).catch(() => {})
    res.status(201).json(submission)
  } catch (error) {
    if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {})
    next(error)
  }
})

router.post('/:submissionId/replace', withUploadCleanup(upload.single('pdf')), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose a PDF file no larger than 30 MB' })
    if (!await isPdf(req.file.path)) {
      await fs.promises.unlink(req.file.path).catch(() => {})
      return res.status(400).json({ message: 'The selected file is not a valid PDF' })
    }
    const submission = await TuteSubmission.findOne({ _id: req.params.submissionId, student: req.user._id })
    if (!submission) {
      await fs.promises.unlink(req.file.path).catch(() => {})
      return res.status(404).json({ message: 'Tute submission not found' })
    }
    const oldFile = resolveStoredPaper(submission.pdfFile)
    submission.pdfFile = req.file.filename
    submission.pdfName = req.file.originalname.slice(0, 255)
    submission.submittedAt = new Date()
    submission.status = 'submitted'
    await submission.save()
    if (oldFile) await fs.promises.unlink(oldFile).catch(() => {})
    await AuditLog.create({ actor: req.user._id, action: 'tute_paper_replaced', entity: 'TuteSubmission', entityId: String(submission._id), details: { tuteNumber: submission.tuteNumber } }).catch(() => {})
    res.json(submission)
  } catch (error) {
    if (req.file?.path) await fs.promises.unlink(req.file.path).catch(() => {})
    next(error)
  }
})

router.get('/:submissionId/file', async (req, res, next) => {
  try {
    const submission = await TuteSubmission.findOne({ _id: req.params.submissionId, student: req.user._id }).select('pdfFile pdfName')
    const filePath = submission && resolveStoredPaper(submission.pdfFile)
    if (!submission || !filePath || !fs.existsSync(filePath)) return res.status(404).json({ message: 'Tute submission not found' })
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${String(submission.pdfName).replace(/[\r\n"\\]/g, '_')}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
    res.sendFile(filePath, error => { if (error && !res.headersSent) next(error) })
  } catch (error) { next(error) }
})

module.exports = router
