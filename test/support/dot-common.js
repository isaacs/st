import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { test, teardown } from './tap-shim.js'
import { request } from './http-client.js'
import st from '../../st.js'

let address
let server

// Several wrapper tests set global.dot/global.url before dynamically importing
// this helper. Keep option reads at module setup time unless those tests are
// refactored away from the legacy shared-fixture pattern.
const opts = {
  dot: global.dot,
  url: global.url,
  path: fileURLToPath(new URL('../fixtures/.dotted-dir', import.meta.url))
}

const mount = st(opts)

const req = (url, cb) => {
  let host = address.address
  if (address.family === 'IPv6') {
    host = `[${host}]`
  }

  request({ url: `http://${host}:${address.port}${url}` }, cb)
}

test('setup', (t) => {
  server = http.createServer((req, res) => {
    if (!mount(req, res)) {
      res.statusCode = 404
      return res.end(`Not a match: ${req.url}`)
    }
  }).listen(0, '127.0.0.1', () => {
    t.pass('listening')
    address = server.address()
    t.end()
  })
})

teardown(() => {
  server.close()
})

export { req }
