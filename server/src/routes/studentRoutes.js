const router = require('express').Router()
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const multer = require('multer')
const { authenticate, authorize } = require('../middleware/auth')
const { StudentProfile, Enrollment, Payment, YouTubeVideo, RecordedClass, LearningResource, ZoomClass, Lesson, LessonProgress, Announcement, Batch, Attendance, AuditLog } = require('../models/AcademicContent')
const User = require('../models/User')
const storageDirectory = path.resolve(process.env.STORAGE_DIR || path.join(__dirname, '../../private-uploads'))
const imageTypes = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }
const profilePhotoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => fs.mkdir(storageDirectory, { recursive: true }, callback),
    filename: (req, file, callback) => callback(null, `profile-${req.user._id}-${crypto.randomUUID()}${imageTypes[file.mimetype] || '.img'}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => callback(null, Boolean(imageTypes[file.mimetype])),
})

router.use(authenticate, authorize('student'))
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next() })

async function activeEnrollment(student, batchId) {
  const now = new Date()
  return Enrollment.findOne({ student, batch: batchId, status: 'active', $and: [
    { $or: [{ accessUntil: null }, { accessUntil: { $gte: now } }] },
    { $or: [{ accessFrom: null }, { accessFrom: { $lte: now } }] },
  ] })
}

async function paidEnrollment(student, batchId) {
  const enrollment = await activeEnrollment(student, batchId)
  if (!enrollment || enrollment.paymentStatus !== 'paid' || !enrollment.payment) return null
  const payment = await Payment.findOne({ _id: enrollment.payment, enrollment: enrollment._id, student, batch: batchId, status: 'paid' })
  return payment ? enrollment : null
}

function safeResource(item, accessGranted) {
  const data = item.toObject()
  const paid = item.access !== 'free'
  const locked = paid && !accessGranted
  if (locked) {
    delete data.url
    delete data.fileUrl
    delete data.videoId
    delete data.thumbnail
  } else if (item.constructor.modelName === 'LearningResource') {
    data.fileUrl = `/student/files/${item._id}`
  }
  return { ...data, locked, accessGranted: !locked }
}

router.get('/profile', async (req, res, next) => {
  try {
    const [student, profile, enrollments, announcements, attendance, payments] = await Promise.all([
      User.findById(req.user._id).select('studentId name email city phone profilePhoto createdAt'),
      StudentProfile.findOne({ user: req.user._id }),
      Enrollment.find({ student: req.user._id }).populate({ path: 'batch', select: 'name year description status city subject className fee', populate: { path: 'year', select: 'year' } }).sort('-createdAt'),
      Announcement.find({ published: true, $or: [{ batch: { $size: 0 } }, { batch: { $in: (await Enrollment.find({ student: req.user._id, status: 'active' }).distinct('batch')) } }] }).sort('-createdAt').limit(10),
      Attendance.find({ student: req.user._id }).populate({ path: 'class', select: 'title batch', populate: { path: 'batch', select: 'name year' } }).sort('-date').limit(20),
      Payment.find({ student: req.user._id }).select('-slipFile -slipName -slipUrl').populate({ path: 'batch', select: 'name year city subject className', populate: { path: 'year', select: 'year' } }).sort({ date: -1, createdAt: -1 }),
    ])
    const batches = await Promise.all(enrollments.map(async enrollment => {
      const batch = enrollment.batch
      const [payment, lessonIds] = await Promise.all([
        enrollment.payment ? Payment.findById(enrollment.payment) : Payment.findOne({ student: req.user._id, batch: batch._id }).sort('-date'),
        Lesson.find({ batch: batch._id, published: true }).distinct('_id'),
      ])
      const completed = lessonIds.length ? await LessonProgress.countDocuments({ student: req.user._id, lesson: { $in: lessonIds }, completed: true }) : 0
      return { enrollment, batch, payment, paid: Boolean(await paidEnrollment(req.user._id, batch._id)), progress: { total: lessonIds.length, completed, percent: lessonIds.length ? Math.round(completed / lessonIds.length * 100) : 0 } }
    }))
    res.json({ student, profile, batches, announcements, attendance, payments })
  } catch (error) { next(error) }
})

router.get('/profile/photo', async (req, res, next) => {
  try {
    const student = await User.findById(req.user._id).select('profilePhoto')
    const filename = path.basename(student?.profilePhoto || '')
    if (!filename || !filename.startsWith(`profile-${req.user._id}-`)) return res.status(404).json({ message: 'No profile photo has been uploaded' })
    const photoPath = path.resolve(storageDirectory, filename)
    if (!photoPath.startsWith(`${storageDirectory}${path.sep}`)) return res.status(404).json({ message: 'Profile photo not found' })
    res.set('X-Content-Type-Options', 'nosniff')
    res.type(path.extname(filename).toLowerCase() === '.png' ? 'png' : path.extname(filename).toLowerCase() === '.webp' ? 'webp' : 'jpeg')
    res.sendFile(photoPath, error => { if (error && !res.headersSent) next(error) })
  } catch (error) { next(error) }
})

router.post('/profile/photo', profilePhotoUpload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose a JPEG, PNG, or WebP image no larger than 5 MB' })
    const bytes = await fs.promises.readFile(req.file.path)
    const isJpeg = req.file.mimetype === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    const isPng = req.file.mimetype === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    const isWebp = req.file.mimetype === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
    if (!isJpeg && !isPng && !isWebp) {
      await fs.promises.unlink(req.file.path)
      return res.status(400).json({ message: 'The selected file is not a valid JPEG, PNG, or WebP image' })
    }
    const student = await User.findById(req.user._id).select('profilePhoto')
    const previous = student.profilePhoto
    student.profilePhoto = req.file.filename
    await student.save()
    res.set('X-Content-Type-Options', 'nosniff')
    if (previous && path.basename(previous).startsWith(`profile-${req.user._id}-`)) fs.promises.unlink(path.resolve(storageDirectory, path.basename(previous))).catch(() => {})
    res.json({ profilePhoto: student.profilePhoto })
  } catch (error) {
    if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {})
    next(error)
  }
})

router.patch('/profile', async (req, res, next) => {
  try {
    const updates = {}
    if (typeof req.body.name === 'string') {
      if (!req.body.name.trim() || req.body.name.trim().length > 120) return res.status(400).json({ message: 'Enter a name of 1 to 120 characters' })
      updates.name = req.body.name.trim()
    }
    if (typeof req.body.city === 'string') {
      if (req.body.city.trim().length > 100) return res.status(400).json({ message: 'City must be 100 characters or fewer' })
      updates.city = req.body.city.trim()
    }
    if (typeof req.body.phone === 'string') {
      if (req.body.phone.trim().length > 30) return res.status(400).json({ message: 'Phone number must be 30 characters or fewer' })
      updates.phone = req.body.phone.trim()
    }
    if (!Object.keys(updates).length) return res.status(400).json({ message: 'No editable profile details were provided' })
    const student = await User.findOneAndUpdate({ _id: req.user._id, role: 'student' }, { $set: updates }, { new: true, runValidators: true }).select('studentId name email city phone profilePhoto createdAt')
    if (typeof updates.phone === 'string') await StudentProfile.updateOne({ user: req.user._id }, { $set: { phone: updates.phone } })
    res.json({ student })
  } catch (error) { next(error) }
})

router.put('/settings/password', async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) return res.status(400).json({ message: 'Enter your current password and a new password of at least 8 characters' })
    const student = await User.findById(req.user._id).select('+password')
    if (!student || !(await student.comparePassword(currentPassword))) return res.status(401).json({ message: 'Current password is incorrect' })
    student.password = newPassword
    await student.save()
    res.json({ message: 'Password updated successfully' })
  } catch (error) { next(error) }
})

router.get('/resources/:batchId', async (req, res, next) => {
  try {
    const batch = await Batch.findById(req.params.batchId)
    const enrollment = await Enrollment.findOne({ student: req.user._id, batch: req.params.batchId })
    if (!batch || !enrollment) return res.status(403).json({ message: 'You are not enrolled in this batch' })
    if (!(await activeEnrollment(req.user._id, req.params.batchId))) return res.status(403).json({ message: 'Your enrollment is not active' })
    const accessGranted = Boolean(await paidEnrollment(req.user._id, req.params.batchId))
    const [videos, recordings, resources, lessons] = await Promise.all([
      YouTubeVideo.find({ batch: req.params.batchId, published: true }).sort('order'),
      RecordedClass.find({ batch: req.params.batchId, published: true }),
      LearningResource.find({ batch: req.params.batchId, published: true }),
      Lesson.find({ batch: req.params.batchId, published: true }).sort('order').lean(),
    ])
    const lessonProgress = await LessonProgress.find({ student: req.user._id, lesson: { $in: lessons.map(item => item._id) } }).select('lesson completed progress')
    const progressByLesson = new Map(lessonProgress.map(item => [String(item.lesson), item]))
    const lessonsWithProgress = lessons.map(item => ({ ...item, progress: progressByLesson.get(String(item._id)) || { completed: false, progress: 0 }, locked: item.access !== 'free' && !accessGranted }))
    res.json({ accessGranted, videos: videos.map(item => safeResource(item, accessGranted)), recordings: recordings.map(item => safeResource(item, accessGranted)), resources: resources.map(item => safeResource(item, accessGranted)), lessons: lessonsWithProgress })
  } catch (error) { next(error) }
})

router.get('/files/:resourceId', async (req, res, next) => {
  try {
    const resource = await LearningResource.findOne({ _id: req.params.resourceId, published: true })
    if (!resource) return res.status(404).json({ message: 'Published file not found' })
    const permitted = await Promise.any(resource.batch.map(async batchId => {
      const enrolled = await activeEnrollment(req.user._id, batchId)
      return Boolean(enrolled && (resource.access === 'free' || await paidEnrollment(req.user._id, batchId)))
    })).catch(() => false)
    if (!permitted) return res.status(403).json({ message: resource.access === 'free' ? 'You are not enrolled in this batch' : 'Active paid enrollment required' })
    let source
    if (resource.fileUrl.startsWith('storage:')) {
      const filename = path.basename(resource.fileUrl.slice('storage:'.length))
      const localPath = path.resolve(storageDirectory, filename)
      if (!localPath.startsWith(`${storageDirectory}${path.sep}`) || !fs.existsSync(localPath)) return res.status(404).json({ message: 'Stored learning file is unavailable' })
      const fileName = String(resource.fileName || `${resource.title?.en || 'learning-resource'}.pdf`).replace(/[\r\n"\\]/g, '_')
      const contentType = fileName.toLowerCase().endsWith('.pptx') ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation' : fileName.toLowerCase().endsWith('.ppt') ? 'application/vnd.ms-powerpoint' : 'application/pdf'
      res.setHeader('Content-Type', contentType)
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
      res.setHeader('Cache-Control', 'private, no-store')
      res.setHeader('X-Content-Type-Options', 'nosniff')
      return res.sendFile(localPath)
    }
    try { source = new URL(resource.fileUrl) } catch { return res.status(503).json({ message: 'This file does not have a valid hosted URL' }) }
    if (source.protocol !== 'https:' || source.username || source.password) return res.status(503).json({ message: 'Protected files must use a secure HTTPS storage URL' })
    const upstream = await fetch(source, { redirect: 'manual', signal: AbortSignal.timeout(20000) })
    if (!upstream.ok || upstream.status >= 300) return res.status(502).json({ message: 'The hosted file could not be retrieved securely' })
    const type = upstream.headers.get('content-type') || 'application/octet-stream'
    if (!['application/pdf', 'application/octet-stream', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'].includes(type.split(';')[0].trim().toLowerCase())) return res.status(415).json({ message: 'This protected route only serves PDF or PowerPoint learning materials' })
    res.setHeader('Content-Type', type)
    res.setHeader('Content-Disposition', `attachment; filename="${String(resource.fileName || `${resource.title?.en || 'learning-resource'}.pdf`).replace(/[\r\n"\\]/g, '_')}"`)
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    const { Readable } = require('stream')
    Readable.fromWeb(upstream.body).pipe(res)
  } catch (error) { next(error) }
})

