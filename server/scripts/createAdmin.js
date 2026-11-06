require('dotenv').config()
const connectDatabase = require('../src/config/database')
const User = require('../src/models/User')
async function createAdmin() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env
  if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD are required')
  const username = (process.env.ADMIN_USERNAME || ADMIN_EMAIL.split('@')[0]).trim().toLowerCase()
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new Error('ADMIN_USERNAME must be 3–32 characters using letters, numbers, dots, underscores, or hyphens')
  await connectDatabase()
  const existing = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() })
  if (existing) {
    if (existing.role !== 'admin') throw new Error('This email belongs to a non-admin account')
    if (existing.username !== username) { existing.username = username; await existing.save() }
    console.log('Administrator username is ready')
    process.exit(0)
  }
  await User.create({ name: ADMIN_NAME, email: ADMIN_EMAIL, username, password: ADMIN_PASSWORD, role: 'admin' })
  console.log('Administrator created')
  process.exit(0)
}
createAdmin().catch(error => { console.error(error.message); process.exit(1) })
