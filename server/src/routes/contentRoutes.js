const router = require('express').Router()
const fs = require('fs')
const path = require('path')
const multer = require('multer')
const { authenticate, authorize } = require('../middleware/auth')
const {
  AcademicYear, Batch, Lesson, YouTubeVideo, RecordedClass, LearningResource,
  ZoomClass, Announcement, Payment, Enrollment, StudentProfile, Attendance, LessonProgress, Notification, SiteSettings, AuditLog,
} = require('../models/AcademicContent')
const User = require('../models/User')

const storageDirectory = path.resolve(process.env.STORAGE_DIR || path.join(__dirname, '../../private-uploads'))
fs.mkdirSync(storageDirectory, { recursive: true })
const upload = multer({
  storage: multer.diskStorage({ destination: storageDirectory, filename: (_req, file, done) => done(null, `${Date.now()}-${require('crypto').randomBytes(12).toString('hex')}${path.extname(file.originalname).toLowerCase()}`) }),
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, done) => {
    const extension = path.extname(file.originalname).toLowerCase()
    const allowed = { '.pdf': ['application/pdf'], '.ppt': ['application/vnd.ms-powerpoint'], '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'] }
    done(null, Boolean(allowed[extension] && (allowed[extension].includes(file.mimetype) || file.mimetype === 'application/octet-stream')))
  },
})

