const app = require('./app')
const connectDatabase = require('./config/database')
const mongoose = require('mongoose')
const port = Number(process.env.PORT || 5000)
const redactMongoUri = value => String(value || '').replace(/mongodb(?:\+srv)?:\/\/[^\s]+/gi, '[MongoDB URI redacted]')

function describeConnectionFailure(error) {
  const details = []
  for (const [address, server] of error.reason?.servers || []) {
    const cause = server.error
    if (cause) details.push(`${address}: ${cause.code || cause.name}${cause.message ? ` (${redactMongoUri(cause.message.split('\n')[0])})` : ''}`)
  }
  const cause = error.cause
  if (cause?.code) details.push(`${cause.code}${cause.message ? ` (${redactMongoUri(cause.message.split('\n')[0])})` : ''}`)
  return [...new Set(details)].join('; ')
}

const server = app.listen(port, () => console.log(`Server listening on ${port}`))
server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Cannot listen on port ${port}: it is already in use. Stop duplicate server processes before starting another instance.`)
  } else {
    console.error(`HTTP server failed to listen on port ${port}:`, redactMongoUri(error.message))
  }
  process.exit(1)
})

mongoose.connection.on('disconnected', () => console.error('MongoDB connection lost; the API remains available and database connection will be retried by the driver.'))
mongoose.connection.on('error', error => console.error('MongoDB connection error:', redactMongoUri(error.message)))

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
async function connectWithRetry() {
  let retryDelay = 1000
  while (mongoose.connection.readyState !== 1) {
    try {
      await connectDatabase()
    } catch (error) {
      const detail = describeConnectionFailure(error)
      console.error('Database connection failed:', detail || `${error.name}: ${redactMongoUri(error.message.split('\n')[0])}`)
      console.error(`API is listening on port ${port}; MongoDB retry in ${retryDelay} ms. Check Atlas credentials, cluster status, IP access list, and outbound DNS/TCP access.`)
      await wait(retryDelay)
      retryDelay = Math.min(retryDelay * 2, 30000)
    }
  }
}

connectWithRetry().catch(error => {
  console.error('Unexpected database connection supervisor error:', redactMongoUri(error.message))
})
