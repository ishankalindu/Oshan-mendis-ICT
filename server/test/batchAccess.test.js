require('dotenv').config()
const test = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const mongoose = require('mongoose')
const app = require('../src/app')
const connectDatabase = require('../src/config/database')
const User = require('../src/models/User')
const { AcademicYear, Batch, Enrollment, Payment, LearningResource, StudentProfile, AuditLog } = require('../src/models/AcademicContent')

test('batch resources follow enrollment and verified payment status', async () => {
  await connectDatabase()
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const api = `http://127.0.0.1:${server.address().port}/api`
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const created = { users: [], batches: [], resources: [], payments: [], enrollments: [], profiles: [], years: [] }
  const headersFor = user => ({ Authorization: `Bearer ${jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET)}`, 'Content-Type': 'application/json' })
  async function request(path, user, body) {
    return fetch(`${api}${path}`, { method: body ? 'POST' : 'GET', headers: headersFor(user), ...(body ? { body: JSON.stringify(body) } : {}) })
  }
  async function loadBatchResources(user, batchId) {
    const response = await request(`/student/resources/${batchId}`, user)
    assert.equal(response.status, 200)
    return response.json()
  }

  try {
    const year = await AcademicYear.create({ year: 30000 + Math.floor(Math.random() * 60000) })
    created.years.push(year._id)
    const [ampara, colombo] = await Batch.create([
      { year: year._id, name: { en: `Integration ${suffix} Ampara` }, subject: 'A/L ICT', city: 'Ampara', fee: 1000, status: 'active' },
      { year: year._id, name: { en: `Integration ${suffix} Colombo` }, subject: 'A/L ICT', city: 'Colombo', fee: 1000, status: 'active' },
    ])
    created.batches.push(ampara._id, colombo._id)
    const [admin, paidStudent, pendingStudent, rejectedStudent] = await User.create([
      { name: 'Batch test admin', email: `admin-${suffix}@example.test`, password: `Password-${suffix}`, role: 'admin' },
      { name: 'Paid test student', email: `paid-${suffix}@example.test`, password: `Password-${suffix}`, role: 'student' },
      { name: 'Pending test student', email: `pending-${suffix}@example.test`, password: `Password-${suffix}`, role: 'student' },
      { name: 'Rejected test student', email: `rejected-${suffix}@example.test`, password: `Password-${suffix}`, role: 'student' },
    ])
    created.users.push(admin._id, paidStudent._id, pendingStudent._id, rejectedStudent._id)

    for (const student of [paidStudent, pendingStudent, rejectedStudent]) {
      const profile = await StudentProfile.create({ user: student._id, batches: [ampara._id], phone: '' })
      const enrollment = await Enrollment.create({ student: student._id, batch: ampara._id })
      created.profiles.push(profile._id)
      created.enrollments.push(enrollment._id)
    }
    const otherBatchEnrollment = await Enrollment.create({ student: paidStudent._id, batch: colombo._id })
    created.enrollments.push(otherBatchEnrollment._id)

    const [paidEnrollment, pendingEnrollment, rejectedEnrollment] = await Enrollment.find({ batch: ampara._id }).sort('createdAt')
    const [paidPayment, pendingPayment, rejectedPayment] = await Payment.create([
      { student: paidStudent._id, batch: ampara._id, enrollment: paidEnrollment._id, amount: 1000, status: 'paid', verifiedBy: admin._id, verifiedAt: new Date() },
      { student: pendingStudent._id, batch: ampara._id, enrollment: pendingEnrollment._id, amount: 1000, status: 'pending' },
      { student: rejectedStudent._id, batch: ampara._id, enrollment: rejectedEnrollment._id, amount: 1000, status: 'pending' },
    ])
    created.payments.push(paidPayment._id, pendingPayment._id, rejectedPayment._id)
    paidEnrollment.paymentStatus = 'paid'; paidEnrollment.payment = paidPayment._id; await paidEnrollment.save()
    pendingEnrollment.payment = pendingPayment._id; await pendingEnrollment.save()
    rejectedEnrollment.payment = rejectedPayment._id; await rejectedEnrollment.save()

    const resource = await LearningResource.create({ title: { en: `Private ${suffix}` }, type: 'pdf', fileUrl: 'storage:missing.pdf', fileName: 'lesson.pdf', batch: [ampara._id], published: true, access: 'restricted' })
    const otherResource = await LearningResource.create({ title: { en: `Other batch ${suffix}` }, type: 'pdf', fileUrl: 'storage:missing-other.pdf', batch: [colombo._id], published: true, access: 'restricted' })
    created.resources.push(resource._id, otherResource._id)

    const overviewResponse = await request('/admin/dashboard', admin)
    assert.equal(overviewResponse.status, 200)
    const overview = await overviewResponse.json()
    assert.ok(overview.resourcesByBatch.some(item => item.id === String(ampara._id) && item.count >= 1))
    assert.ok(overview.studentsByBatch.some(item => item.batch.includes('Ampara') && item.count >= 3))

    const paidView = await loadBatchResources(paidStudent, ampara._id)
    assert.equal(paidView.accessGranted, true)
    assert.equal(paidView.resources[0].locked, false)

    const pendingView = await loadBatchResources(pendingStudent, ampara._id)
    assert.equal(pendingView.accessGranted, false)
    assert.equal(pendingView.resources[0].locked, true)
    assert.equal('fileUrl' in pendingView.resources[0], false)
    const pendingFile = await request(`/student/files/${resource._id}`, pendingStudent)
    assert.equal(pendingFile.status, 403)
    const duplicateSubmission = await request('/student/payments', pendingStudent, { batch: ampara._id, amount: 1000, reference: 'duplicate' })
    assert.equal(duplicateSubmission.status, 409)

    const wrongBatch = await request(`/student/resources/${colombo._id}`, pendingStudent)
    assert.equal(wrongBatch.status, 403)
    const paidWrongBatchView = await loadBatchResources(paidStudent, colombo._id)
    assert.equal(paidWrongBatchView.accessGranted, false)
    assert.equal(paidWrongBatchView.resources[0].locked, true)

    const approval = await fetch(`${api}/admin/payments/${pendingPayment._id}/verify`, { method: 'POST', headers: headersFor(admin), body: JSON.stringify({ status: 'paid' }) })
    assert.equal(approval.status, 200)
    const approvalBody = await approval.json()
    assert.equal(String(approvalBody.payment.verifiedBy), String(admin._id))
    assert.ok(approvalBody.payment.verifiedAt)
    const approvedView = await loadBatchResources(pendingStudent, ampara._id)
    assert.equal(approvedView.accessGranted, true)

    const addedLater = await LearningResource.create({ title: { en: `Added after approval ${suffix}` }, type: 'note', fileUrl: 'storage:later.pdf', batch: [ampara._id], published: true, access: 'restricted' })
    created.resources.push(addedLater._id)
    const refreshedView = await loadBatchResources(pendingStudent, ampara._id)
    assert.equal(refreshedView.resources.some(item => String(item._id) === String(addedLater._id) && !item.locked), true)

    const rejection = await fetch(`${api}/admin/payments/${rejectedPayment._id}/verify`, { method: 'POST', headers: headersFor(admin), body: JSON.stringify({ status: 'rejected', rejectionReason: 'Test receipt was not valid' }) })
    assert.equal(rejection.status, 200)
    const rejectedView = await loadBatchResources(rejectedStudent, ampara._id)
    assert.equal(rejectedView.accessGranted, false)
    assert.equal(rejectedView.resources.every(item => item.locked), true)
    const incorrectAmount = await request('/student/payments', rejectedStudent, { batch: ampara._id, amount: 900, reference: 'wrong amount' })
    assert.equal(incorrectAmount.status, 400)
    const resubmission = await request('/student/payments', rejectedStudent, { batch: ampara._id, amount: 1000, reference: `receipt-${suffix}` })
    assert.equal(resubmission.status, 201)
    const resubmissionBody = await resubmission.json()
    created.payments.push(resubmissionBody.id)
    const resubmittedView = await loadBatchResources(rejectedStudent, ampara._id)
    assert.equal(resubmittedView.accessGranted, false)

    const revocation = await fetch(`${api}/admin/payments/${paidPayment._id}/verify`, { method: 'POST', headers: headersFor(admin), body: JSON.stringify({ status: 'rejected', rejectionReason: 'Test access revocation' }) })
    assert.equal(revocation.status, 200)
    const revokedFile = await request(`/student/files/${resource._id}`, paidStudent)
    assert.equal(revokedFile.status, 403)
    const revokedView = await loadBatchResources(paidStudent, ampara._id)
    assert.equal(revokedView.accessGranted, false)
  } finally {
    await Promise.all([
      LearningResource.deleteMany({ _id: { $in: created.resources } }),
      Payment.deleteMany({ _id: { $in: created.payments } }),
      Enrollment.deleteMany({ _id: { $in: created.enrollments } }),
      StudentProfile.deleteMany({ _id: { $in: created.profiles } }),
      AuditLog.deleteMany({ actor: { $in: created.users } }),
      User.deleteMany({ _id: { $in: created.users } }),
      Batch.deleteMany({ _id: { $in: created.batches } }),
      AcademicYear.deleteMany({ _id: { $in: created.years } }),
    ])
    await new Promise(resolve => server.close(resolve))
    await mongoose.disconnect()
  }
})