const publicUploadDirectory = path.resolve(process.env.PUBLIC_UPLOAD_DIR || path.join(__dirname, '../../public-uploads'))
fs.mkdirSync(publicUploadDirectory, { recursive: true })
const profileUpload = multer({
  storage: multer.diskStorage({
    destination: publicUploadDirectory,
    filename: (_req, file, done) => done(null, `teacher-${Date.now()}-${require('crypto').randomBytes(8).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, done) => done(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)),
})

router.use(authenticate, authorize('admin'))

function crud(path, Model) {
  const contentModels = [Lesson, YouTubeVideo, RecordedClass, LearningResource]
  async function validateBatchIds(value) {
    const batchIds = Array.isArray(value) ? value : value ? [value] : []
    if (!batchIds.length) return false
    return await Batch.countDocuments({ _id: { $in: batchIds } }) === new Set(batchIds.map(String)).size
  }
  router.route(path).get(async (req, res, next) => {
    try {
      const page = Math.max(Number(req.query.page) || 1, 1)
      const limit = Math.min(Number(req.query.limit) || 50, 100)
      const batchScopedModels = [Lesson, YouTubeVideo, RecordedClass, LearningResource, Announcement]
      const filter = req.query.batch && batchScopedModels.includes(Model) ? { batch: req.query.batch } : {}
      let query = Model.find(filter).sort('-createdAt').skip((page - 1) * limit).limit(limit)
      if (Model === Batch) query = query.populate('year', 'year')
      if (Model === ZoomClass) query = query.populate({ path: 'batch', select: 'name year', populate: { path: 'year', select: 'year' } })
      if (Model === Payment) query = query.populate('student', 'name email city phone studentId').populate({ path: 'batch', select: 'name year city subject fee', populate: { path: 'year', select: 'year' } })
      if (Model === Attendance) query = query.populate('student', 'name email').populate({ path: 'class', select: 'title startsAt batch', populate: { path: 'batch', select: 'name year' } })
      const [items, total] = await Promise.all([
        query,
        Model.countDocuments(filter),
      ])
      res.json({ items, total, page, pages: Math.ceil(total / limit) })
    } catch (error) { next(error) }
  }).post(async (req, res, next) => {
    try {
      if (Model === Batch) {
        if (!String(req.body.city || '').trim() || !String(req.body.subject || '').trim()) return res.status(400).json({ message: 'Batch city and subject are required' })
        if (!await AcademicYear.exists({ _id: req.body.year })) return res.status(400).json({ message: 'Choose a valid academic year' })
      }
      if (contentModels.includes(Model) && !(await validateBatchIds(req.body.batch))) return res.status(400).json({ message: 'Choose at least one valid batch for this resource' })
      res.status(201).json(await Model.create(req.body))
    } catch (error) { next(error) }
  })
  router.route(`${path}/:id`).patch(async (req, res, next) => {
    try {
      if (Model === Batch && req.body.year && !await AcademicYear.exists({ _id: req.body.year })) return res.status(400).json({ message: 'Choose a valid academic year' })
      if (contentModels.includes(Model) && 'batch' in req.body && !(await validateBatchIds(req.body.batch))) return res.status(400).json({ message: 'Choose at least one valid batch for this resource' })
      res.json(await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }))
    } catch (error) { next(error) }
  }).delete(async (req, res, next) => {
    try {
      const item = await Model.findById(req.params.id)
      if (!item) return res.status(404).json({ message: 'Record not found' })
      if (Model === Batch && await Enrollment.exists({ batch: item._id })) return res.status(409).json({ message: 'This batch still has enrollments. Archive it instead.' })
      if (Model === LearningResource && item.fileUrl?.startsWith('storage:')) fs.rmSync(path.join(storageDirectory, path.basename(item.fileUrl.slice('storage:'.length))), { force: true })
      await Model.deleteOne({ _id: item._id })
      res.status(204).end()
    } catch (error) { next(error) }
  })
}

crud('/academic-years', AcademicYear)
crud('/batches', Batch)
crud('/lessons', Lesson)
crud('/videos', YouTubeVideo)
crud('/recordings', RecordedClass)
crud('/resources', LearningResource)
crud('/zoom-classes', ZoomClass)
crud('/announcements', Announcement)
crud('/attendance', Attendance)

router.post('/resources/upload', upload.single('file'), async (req, res, next) => {
  if (!req.file) return res.status(400).json({ message: 'Choose a PDF or PowerPoint file (maximum 50 MB)' })
  try {
    const data = JSON.parse(req.body.data || '{}')
    const batch = Array.isArray(data.batch) ? data.batch : data.batch ? [data.batch] : []
    const title = data.title && typeof data.title === 'object' ? data.title : { en: String(data.title || '') }
    if (!title.en?.trim() || !batch.length || await Batch.countDocuments({ _id: { $in: batch } }) !== new Set(batch.map(String)).size) {
      fs.rmSync(req.file.path, { force: true })
      return res.status(400).json({ message: 'A title and at least one valid academic batch are required' })
    }
    const resource = await LearningResource.create({ ...data, title, batch, fileName: path.basename(req.file.originalname), fileUrl: `storage:${path.basename(req.file.filename)}` })
    await AuditLog.create({ actor: req.user._id, action: 'resource_uploaded', entity: 'LearningResource', entityId: String(resource._id), details: { batch, type: resource.type, access: resource.access } })
    res.status(201).json(resource)
  } catch (error) { fs.rmSync(req.file.path, { force: true }); next(error) }
})

router.get('/payments', async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1)
    const limit = Math.min(Number(req.query.limit) || 50, 100)
    const filter = {}
    if (req.query.batch) filter.batch = req.query.batch
    if (req.query.status) filter.status = req.query.status
    if (req.query.month) filter.paymentMonth = String(req.query.month)
    if (req.query.year) filter.paymentMonth = { $regex: `^${String(req.query.year).replace(/[^\d]/g, '')}-` }
    if (req.query.student) filter.student = req.query.student
    if (req.query.search || req.query.city) {
      const userQuery = { role: 'student' }
      if (req.query.city) userQuery.city = new RegExp(String(req.query.city).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      if (req.query.search) userQuery.$or = [
        { name: new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { email: new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        { studentId: new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
      ]
      const matched = await User.find(userQuery).distinct('_id')
      filter.student = { $in: matched }
    }
    const [items, total] = await Promise.all([
      Payment.find(filter).select('-slipFile -slipName -slipUrl').populate('student', 'name email phone studentId city').populate({ path: 'batch', select: 'name year city subject className fee', populate: { path: 'year', select: 'year' } }).populate('enrollment').sort('-date').skip((page - 1) * limit).limit(limit),
      Payment.countDocuments(filter),
    ])
    res.json({ items, total, page, pages: Math.ceil(total / limit) })
  } catch (error) { next(error) }
})

router.post('/payments', async (req, res, next) => {
  try {
    const { student, batch, amount, method, reference, paymentMonth, date, notes } = req.body
    if (!student || !batch || !Number.isFinite(Number(amount)) || Number(amount) <= 0) return res.status(400).json({ message: 'Student, batch, and a valid amount greater than zero are required' })
    const [user, cohort] = await Promise.all([User.findOne({ _id: student, role: 'student' }), Batch.findById(batch)])
    if (!user || !cohort) return res.status(400).json({ message: 'Choose a valid student and batch' })
    const enrollment = await Enrollment.findOne({ student, batch })
    if (!enrollment) return res.status(400).json({ message: 'Create the student enrollment before recording payment' })
    if (paymentMonth && (!/^\d{4}-\d{2}$/.test(paymentMonth) || Number(paymentMonth.slice(5)) < 1 || Number(paymentMonth.slice(5)) > 12)) return res.status(400).json({ message: 'Choose a valid payment month' })
    if (paymentMonth ? await Payment.exists({ student, batch, paymentMonth, status: { $in: ['pending', 'paid'] } }) : await Payment.exists({ student, batch, status: 'pending', paymentMonth: { $exists: false } })) return res.status(409).json({ message: 'A pending or approved payment already exists for this month or enrollment' })
    const payment = await Payment.create({ student, batch, enrollment: enrollment._id, amount: Number(amount), method: method || 'manual', reference, paymentMonth: paymentMonth || undefined, date: date || undefined, notes, status: 'pending' })
    enrollment.paymentStatus = 'pending'
    enrollment.payment = payment._id
    await enrollment.save()
    await AuditLog.create({ actor: req.user._id, action: 'payment_recorded', entity: 'Payment', entityId: String(payment._id), details: { student, batch, amount } })
    res.status(201).json(payment)
  } catch (error) { next(error) }
})

router.patch('/payments/:id', async (req, res, next) => {
  try {
    const payment = await Payment.findById(req.params.id)
    if (!payment) return res.status(404).json({ message: 'Payment record not found' })
    const { amount, method, reference, date, paymentMonth, notes, status } = req.body
    if (status !== undefined && !['pending', 'paid'].includes(status)) return res.status(400).json({ message: 'Payment status must be Paid or Pending' })
    if (amount !== undefined && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) return res.status(400).json({ message: 'Enter a valid payment amount greater than zero' })
    if (paymentMonth !== undefined && paymentMonth && (!/^\d{4}-\d{2}$/.test(paymentMonth) || Number(paymentMonth.slice(5)) < 1 || Number(paymentMonth.slice(5)) > 12)) return res.status(400).json({ message: 'Choose a valid payment month' })
    if (paymentMonth && (status === 'paid' || payment.status === 'paid') && await Payment.exists({ _id: { $ne: payment._id }, student: payment.student, batch: payment.batch, paymentMonth, status: 'paid' })) return res.status(409).json({ message: 'An approved payment already exists for this student and month' })
    const enrollment = await Enrollment.findOne({ _id: payment.enrollment, student: payment.student, batch: payment.batch }) || await Enrollment.findOne({ student: payment.student, batch: payment.batch })
    if (!enrollment) return res.status(409).json({ message: 'The payment has no matching student enrollment' })
    if (amount !== undefined) payment.amount = Number(amount)
    if (method !== undefined) payment.method = String(method).trim().slice(0, 60)
    if (reference !== undefined) payment.reference = String(reference).trim().slice(0, 160)
    if (date !== undefined) payment.date = date ? new Date(date) : payment.date
    if (paymentMonth !== undefined) payment.paymentMonth = paymentMonth || undefined
    if (notes !== undefined) payment.notes = String(notes).trim().slice(0, 1000)
    if (status !== undefined) payment.status = status
    payment.enrollment = enrollment._id
    await payment.save()
    if (payment.status === 'paid') {
      enrollment.paymentStatus = 'paid'
      enrollment.payment = payment._id
      if (['active', 'suspended'].includes(enrollment.status)) { enrollment.status = 'active'; if (!enrollment.accessFrom) enrollment.accessFrom = new Date() }
    } else if (String(enrollment.payment || '') === String(payment._id)) {
      enrollment.paymentStatus = 'pending'
      enrollment.payment = undefined
    }
    await enrollment.save()
    await AuditLog.create({ actor: req.user._id, action: `payment_${payment.status}_updated`, entity: 'Payment', entityId: String(payment._id), details: { student: String(payment.student), batch: String(payment.batch) } })
    res.json({ payment, enrollment })
  } catch (error) { next(error) }
})

router.get('/dashboard', async (_req, res, next) => {
  try {
    const now = new Date()
    const [students, activeBatches, totalBatches, lessonCount, videoCount, recordedCount, learningResourceCount, pending, approvedPayments, rejectedPayments, upcomingCount, lessons, videos, payments, classes, resources, registrations, activeEnrollments] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      Batch.countDocuments({ status: 'active' }),
      Batch.countDocuments(),
      Lesson.countDocuments({ published: true }),
      YouTubeVideo.countDocuments({ published: true }),
      RecordedClass.countDocuments({ published: true }),
      LearningResource.countDocuments({ published: true }),
      Payment.countDocuments({ status: 'pending' }),
      Payment.countDocuments({ status: 'paid' }),
      Payment.countDocuments({ status: 'rejected' }),
      ZoomClass.countDocuments({ status: 'upcoming', published: true, startsAt: { $gte: now } }),
      Lesson.find({ published: true }).sort('-updatedAt').limit(5).select('title updatedAt'),
      YouTubeVideo.find({ published: true }).sort('-updatedAt').limit(5).select('title updatedAt'),
      Payment.find().sort('-updatedAt').limit(5).populate('student', 'name email').populate('batch', 'name'),
      ZoomClass.find().sort('-createdAt').limit(5).populate('batch', 'name'),
      LearningResource.find().sort('-createdAt').limit(5).select('title createdAt'),
      User.find({ role: 'student' }).sort('-createdAt').limit(5).select('name email createdAt'),
      Enrollment.find({ status: 'active', $and: [{ $or: [{ accessUntil: null }, { accessUntil: { $gte: now } }] }, { $or: [{ accessFrom: null }, { accessFrom: { $lte: now } }] }] }).populate({ path: 'batch', select: 'name year city subject className', populate: { path: 'year', select: 'year' } }).populate('student', 'active'),
    ])
    const activity = [
      ...registrations.map(item => ({ kind: 'student', label: 'Student registered', detail: item.name, email: item.email, at: item.createdAt })),
      ...payments.map(item => ({ kind: 'payment', label: `Payment ${item.status}`, detail: item.student?.name || item.student?.email || 'Student payment', at: item.updatedAt || item.createdAt, status: item.status })),
      ...lessons.map(item => ({ kind: 'lesson', label: 'Lesson published', detail: item.title?.en || item.title?.si || 'Lesson', at: item.updatedAt })),
      ...videos.map(item => ({ kind: 'video', label: 'Video published', detail: item.title?.en || item.title?.si || 'Video', at: item.updatedAt })),
      ...classes.map(item => ({ kind: 'class', label: item.status === 'cancelled' ? 'Class cancelled' : 'Class scheduled', detail: item.title?.en || item.title?.si || 'Zoom class', at: item.createdAt })),
      ...resources.map(item => ({ kind: 'resource', label: 'Material added', detail: item.title?.en || item.title?.si || 'Learning material', at: item.createdAt })),
    ].filter(item => item.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 8)
    const upcomingClasses = await ZoomClass.find({ status: 'upcoming', published: true, startsAt: { $gte: now } }).sort('startsAt').limit(5).populate({ path: 'batch', select: 'name year', populate: { path: 'year', select: 'year' } })
    const byBatch = new Map()
    for (const enrollment of activeEnrollments) {
      if (!enrollment.batch) continue
      const id = String(enrollment.batch._id)
      const label = `${enrollment.batch.year?.year || enrollment.batch.name?.en || 'Unassigned batch'} ${enrollment.batch.subject || 'A/L ICT'}${enrollment.batch.city ? ` · ${enrollment.batch.city}` : ''}${enrollment.batch.className ? ` · ${enrollment.batch.className}` : ''}`
      const summary = byBatch.get(id) || { batch: label, count: 0 }
      summary.count += 1
      byBatch.set(id, summary)
    }
    const paidPaymentIds = activeEnrollments.filter(item => item.student?.active && item.paymentStatus === 'paid' && item.payment).map(item => item.payment)
    const activePaid = paidPaymentIds.length ? await Payment.countDocuments({ _id: { $in: paidPaymentIds }, status: 'paid' }) : 0
    const activeBatchItems = await Batch.find({ status: 'active' }).populate('year', 'year').lean()
    const resourceModels = [Lesson, YouTubeVideo, RecordedClass, LearningResource, Announcement]
    const resourcesByBatch = await Promise.all(activeBatchItems.map(async batch => {
      const counts = await Promise.all(resourceModels.map(Model => Model.countDocuments({ batch: batch._id })))
      return { id: String(batch._id), name: batch.name?.en || `${batch.year?.year || ''} ${batch.subject || 'A/L ICT'}`, city: batch.city, subject: batch.subject, count: counts.reduce((total, count) => total + count, 0) }
    }))
    res.json({ students, activeBatches, totalBatches, activePaid, studentsByBatch: [...byBatch.values()], resourcesByBatch, totalResources: lessonCount + videoCount + recordedCount + learningResourceCount, published: lessonCount + videoCount, pending, approvedPayments, rejectedPayments, upcoming: upcomingCount, activity, upcomingClasses })
  } catch (error) { next(error) }
})

router.get('/students', async (_req, res, next) => {
  try {
    const page = Math.max(Number(_req.query.page) || 1, 1)
    const limit = Math.min(Number(_req.query.limit) || 25, 100)
    const filter = { role: 'student' }
    const idConditions = []
    const escaped = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (_req.query.search) { const rx = new RegExp(escaped(_req.query.search), 'i'); filter.$or = [{ name: rx }, { email: rx }, { studentId: rx }] }
    if (_req.query.city) filter.city = new RegExp(escaped(_req.query.city), 'i')
    if (_req.query.batch) {
      const assigned = await StudentProfile.find({ batches: _req.query.batch }).distinct('user')
      const enrolled = await Enrollment.find({ batch: _req.query.batch }).distinct('student')
      idConditions.push({ $in: [...new Set([...assigned, ...enrolled].map(String))] })
    }
    if (_req.query.payment) {
      const paymentMatch = _req.query.batch ? { batch: _req.query.batch } : {}
      const latestPayments = await Payment.aggregate([{ $match: paymentMatch }, { $sort: { date: -1, createdAt: -1 } }, { $group: { _id: '$student', status: { $first: '$status' } } }])
      const latestByStudent = new Map(latestPayments.map(item => [String(item._id), item.status]))
      const matchingPayments = [...latestByStudent].filter(([, status]) => status === _req.query.payment).map(([id]) => id)
      if (_req.query.payment === 'none') {
        const candidates = _req.query.batch ? await Enrollment.find({ batch: _req.query.batch }).distinct('student') : await User.find({ role: 'student' }).distinct('_id')
        idConditions.push({ $in: candidates.filter(id => !latestByStudent.has(String(id))) })
      } else idConditions.push({ $in: matchingPayments })
    }
    if (_req.query.enrollment) idConditions.push({ $in: await Enrollment.find({ status: _req.query.enrollment, ...(_req.query.batch ? { batch: _req.query.batch } : {}) }).distinct('student') })
    if (idConditions.length) filter._id = { $in: [...idConditions.map(condition => condition.$in.reduce((set, id) => { set.add(String(id)); return set }, new Set())).reduce((intersection, current) => new Set([...intersection].filter(id => current.has(id))))] }
    const [users, total] = await Promise.all([User.find(filter).sort('-createdAt').select('studentId name email city address phone active createdAt').skip((page - 1) * limit).limit(limit), User.countDocuments(filter)])
    const ids = users.map(user => user._id)
    const [profiles, enrollments, payments] = await Promise.all([
      StudentProfile.find({ user: { $in: ids } }).populate('batches', 'name year').populate({ path: 'batches', populate: { path: 'year', select: 'year' } }),
      Enrollment.find({ student: { $in: ids } }).populate('batch', 'name year').populate({ path: 'batch', populate: { path: 'year', select: 'year' } }).sort('-createdAt'),
      Payment.find({ student: { $in: ids } }).sort({ date: -1, createdAt: -1 }),
    ])
    const profileByUser = new Map(profiles.map(item => [String(item.user), item]))
    const enrollmentsByUser = new Map()
    for (const item of enrollments) {
      const key = String(item.student)
      if (!enrollmentsByUser.has(key)) enrollmentsByUser.set(key, [])
      enrollmentsByUser.get(key).push(item)
    }
    const paymentsByUser = new Map()
    for (const item of payments) {
      const key = String(item.student)
      if (!paymentsByUser.has(key)) paymentsByUser.set(key, [])
      paymentsByUser.get(key).push(item)
    }
    res.json({ items: users.map(user => ({
      id: user.id, studentId: user.studentId, name: user.name, email: user.email, city: user.city, address: user.address, phone: user.phone, active: user.active, createdAt: user.createdAt,
      profile: profileByUser.get(String(user._id)) || null,
      enrollments: enrollmentsByUser.get(String(user._id)) || [],
      payments: paymentsByUser.get(String(user._id)) || [],
    })), total, page, pages: Math.ceil(total / limit) })
  } catch (error) { next(error) }
})

async function updateStudent(req, res, next) {
  try {
    if (typeof req.body.address === 'string' && !req.body.address.trim()) return res.status(400).json({ message: 'Home address is required' })
    if (Array.isArray(req.body.batches)) {
      const validBatches = await Batch.countDocuments({ _id: { $in: req.body.batches } })
      if (validBatches !== new Set(req.body.batches.map(String)).size) return res.status(400).json({ message: 'One or more selected batches are invalid' })
    }
    const updates = {}
    if (typeof req.body.name === 'string') updates.name = req.body.name.trim()
    if (typeof req.body.email === 'string') updates.email = req.body.email.trim().toLowerCase()
    if (typeof req.body.city === 'string') updates.city = req.body.city.trim()
    if (typeof req.body.address === 'string') updates.address = req.body.address.trim()
    if (typeof req.body.phone === 'string') updates.phone = req.body.phone.trim()
    if (typeof req.body.active === 'boolean') updates.active = req.body.active
    const user = await User.findOneAndUpdate({ _id: req.params.id, role: 'student' }, updates, { new: true, runValidators: true }).select('studentId name email city address phone active createdAt')
    if (!user) return res.status(404).json({ message: 'Student not found' })
    if (Array.isArray(req.body.batches)) {
      await StudentProfile.findOneAndUpdate({ user: user._id }, { $set: { batches: req.body.batches } }, { upsert: true, new: true, runValidators: true })
      const selected = new Set(req.body.batches.map(String))
      await Enrollment.updateMany({ student: user._id, status: 'active', batch: { $nin: req.body.batches } }, { $set: { status: 'revoked' } })
      for (const batchId of selected) await Enrollment.updateOne({ student: user._id, batch: batchId }, { $set: { status: 'active' } }, { upsert: true })
    }
    await AuditLog.create({ actor: req.user._id, action: 'student_updated', entity: 'User', entityId: String(user._id), details: { fields: Object.keys(updates), batches: req.body.batches } })
    res.json({ id: user.id, studentId: user.studentId, name: user.name, email: user.email, city: user.city, address: user.address, phone: user.phone, active: user.active, createdAt: user.createdAt })
  } catch (error) { next(error) }
}

router.patch('/students/:id', updateStudent)
router.put('/students/:id', updateStudent)

router.delete('/students/:id', async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'student' })
    if (!user) return res.status(404).json({ message: 'Student not found' })

    await Promise.all([
      StudentProfile.deleteMany({ user: user._id }),
      Enrollment.deleteMany({ student: user._id }),
      Payment.deleteMany({ student: user._id }),
      Attendance.deleteMany({ student: user._id }),
      LessonProgress.deleteMany({ student: user._id }),
      Notification.deleteMany({ user: user._id }),
      Batch.updateMany({ students: user._id }, { $pull: { students: user._id } }),
    ])
    await user.deleteOne()
    await AuditLog.create({ actor: req.user._id, action: 'student_deleted', entity: 'User', entityId: String(user._id), details: { studentId: user.studentId, name: user.name } })
    res.json({ message: 'Student deleted successfully' })
  } catch (error) { next(error) }
})

router.post('/students', async (req, res, next) => {
  try {
    const { name, email, password, city, address, phone, batches = [] } = req.body
    if (!name?.trim() || !email?.trim() || !password || password.length < 8 || !city?.trim() || !address?.trim()) return res.status(400).json({ message: 'Name, valid email, password of at least 8 characters, city, and home address are required' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ message: 'Enter a valid email address' })
    if (!Array.isArray(batches)) return res.status(400).json({ message: 'Batches must be a list' })
    const uniqueBatches = [...new Set(batches.map(String))]
    if (uniqueBatches.length && await Batch.countDocuments({ _id: { $in: uniqueBatches } }) !== uniqueBatches.length) return res.status(400).json({ message: 'One or more selected batches are invalid' })
    const user = await User.create({ name, email: email.trim().toLowerCase(), password, city, address: address.trim(), phone, role: 'student' })
    await StudentProfile.create({ user: user._id, batches: uniqueBatches, phone })
    if (uniqueBatches.length) await Enrollment.insertMany(uniqueBatches.map(batch => ({ student: user._id, batch, status: 'active' })))
    await AuditLog.create({ actor: req.user._id, action: 'student_created', entity: 'User', entityId: String(user._id), details: { studentId: user.studentId, batches: uniqueBatches } })
    res.status(201).json({ id: user.id, studentId: user.studentId, name: user.name, email: user.email, city: user.city, address: user.address, phone: user.phone, active: user.active })
  } catch (error) { next(error) }
})

router.patch('/enrollments/:id/status', async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findByIdAndUpdate(req.params.id, { status: req.body.status, accessFrom: req.body.accessFrom, accessUntil: req.body.accessUntil }, { new: true, runValidators: true })
    if (!enrollment) return res.status(404).json({ message: 'Enrollment not found' })
    await AuditLog.create({ actor: req.user._id, action: 'enrollment_access_updated', entity: 'Enrollment', entityId: String(enrollment._id), details: { status: enrollment.status, accessFrom: enrollment.accessFrom, accessUntil: enrollment.accessUntil } })
    res.json(enrollment)
  } catch (error) { next(error) }
})

router.get('/reports', async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(`${req.query.from}T00:00:00+05:30`) : null
    const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999+05:30`) : null
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) return res.status(400).json({ message: 'Report dates must be valid ISO dates' })
    const period = {}
    if (from || to) period.date = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) }
    const [students, batches, payments, attendance, lessons] = await Promise.all([
      StudentProfile.aggregate([{ $unwind: '$batches' }, { $group: { _id: '$batches', count: { $sum: 1 } } }, { $lookup: { from: 'batches', localField: '_id', foreignField: '_id', as: 'batch' } }, { $unwind: { path: '$batch', preserveNullAndEmptyArrays: true } }, { $project: { batch: '$batch.name.en', year: '$batch.year', count: 1 } }]),
      Batch.countDocuments({ status: 'active' }),
      Payment.aggregate([{ $match: period }, { $group: { _id: '$status', count: { $sum: 1 }, amount: { $sum: '$amount' } } }]),
      Attendance.aggregate([{ $match: from || to ? { date: { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) } } : {} }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      Lesson.countDocuments({ published: true }),
    ])
    res.json({ from: from?.toISOString() || null, to: to?.toISOString() || null, studentsByBatch: students, activeBatches: batches, payments, attendance, publishedLessons: lessons })
  } catch (error) { next(error) }
})

