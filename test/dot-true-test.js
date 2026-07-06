import { test } from './support/tap-shim.js'

global.dot = true

const { req } = await import('./support/dot-common.js')

test('non-dotted file', (t) => {
  req('/index.html', (er, res, body) => {
    t.error(er)
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('dotted file', (t) => {
  req('/.index.html', (er, res, body) => {
    t.error(er)
    t.equal(res.statusCode, 200)
    t.end()
  })
})
