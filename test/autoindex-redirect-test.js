import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import st from '../st.js'
import { test, teardown } from './support/tap-shim.js'
import { request } from './support/http-client.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const asciiMount = st({ autoindex: true, path: __dirname, url: '/test' })
const unicodeMount = st({ autoindex: true, path: __dirname, url: '/照片 #100%' })

let address
let server

const req = (url, cb) => {
  request({ url: `http://127.0.0.1:${address.port}${url}` }, cb)
}

test('setup', (t) => {
  server = http.createServer((req, res) => {
    if (!asciiMount(req, res) && !unicodeMount(req, res)) {
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

test('autoindex redirect keeps the mount prefix', (t) => {
  req('/test/fixtures', (er, res, body) => {
    t.error(er)
    t.equal(res.statusCode, 301)
    t.equal(res.headers.location, '/test/fixtures/')
    t.equal(body.toString(), 'Moved: /test/fixtures/')
    t.end()
  })
})

test('autoindex redirect encodes the mount prefix', (t) => {
  req('/%E7%85%A7%E7%89%87%20%23100%25/fixtures', (er, res, body) => {
    t.error(er)
    t.equal(res.statusCode, 301)
    t.equal(res.headers.location, '/%E7%85%A7%E7%89%87%20%23100%25/fixtures/')
    t.equal(body.toString(), 'Moved: /%E7%85%A7%E7%89%87%20%23100%25/fixtures/')
    t.end()
  })
})
