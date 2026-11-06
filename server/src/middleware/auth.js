const jwt = require('jsonwebtoken')
const User = require('../models/User')
exports.authenticate = async (req, res, next) => {
  try { const token = req.cookies?.access_token || req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ message: 'Authentication required' })
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET)
    const user = await User.findById(payload.sub).select('+password')
    if (!user || !user.active) return res.status(401).json({ message: 'Invalid account' })
    req.user = user; next()
  } catch { res.status(401).json({ message: 'Invalid or expired token' }) }
}
exports.authorize = (...roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Insufficient permissions' })
