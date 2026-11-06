const router = require('express').Router()
const fs = require('fs')
const { authenticate, authorize } = require('../middleware/auth')
const { TuteSubmission, Batch, AuditLog } = require('../models/AcademicContent')
const User = require('../models/User')
const { resolveStoredPaper } = require('../middleware/studentPaperFiles')

router.use(authenticate, authorize('admin'))

router.get('/filters', async (_req, res, next) => {
  try {
    const [studentIds, batchIds] = await Promise.all([TuteSubmission.distinct('student'), TuteSubmission.distinct('batch')])
    const [students, batches] = await Promise.all([
      User.find({ _id: { $in: studentIds } }).select('name email studentId').sort('name').lean(),
      Batch.find({ _id: { $in: batchIds } }).select('name year subject').populate('year', 'year').sort('year').lean(),
    ])
    res.json({ students, batches })
  } catch (error) { next(error) }
})

router.get('/', async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25))
    const filter = {}
    if (req.query.studentId) filter.student = req.query.studentId
    if (req.query.batchId) filter.batch = req.query.batchId
    if (['submitted', 'reviewed'].includes(req.query.status)) filter.status = req.query.status
    if (req.query.tuteNumber) filter.tuteNumber = new RegExp(String(req.query.tuteNumber).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    if (req.query.from || req.query.to) {
      const range = {}
      if (req.query.from) {
        const from = new Date(`${req.query.from}T00:00:00.000Z`)
        if (Number.isNaN(from.getTime())) return res.status(400).json({ message: 'Choose a valid start date' })
        range.$gte = from
      }
      if (req.query.to) {
        const to = new Date(`${req.query.to}T23:59:59.999Z`)
        if (Number.isNaN(to.getTime())) return res.status(400).json({ message: 'Choose a valid end date' })
        range.$lte = to
      }
      filter.submittedAt = range
    }
    if (req.query.search) {
      const escaped = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escaped, 'i')
      const matchingStudents = await User.find({ $or: [{ name: regex }, { email: regex }, { studentId: regex }] }).distinct('_id')
      filter.$or = [{ student: { $in: matchingStudents } }, { studentName: regex }, { studentId: regex }, { tuteNumber: regex }, { tuteName: regex }, { pdfName: regex }]
    }
    const [items, total] = await Promise.all([
      TuteSubmission.find(filter).populate('student', 'name email studentId').populate({ path: 'batch', select: 'name year subject', populate: { path: 'year', select: 'year' } }).sort({ submittedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      TuteSubmission.countDocuments(filter),
    ])
    res.json({ items, total, page, pages: Math.ceil(total / limit) })
  } catch (error) { next(error) }
})

router.get('/:submissionId/file', async (req, res, next) => {
  try {
    const submission = await TuteSubmission.findById(req.params.submissionId).select('pdfFile pdfName')
    const filePath = submission && resolveStoredPaper(submission.pdfFile)
    if (!submission || !filePath || !fs.existsSync(filePath)) return res.status(404).json({ message: 'Tute submission not found' })
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${String(submission.pdfName).replace(/[\r\n"\\]/g, '_')}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
    res.sendFile(filePath, error => { if (error && !res.headersSent) next(error) })
  } catch (error) { next(error) }
})

router.patch('/:submissionId/status', async (req, res, next) => {
  try {
    if (!['submitted', 'reviewed'].includes(req.body.status)) return res.status(400).json({ message: 'Status must be Submitted or Reviewed' })
    const submission = await TuteSubmission.findByIdAndUpdate(req.params.submissionId, { $set: { status: req.body.status } }, { new: true, runValidators: true })
    if (!submission) return res.status(404).json({ message: 'Tute submission not found' })
    await AuditLog.create({ actor: req.user._id, action: 'tute_submission_status_changed', entity: 'TuteSubmission', entityId: String(submission._id), details: { status: submission.status } }).catch(() => {})
    res.json(submission)
  } catch (error) { next(error) }
})

router.delete('/:submissionId', async (req, res, next) => {
  try {
    const submission = await TuteSubmission.findByIdAndDelete(req.params.submissionId)
    if (!submission) return res.status(404).json({ message: 'Tute submission not found' })
    const filePath = resolveStoredPaper(submission.pdfFile)
    if (filePath) await fs.promises.unlink(filePath).catch(() => {})
    await AuditLog.create({ actor: req.user._id, action: 'tute_submission_deleted', entity: 'TuteSubmission', entityId: String(submission._id), details: { studentId: submission.studentId, tuteNumber: submission.tuteNumber } }).catch(() => {})
    res.status(204).end()
  } catch (error) { next(error) }
})

module.exports = router
