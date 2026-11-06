const router = require('express').Router()
const rateLimit = require('express-rate-limit')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const User = require('../models/User')
const { Batch, StudentProfile, Enrollment } = require('../models/AcademicContent')
const { authenticate, authorize } = require('../middleware/auth')
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true })
const tokenFor = user => jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' })
router.get('/batches', async (_req, res, next) => { try { const batches = await Batch.find({ status: 'active', enrollmentOpen: true }).populate('year', 'year').sort('year'); res.json(batches.map(batch => ({ id: batch.id, name: batch.name, year: batch.year?.year, subject: batch.subject, city: batch.city, className: batch.className, fee: batch.fee, description: batch.description }))) } catch (error) { next(error) } })
router.post('/register', limiter, async (req, res, next) => {
  try {
    const { name, email, password, confirmPassword, batch: batchId, city, address, phone } = req.body
    if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !email.trim() || typeof password !== 'string' || typeof confirmPassword !== 'string' || !batchId || typeof city !== 'string' || !city.trim() || typeof address !== 'string' || !address.trim()) return res.status(400).json({ message: 'Name, email, password, confirmation, academic batch, city, and home address are required' })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return res.status(400).json({ message: 'Enter a valid email address' })
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' })
    if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match' })
    const batch = await Batch.findOne({ _id: batchId, status: 'active', enrollmentOpen: true })
    if (!batch) return res.status(400).json({ message: 'Choose an open academic batch' })
    const user = await User.create({ name, email: email.trim().toLowerCase(), password, city, address: address.trim(), phone, role: 'student' })
    await Promise.all([
      StudentProfile.create({ user: user._id, batches: [batch._id], phone }),
      Enrollment.create({ student: user._id, batch: batch._id }),
    ])
    const token = tokenFor(user)
    res.cookie('access_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 15 * 60 * 1000 })
    res.status(201).json({ token, user: { id: user.id, studentId: user.studentId, name: user.name, email: user.email, city: user.city, address: user.address, phone: user.phone, role: user.role } })
  } catch (error) { next(error) }
})
router.post('/login', limiter, async (req, res, next) => { try { const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''; const password = typeof req.body.password === 'string' ? req.body.password : ''; if (!email || !password) return res.status(400).json({ message: 'Email and password are required' }); const user = await User.findOne({ email }).select('+password'); if (!user || !user.active || !(await user.comparePassword(password))) return res.status(401).json({ message: 'Invalid email or password' }); const token = tokenFor(user); res.cookie('access_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 15 * 60 * 1000 }); res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } }) } catch (error) { next(error) } })
router.post('/admin/login', limiter, async (req, res, next) => {
  try {
    const identifier = typeof req.body.identifier === 'string' ? req.body.identifier.trim().toLowerCase() : typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const password = typeof req.body.password === 'string' ? req.body.password : ''
    if (!identifier || !password) return res.status(400).json({ message: 'Username or email and password are required' })
    const user = await User.findOne({ role: 'admin', $or: [{ email: identifier }, { username: identifier }] }).select('+password')
    if (!user || !user.active || !(await user.comparePassword(password))) return res.status(401).json({ message: 'Invalid administrator credentials' })
    const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET, { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' })
    res.cookie('access_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', maxAge: 15 * 60 * 1000 })
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, username: user.username, role: user.role } })
  } catch (error) { next(error) }
})
router.post('/logout', (_req, res) => res.clearCookie('access_token').json({ message: 'Logged out' }))
router.get('/me', authenticate, (req, res) => res.json({ id: req.user.id, studentId: req.user.studentId, name: req.user.name, email: req.user.email, city: req.user.city, address: req.user.address, phone: req.user.phone, role: req.user.role }))
router.post('/forgot-password', limiter, async (req, res, next) => { try { const user = await User.findOne({ email: req.body.email }); if (user) { user.resetToken = crypto.randomBytes(32).toString('hex'); user.resetTokenExpires = Date.now() + 3600000; await user.save({ validateBeforeSave: false }) }; res.json({ message: 'If the account exists, password reset instructions will be sent.' }) } catch (error) { next(error) } })
module.exports = router
