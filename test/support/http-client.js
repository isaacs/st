import http from 'node:http'
import https from 'node:https'

export const request = (options, cb) => {
  if (typeof options === 'string') {
    options = { url: options }
  }

  const url = new URL(options.url)
  const protocol = url.protocol === 'https:' ? https : http
  const req = protocol.request(url, {
    agent: options.agent,
    method: options.method || 'GET',
    headers: options.headers || {}
  }, (res) => {
    const chunks = []
    res.on('data', (chunk) => chunks.push(chunk))
    res.on('end', () => cb(null, res, Buffer.concat(chunks)))
  })

  req.on('error', (er) => cb(er))
  req.end(options.body)
}
