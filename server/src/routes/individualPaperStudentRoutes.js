const router = require('express').Router()
const fs = require('fs')
const { authenticate, authorize } = require('../middleware/auth')
const { IndividualStudentPaper, StudentPaperCategory } = require('../models/AcademicContent')
const { resolveStoredPaper } = require('../middleware/studentPaperFiles')
const { hasApprovedEnrollment } = require('../middleware/studentPaperEligibility')

router.use(authenticate, authorize('student'))

router.get('/', async (req, res, next) => {
  try {
    if (!await hasApprovedEnrollment(req.user._id)) return res.status(403).json({ message: 'An active enrollment with an approved payment is required to access assigned papers' })
    const [categories, items] = await Promise.all([
      StudentPaperCategory.find({ student: req.user._id }).sort('createdAt').lean(),
      IndividualStudentPaper.find({ student: req.user._id }).sort({ uploadDate: -1, createdAt: -1 }).select('title subject description pdfName uploadDate createdAt category').lean(),
    ])
    const categoriesWithPapers = categories.map(category => ({ ...category, papers: items.filter(item => String(item.category) === String(category._id)) }))
    res.set('Cache-Control', 'private, no-store')
    res.json({ categories: categoriesWithPapers, items })
  } catch (error) { next(error) }
})

router.get('/:paperId/file', async (req, res, next) => {
  try {
    if (!await hasApprovedEnrollment(req.user._id)) return res.status(403).json({ message: 'An active enrollment with an approved payment is required to access assigned papers' })
    // Scope the database lookup to the authenticated account. A paper ID alone
    // is never enough to retrieve another student's file.
    const paper = await IndividualStudentPaper.findOne({ _id: req.params.paperId, student: req.user._id })
    const filePath = paper && resolveStoredPaper(paper.pdfFile)
    if (!paper || !filePath || !fs.existsSync(filePath)) return res.status(404).json({ message: 'Paper not found' })
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="${String(paper.pdfName).replace(/[\r\n"\\]/g, '_')}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' })
    res.sendFile(filePath, error => { if (error && !res.headersSent) next(error) })
  } catch (error) { next(error) }
})

module.exports = router
