require('dotenv').config()
const connectDatabase = require('../src/config/database')
const User = require('../src/models/User')

async function setAdminPassword() {
  const email = process.env.ADMIN_EMAIL || 'admin@gmail.com'
  const password = process.env.NEW_ADMIN_PASSWORD
  if (!password) throw new Error('Set NEW_ADMIN_PASSWORD for this command')
  if (password.length < 8) throw new Error('Admin password must be at least 8 characters')

  await connectDatabase()
  const admin = await User.findOne({ email: email.toLowerCase(), role: 'admin' })
  if (!admin) throw new Error('Administrator account was not found')
  admin.password = password
  await admin.save()
  console.log('Administrator password updated')
}

setAdminPassword().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1) })
