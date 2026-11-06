require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') })
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')
const morgan = require('morgan')
const mongoose = require('mongoose')
const authRoutes = require('./routes/authRoutes')
const contentRoutes = require('./routes/contentRoutes')
const studentRoutes = require('./routes/studentRoutes')
const individualPaperAdminRoutes = require('./routes/individualPaperAdminRoutes')
const individualPaperStudentRoutes = require('./routes/individualPaperStudentRoutes')
const adminTuteSubmissionRoutes = require('./routes/adminTuteSubmissionRoutes')
const studentTuteSubmissionRoutes = require('./routes/studentTuteSubmissionRoutes')
const { SiteSettings } = require('./models/AcademicContent')
const app = express()
const path = require('path')
const fs = require('fs')
const publicUploadDirectory = path.resolve(process.env.PUBLIC_UPLOAD_DIR || path.join(__dirname, '../public-uploads'))
fs.mkdirSync(publicUploadDirectory, { recursive: true })
const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://localhost:5173')
  .split(',').map(value => value.trim().replace(/\/$/, '')).filter(Boolean)
const isLocalClientOrigin = origin => {
  if (process.env.NODE_ENV === 'production') return false
  try {
    const url = new URL(origin)
    return ['localhost', '127.0.0.1'].includes(url.hostname) && ['5173', '5174'].includes(url.port)
  } catch { return false }
}
app.use(helmet())
app.use(cors({ origin: (origin, cb) => !origin || allowedOrigins.includes(origin.replace(/\/$/, '')) || isLocalClientOrigin(origin) ? cb(null, true) : cb(new Error('Origin not allowed')), credentials: true }))
app.use(cookieParser())
app.use(express.json({ limit: '1mb' }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))
app.use('/uploads', express.static(publicUploadDirectory))
app.get('/api/health', (_req, res) => {
  const databaseReady = mongoose.connection.readyState === 1
  res.status(databaseReady ? 200 : 503).json({
    status: databaseReady ? 'ok' : 'degraded',
    service: 'OSHAN MENDIS ICT API',
    database: databaseReady ? 'connected' : 'unavailable',
    timestamp: new Date().toISOString(),
  })
})
app.get('/api/settings', async (_req, res, next) => {
  try {
    const keys = ['displayName', 'contactEmail', 'homepageTextEn', 'homepageTextSi', 'teacherProfile']
    const settings = await SiteSettings.find({ key: { $in: keys } }).select('key value -_id')
    res.json(Object.fromEntries(settings.map(item => [item.key, item.value])))
  } catch (error) { next(error) }
})
app.use('/api/auth', authRoutes)
app.use('/api/admin', contentRoutes)
app.use('/api/student', studentRoutes)
app.use('/api/admin/individual-papers', individualPaperAdminRoutes)
app.use('/api/student/papers', individualPaperStudentRoutes)
app.use('/api/admin/tute-submissions', adminTuteSubmissionRoutes)
app.use('/api/student/tute-submissions', studentTuteSubmissionRoutes)
app.use((req, res) => res.status(404).json({ message: `Route ${req.method} ${req.path} not found` }))
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)
  const multerError = error instanceof require('multer').MulterError
  const databaseUnavailable = ['MongoNetworkError', 'MongoServerSelectionError', 'MongoTopologyClosedError'].includes(error.name) || mongoose.connection.readyState !== 1
  let status = 500
  let message = 'Internal server error'
  if (databaseUnavailable) {
    status = 503
    message = 'Database temporarily unavailable. Please try again shortly.'
  } else if (error.name === 'ValidationError' || error.name === 'CastError' || multerError || error.status === 400) {
    status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    message = error.code === 'INVALID_FILE_TYPE' ? 'Only PDF files are supported' : error.message
  } else if (error.code === 11000) {
    status = 409
    message = 'A record with these details already exists'
  } else if (error.code === 'ENOSPC') {
    status = 507
    message = 'The server has run out of storage space'
  } else if (Number.isInteger(error.status) && error.status >= 400 && error.status < 600) {
    status = error.status
    message = error.message
  }
  const safeMessage = String(error.message || '').replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, '[MongoDB URI redacted]')
  if (status >= 500) console.error(`API ${req.method} ${req.path} failed (${status}):`, safeMessage, error.stack)
  else console.warn(`API ${req.method} ${req.path} rejected (${status}):`, safeMessage)
  res.status(status).json({ message })
})
module.exports = app
