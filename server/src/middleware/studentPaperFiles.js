const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const multer = require('multer')

const storageDirectory = path.resolve(process.env.STORAGE_DIR || path.join(__dirname, '../../private-uploads'))
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => fs.mkdir(storageDirectory, { recursive: true }, error => callback(error, error ? undefined : storageDirectory)),
    filename: (_req, _file, callback) => {
      try { callback(null, `student-paper-${crypto.randomUUID()}.pdf`) }
      catch (error) { callback(error) }
    },
  }),
  limits: { fileSize: 30 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, callback) => {
    if (file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf') return callback(null, true)
    const error = new Error('Only PDF files are supported')
    error.status = 400
    error.code = 'INVALID_FILE_TYPE'
    callback(error)
  },
})

function withUploadCleanup(middleware) {
  return (req, res, next) => middleware(req, res, error => {
    if (!error) return next()
    const files = [...(req.files || []), ...(req.file ? [req.file] : [])]
    Promise.all(files.map(file => fs.promises.unlink(file.path).catch(() => {}))).finally(() => next(error))
  })
}

async function isPdf(filePath) {
  const handle = await fs.promises.open(filePath, 'r')
  try {
    const header = Buffer.alloc(5)
    const { bytesRead } = await handle.read(header, 0, header.length, 0)
    return bytesRead === 5 && header.toString('ascii') === '%PDF-'
  } finally {
    await handle.close()
  }
}

function resolveStoredPaper(filename) {
  const safeName = path.basename(filename || '')
  if (!safeName.startsWith('student-paper-') || !safeName.endsWith('.pdf')) return null
  const filePath = path.resolve(storageDirectory, safeName)
  return filePath.startsWith(`${storageDirectory}${path.sep}`) ? filePath : null
}

module.exports = { storageDirectory, upload, withUploadCleanup, isPdf, resolveStoredPaper }