router.get('/classes/:batchId', async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findOne({ student: req.user._id, batch: req.params.batchId })
    if (!enrollment) return res.status(403).json({ message: 'You are not enrolled in this batch' })
    const active = Boolean(await activeEnrollment(req.user._id, req.params.batchId))
    const paid = Boolean(await paidEnrollment(req.user._id, req.params.batchId))
    const classes = await ZoomClass.find({ batch: req.params.batchId, status: 'upcoming', published: true, startsAt: { $gte: new Date() } }).sort('startsAt')
    res.json(classes.map(item => {
      const data = item.toObject()
      const canJoin = item.access === 'free' ? active : paid
      if (!canJoin) { delete data.meetingUrl; delete data.meetingId; delete data.passcode }
      return { ...data, locked: !canJoin }
    }))
  } catch (error) { next(error) }
})

router.put('/progress/:lessonId', async (req, res, next) => {
  try {
    const lesson = await Lesson.findOne({ _id: req.params.lessonId, published: true })
    if (!lesson) return res.status(404).json({ message: 'Lesson not found' })
    const batchIds = lesson.batch.map(String)
    const hasAccess = await Promise.any(batchIds.map(async batchId => Boolean(lesson.access === 'free' ? await activeEnrollment(req.user._id, batchId) : await paidEnrollment(req.user._id, batchId)))).catch(() => false)
    if (!hasAccess) return res.status(403).json({ message: 'Active paid enrollment required' })
    const progress = Math.max(0, Math.min(100, Number(req.body.progress) || 0))
    const item = await LessonProgress.findOneAndUpdate({ student: req.user._id, lesson: lesson._id }, { completed: Boolean(req.body.completed), progress }, { new: true, upsert: true, setDefaultsOnInsert: true })
    res.json(item)
  } catch (error) { next(error) }
})

module.exports = router
