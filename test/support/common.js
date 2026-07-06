import path from 'node:path'
import fs from 'node:fs'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { test, teardown } from './tap-shim.js'
import { request } from './http-client.js'
import st from '../../st.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let address
let server

// Several wrapper tests set global.options before dynamically importing this
// helper. Keep option reads at module setup time unless those tests are
// refactored away from the legacy shared-fixture pattern.
const opts = Object.assign({
  autoindex: true,
  path: path.dirname(path.dirname(__dirname)),
  url: '/test'
}, global.options || {})

const stExpect = fs.readFileSync(fileURLToPath(new URL('../../st.js', import.meta.url)), 'utf8')
const mount = st(opts)

function req (url, headers, cb) {
  if (typeof headers === 'function') {
    cb = headers
    headers = {}
  }

  let host = address.address
  if (address.family === 'IPv6') {
    host = `[${host}]`
  }

  request({
    encoding: null,
    url: `http://${host}:${address.port}${url}`,
    headers,
    followRedirect: false
  }, cb)
}

test('setup', (t) => {
  server = http.createServer((req, res) => {
    try {
      if (!mount(req, res)) {
        res.statusCode = 404
        return res.end(`Not a match: ${req.url}`)
      }
    } catch (e) {
      res.statusCode = 500
      console.error(e)
      return res.end(`Internal error: ${e.message}`)
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

export { mount, req, stExpect, opts }
