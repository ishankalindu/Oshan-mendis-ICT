require('dotenv').config()
const mongoose = require('mongoose')
const crypto = require('crypto')
const connectDatabase = require('../src/config/database')
const { AcademicYear, Batch, Enrollment, Payment, ZoomClass } = require('../src/models/AcademicContent')
const User = require('../src/models/User')

async function seed() {
  await connectDatabase()
  const previousYear = await AcademicYear.findOne({ year: 2026 })
  if (previousYear) {
    await AcademicYear.updateOne({ _id: previousYear._id }, { $set: { active: false } })
    await Batch.updateMany({ year: previousYear._id }, { $set: { status: 'archived', enrollmentOpen: false } })
  }

  for (const year of [2027, 2028, 2029]) {
    const academicYear = await AcademicYear.findOneAndUpdate({ year }, { $set: { active: true } }, { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true })
    await Batch.findOneAndUpdate({ year: academicYear._id }, { $set: {
      name: { en: `${year} A/L ICT`, si: `${year} උසස් පෙළ ICT` },
      description: { en: `Academic batch for ${year} A/L ICT students.`, si: `${year} උසස් පෙළ ICT සිසුන් සඳහා අධ්‍යයන කණ්ඩායම.` },
      status: 'active', enrollmentOpen: true,
    }, $setOnInsert: {
      year: academicYear._id,
    } }, { upsert: true, returnDocument: 'after' })
  }
  const existingStudents = await User.find({ role: 'student', $or: [{ studentId: { $exists: false } }, { studentId: null }, { studentId: '' }] }).select('_id')
  for (const student of existingStudents) await User.updateOne({ _id: student._id, $or: [{ studentId: { $exists: false } }, { studentId: null }, { studentId: '' }] }, { $set: { studentId: `OM${new Date().getFullYear()}${crypto.randomBytes(4).toString('hex').toUpperCase()}` } })
  const enrollments = await Enrollment.find().select('_id student batch')
  for (const enrollment of enrollments) {
    const payment = await Payment.findOne({ student: enrollment.student, batch: enrollment.batch }).sort({ date: -1, createdAt: -1 })
    await Enrollment.updateOne({ _id: enrollment._id }, { $set: { paymentStatus: payment?.status || 'pending', payment: payment?.status === 'paid' ? payment._id : null } })
  }
  await ZoomClass.updateMany({ published: { $exists: false } }, { $set: { published: true } })
  console.log('Initial academic years and batches are ready.')
}

seed().catch(error => { console.error('Could not seed academic batches:', error.message); process.exitCode = 1 }).finally(() => mongoose.disconnect())
