require('dotenv').config()
const mongoose = require('mongoose')
const connectDatabase = require('../src/config/database')
const { AcademicYear, Batch } = require('../src/models/AcademicContent')

async function syncAcademicBatches() {
  await connectDatabase()

  const previousYear = await AcademicYear.findOne({ year: 2026 })
  if (previousYear) {
    await AcademicYear.updateOne({ _id: previousYear._id }, { $set: { active: false } })
    await Batch.updateMany({ year: previousYear._id }, { $set: { status: 'archived', enrollmentOpen: false } })
  }

  for (const year of [2027, 2028, 2029]) {
    const academicYear = await AcademicYear.findOneAndUpdate(
      { year },
      { $set: { active: true } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    )
    await Batch.findOneAndUpdate(
      { year: academicYear._id },
      {
        $set: {
          name: { en: `${year} A/L ICT`, si: `${year} උසස් පෙළ ICT` },
          description: { en: `Academic batch for ${year} A/L ICT students.`, si: `${year} උසස් පෙළ ICT සිසුන් සඳහා අධ්‍යයන කණ්ඩායම.` },
          status: 'active',
          enrollmentOpen: true,
        },
        $setOnInsert: { year: academicYear._id },
      },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    )
  }

  console.log('Academic batches synced: 2026 archived; 2027–2029 active and open for enrollment.')
}

syncAcademicBatches()
  .catch(error => { console.error('Could not sync academic batches:', error.message); process.exitCode = 1 })
  .finally(() => mongoose.disconnect())
