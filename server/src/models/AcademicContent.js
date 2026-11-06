const mongoose = require('mongoose')
const localized = new mongoose.Schema({ en: { type: String, default: '' }, si: { type: String, default: '' } }, { _id: false })
const timestamps = { timestamps: true }
module.exports = {
  AcademicYear: mongoose.model('AcademicYear', new mongoose.Schema({ year: { type: Number, required: true, unique: true }, active: { type: Boolean, default: true } }, timestamps)),
  Batch: mongoose.model('Batch', new mongoose.Schema({ name: localized, year: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear', required: true }, subject: { type: String, trim: true, maxlength: 120, default: 'A/L ICT' }, city: { type: String, trim: true, maxlength: 100, default: '' }, className: { type: String, trim: true, maxlength: 120, default: '' }, fee: { type: Number, min: 0, default: 0 }, description: localized, enrollmentOpen: { type: Boolean, default: true }, status: { type: String, enum: ['draft', 'active', 'archived'], default: 'active' }, students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }] }, timestamps)),
  StudentProfile: mongoose.model('StudentProfile', new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, required: true }, batches: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }], phone: String, paidClassFee: { type: Boolean, default: false }, progress: Number }, timestamps)),
  Enrollment: mongoose.model('Enrollment', new mongoose.Schema({ student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true }, status: { type: String, enum: ['active', 'suspended', 'revoked', 'expired'], default: 'active' }, paymentStatus: { type: String, enum: ['pending', 'paid', 'rejected', 'refunded'], default: 'pending' }, payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' }, accessFrom: Date, accessUntil: Date }, { timestamps: true }).index({ student: 1, batch: 1 }, { unique: true })),
  Payment: mongoose.model('Payment', new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true }, enrollment: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment' },
    amount: { type: Number, min: 0, required: true }, method: { type: String, trim: true, default: 'manual' }, date: { type: Date, default: Date.now }, reference: { type: String, trim: true, maxlength: 160 },
    paymentMonth: { type: String, trim: true, match: /^\d{4}-\d{2}$/ },
    slipFile: { type: String, trim: true }, slipName: { type: String, trim: true, maxlength: 255 }, slipUrl: { type: String, trim: true },
    status: { type: String, enum: ['pending', 'paid', 'rejected', 'refunded'], default: 'pending' }, rejectionReason: String, verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, verifiedAt: Date, notes: String
  }, timestamps)
    .index({ student: 1, batch: 1 }, { unique: true, partialFilterExpression: { status: 'pending', paymentMonth: { $exists: false } } })
    .index({ student: 1, batch: 1, paymentMonth: 1 }, { unique: true, partialFilterExpression: { status: { $in: ['pending', 'paid'] } } })),
  IndividualStudentPaper: mongoose.model('IndividualStudentPaper', new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentPaperCategory', default: null, index: true },
    title: { type: String, trim: true, required: true, maxlength: 180 },
    subject: { type: String, trim: true, default: '', maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    pdfFile: { type: String, trim: true, required: true },
    pdfName: { type: String, trim: true, maxlength: 255, required: true },
    uploadDate: { type: Date, default: Date.now, required: true },
  }, timestamps).index({ student: 1, uploadDate: -1 })),
  StudentPaperCategory: mongoose.model('StudentPaperCategory', new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentName: { type: String, trim: true, maxlength: 120, default: '' },
    name: { type: String, trim: true, required: true, maxlength: 100 },
  }, timestamps).index({ student: 1, name: 1 }, { unique: true })),
  TuteSubmission: mongoose.model('TuteSubmission', new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    studentName: { type: String, trim: true, maxlength: 120, required: true },
    studentId: { type: String, trim: true, maxlength: 40, required: true },
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    tuteNumber: { type: String, trim: true, required: true, maxlength: 40 },
    tuteName: { type: String, trim: true, required: true, maxlength: 160 },
    pdfFile: { type: String, trim: true, required: true },
    pdfName: { type: String, trim: true, maxlength: 255, required: true },
    submittedAt: { type: Date, default: Date.now, required: true },
    status: { type: String, enum: ['submitted', 'reviewed'], default: 'submitted', required: true },
  }, timestamps).index({ student: 1, batch: 1, tuteNumber: 1 }, { unique: true }).index({ submittedAt: -1 })),
  Lesson: mongoose.model('Lesson', new mongoose.Schema({ title: localized, description: localized, batch: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }], validate: [items => items.length > 0, 'Select at least one batch'] }, unit: String, topic: String, access: { type: String, enum: ['free', 'restricted'], default: 'restricted' }, published: { type: Boolean, default: false }, order: { type: Number, default: 0 } }, timestamps)),
  YouTubeVideo: mongoose.model('YouTubeVideo', new mongoose.Schema({ title: localized, description: localized, url: { type: String, required: true }, videoId: String, batch: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }], validate: [items => items.length > 0, 'Select at least one batch'] }, lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }, class: { type: mongoose.Schema.Types.ObjectId, ref: 'ZoomClass' }, topic: String, lessonDate: Date, thumbnail: String, published: { type: Boolean, default: false }, access: { type: String, enum: ['free', 'restricted'], default: 'restricted' }, order: { type: Number, default: 0 } }, timestamps)),
  RecordedClass: mongoose.model('RecordedClass', new mongoose.Schema({ title: localized, description: localized, url: String, topic: String, lessonDate: Date, lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }, class: { type: mongoose.Schema.Types.ObjectId, ref: 'ZoomClass' }, batch: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }], validate: [items => items.length > 0, 'Select at least one batch'] }, published: { type: Boolean, default: false }, access: { type: String, enum: ['free', 'restricted'], default: 'restricted' } }, timestamps)),
  LearningResource: mongoose.model('LearningResource', new mongoose.Schema({ title: localized, description: localized, topic: String, lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson' }, class: { type: mongoose.Schema.Types.ObjectId, ref: 'ZoomClass' }, type: { type: String, enum: ['pdf', 'powerpoint', 'past-paper', 'assignment', 'tutorial', 'note', 'question'], required: true }, fileUrl: { type: String, required: true }, fileName: { type: String, trim: true, maxlength: 180 }, batch: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }], validate: [items => items.length > 0, 'Select at least one batch'] }, published: { type: Boolean, default: false }, access: { type: String, enum: ['free', 'restricted'], default: 'restricted' } }, timestamps)),
  ZoomClass: mongoose.model('ZoomClass', new mongoose.Schema({ title: localized, description: localized, batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true }, startsAt: { type: Date, required: true }, endsAt: Date, meetingUrl: String, meetingId: String, passcode: String, access: { type: String, enum: ['free', 'restricted'], default: 'restricted' }, published: { type: Boolean, default: true }, status: { type: String, enum: ['upcoming', 'completed', 'cancelled'], default: 'upcoming' } }, timestamps)),
  Announcement: mongoose.model('Announcement', new mongoose.Schema({ title: localized, body: localized, batch: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Batch' }], published: { type: Boolean, default: true } }, timestamps)),
  LessonProgress: mongoose.model('LessonProgress', new mongoose.Schema({ student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, lesson: { type: mongoose.Schema.Types.ObjectId, required: true }, completed: { type: Boolean, default: false }, progress: { type: Number, min: 0, max: 100, default: 0 } }, { timestamps: true })),
  Notification: mongoose.model('Notification', new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, title: localized, message: localized, read: { type: Boolean, default: false } }, timestamps)),
  AuditLog: mongoose.model('AuditLog', new mongoose.Schema({ actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, action: String, entity: String, entityId: String, details: mongoose.Schema.Types.Mixed }, timestamps)),
  Attendance: mongoose.model('Attendance', new mongoose.Schema({ class: { type: mongoose.Schema.Types.ObjectId, ref: 'ZoomClass', required: true }, student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, status: { type: String, enum: ['present', 'absent'], required: true }, markedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, date: { type: Date, default: Date.now } }, timestamps)),
  SiteSettings: mongoose.model('SiteSettings', new mongoose.Schema({ key: { type: String, unique: true }, value: mongoose.Schema.Types.Mixed }, timestamps))
}
