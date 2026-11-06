require('dotenv').config()
const connectDatabase = require('../src/config/database')
const User = require('../src/models/User')

async function setAdminUsername() {
  await connectDatabase()
  const admins = await User.find({ role: 'admin' }).select('email username')
  if (!admins.length) throw new Error('No administrator account was found')

  const customUsername = process.env.ADMIN_USERNAME?.trim().toLowerCase()
  if (customUsername && admins.length !== 1) throw new Error('Set ADMIN_USERNAME only when there is exactly one administrator')

  for (const admin of admins) {
    const base = customUsername || admin.username || admin.email.split('@')[0]
    if (!/^[a-z0-9._-]{3,32}$/.test(base)) throw new Error('The username must be 3–32 characters using letters, numbers, dots, underscores, or hyphens')
    let username = base
    let suffix = 2
    while (await User.exists({ username, _id: { $ne: admin._id } })) {
      if (customUsername) throw new Error(`Username "${username}" is already in use`)
      username = `${base.slice(0, 32 - String(suffix).length - 1)}-${suffix++}`
    }
    if (admin.username !== username) {
      admin.username = username
      await admin.save()
    }
  }

  console.log(`Username ready for ${admins.length} administrator account(s)`)
}

setAdminUsername().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1) })