router.get('/settings', async (_req, res, next) => {
  try { res.json(await SiteSettings.find().sort('key')) } catch (error) { next(error) }
})
router.put('/teacher-profile', async (req, res, next) => {
  try {
    const value = {
      name: String(req.body.name || '').trim(),
      photoUrl: String(req.body.photoUrl || '').trim(),
      qualifications: String(req.body.qualifications || '').trim(),
      experience: String(req.body.experience || '').trim(),
      description: String(req.body.description || '').trim(),
    }
    const setting = await SiteSettings.findOneAndUpdate({ key: 'teacherProfile' }, { $set: { value } }, { upsert: true, new: true, runValidators: true })
    res.json(setting.value)
  } catch (error) { next(error) }
})

router.post('/teacher-profile/photo', profileUpload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Select a JPG, PNG, or WebP image.' })
    const photoUrl = `/uploads/${req.file.filename}`
    const current = await SiteSettings.findOne({ key: 'teacherProfile' })
    const value = { ...(current?.value || {}), photoUrl }
    await SiteSettings.findOneAndUpdate({ key: 'teacherProfile' }, { $set: { value } }, { upsert: true, new: true })
    res.json({ photoUrl })
  } catch (error) { next(error) }
})

router.put('/settings/:key', async (req, res, next) => {
  try {
    const setting = await SiteSettings.findOneAndUpdate({ key: req.params.key }, { $set: { value: req.body.value } }, { upsert: true, new: true, runValidators: true })
    res.json(setting)
  } catch (error) { next(error) }
})

module.exports = router
