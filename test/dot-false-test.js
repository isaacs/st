import { test } from './support/tap-shim.js'

global.dot = false

const { req } = await import('./support/dot-common.js')

// failing per https://github.com/isaacs/st/issues/67
test('non-dotted file', (t) => {
  req('/index.html', (er, res, body) => {
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('dotted file', (t) => {
  req('/.index.html', (er, res, body) => {
    t.equal(res.statusCode, 403)
    t.end()
  })
})
