import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from './support/tap-shim.js'
import st from '../st.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const opts = Object.assign({
  index: false,
  path: path.resolve(__dirname, './fixtures'),
  url: '/',
  passthrough: true
}, global.options || {})

const mount = st(opts)

test('call next() if passthrough is set', (t) => {
  const req = { method: 'GET', url: '/doesnotexist.txt', headers: {} }
  const res = {
    error: () => t.end(),
    setHeader: () => {},
    end: () => {}
  }
  t.plan(2)
  mount(req, res, () => {
    t.ok(true, 'next called with nonexistant file')
    req.url = '/'
    mount(req, res, () => {
      t.ok(true, 'next called without indexing')
      t.end()
    })
  })
})

const opts2 = Object.assign({
  autoindex: true,
  path: path.resolve(__dirname, './fixtures'),
  url: '/'
}, global.options || {})
const mount2 = st(opts2)

test('return error if passthrough is not set', (t) => {
  const req = { method: 'GET', url: '/doesnotexist.txt', headers: {} }
  const res = {
    setHeader: () => {},
    error: () => {
      t.ok(true, 'error used')
      t.end()
    },
    end: () => {}
  }
  t.plan(1)
  mount2(req, res, () => {
    t.end()
  })
})

test('does not set headers if passthrough is set', (t) => {
  const req = { method: 'GET', url: '/doesnotexist.txt', headers: {} }
  const res = {
    error: () => t.end(),
    _headers: [],
    setHeader: (header) => {
      res._headers.push(header)
    },
    end: () => {}
  }
  t.plan(2)
  mount(req, res, () => {
    t.notOk(res._headers.length, 'headers are not set on a non-existant file')
    req.url = '/'

    mount(req, res, () => {
      t.notOk(res._headers.length, 'headers are not set with no index')
      t.end()
    })
  })
})
