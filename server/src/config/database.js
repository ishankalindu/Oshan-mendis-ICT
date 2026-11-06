const dns = require('dns')
const mongoose = require('mongoose')

function configuredLookup() {
  const resolver = dns.promises

  return (hostname, options, callback) => {
    const family = typeof options === 'number' ? options : options?.family || 0
    const all = typeof options === 'object' && Boolean(options?.all)
    const lookups = []
    if (family !== 6) lookups.push(resolver.resolve4(hostname).then(addresses => addresses.map(address => ({ address, family: 4 })), () => []))
    if (family !== 4) lookups.push(resolver.resolve6(hostname).then(addresses => addresses.map(address => ({ address, family: 6 })), () => []))

    Promise.all(lookups).then(groups => {
      const addresses = groups.flat()
      if (!addresses.length) throw Object.assign(new Error(`DNS returned no addresses for ${hostname}`), { code: 'ENOTFOUND' })
      if (all) return callback(null, addresses)
      const preferred = addresses.find(address => address.family === (family || 4)) || addresses[0]
      callback(null, preferred.address, preferred.family)
    }).catch(error => callback(error))
  }
}

async function connectDatabase() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI is required')
  const options = { serverSelectionTimeoutMS: Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS) || 10000 }
  if (uri.startsWith('mongodb+srv://')) {
    const dnsServers = (process.env.MONGODB_DNS_SERVERS || '').split(',').map(server => server.trim()).filter(Boolean)
    if (dnsServers.length) {
      // The MongoDB driver uses SRV/TXT lookup for Atlas, then dns.lookup for
      // shard hosts. Node's dns.setServers only affects resolve* calls, so
      // supply the same resolver for both stages when explicitly configured.
      dns.setServers(dnsServers)
      options.lookup = configuredLookup()
    }
  }
  mongoose.set('strictQuery', true)
  await mongoose.connect(uri, options)
  console.log('MongoDB connected')
}

module.exports = connectDatabase
