const { Enrollment, Payment } = require('../models/AcademicContent')

async function eligibleStudentIds(studentIds) {
  if (!studentIds.length) return new Set()
  const now = new Date()
  const enrollments = await Enrollment.find({
    student: { $in: studentIds }, status: 'active', paymentStatus: 'paid', payment: { $ne: null },
    $and: [
      { $or: [{ accessFrom: null }, { accessFrom: { $lte: now } }] },
      { $or: [{ accessUntil: null }, { accessUntil: { $gte: now } }] },
    ],
  }).select('student batch payment')
  if (!enrollments.length) return new Set()
  const payments = await Payment.find({ _id: { $in: enrollments.map(item => item.payment) }, status: 'paid' }).select('_id student batch')
  return new Set(payments.filter(payment => enrollments.some(enrollment =>
    String(enrollment.payment) === String(payment._id) && String(enrollment.student) === String(payment.student) && String(enrollment.batch) === String(payment.batch)
  )).map(payment => String(payment.student)))
}

async function hasApprovedEnrollment(studentId) {
  return (await eligibleStudentIds([studentId])).has(String(studentId))
}

module.exports = { eligibleStudentIds, hasApprovedEnrollment }
