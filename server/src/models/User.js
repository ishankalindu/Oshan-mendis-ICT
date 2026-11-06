const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const userSchema = new mongoose.Schema({
  studentId: { type: String, unique: true, sparse: true },
  name: { type: String, required: true, trim: true, maxlength: 120 }, email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  username: { type: String, trim: true, lowercase: true, unique: true, sparse: true, minlength: 3, maxlength: 32, match: /^[a-z0-9._-]+$/ },
  password: { type: String, required: true, select: false }, role: { type: String, enum: ['student', 'admin'], default: 'student', immutable: true },
  city: { type: String, trim: true, maxlength: 100, default: '' }, address: { type: String, trim: true, maxlength: 500, default: '' }, phone: { type: String, trim: true, maxlength: 30, default: '' },
  profilePhoto: { type: String, trim: true, default: '' },
  active: { type: Boolean, default: true }, resetToken: String, resetTokenExpires: Date
}, { timestamps: true })
userSchema.pre('validate', function() {
  if (this.role === 'student' && !this.studentId) this.studentId = `OM${new Date().getFullYear()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`
})
userSchema.pre('save', async function() { if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12) })
userSchema.methods.comparePassword = function(password) { return bcrypt.compare(password, this.password) }
module.exports = mongoose.model('User', userSchema)
