global.dot = true
global.url = '/static'

const { test } = require('tap')
const { req } = require('./dot-common')

// Non-root mounts need a segment-boundary check before stripping the mount
// prefix. Otherwise `/static..%2fsecret` can pass validation as
// `/static../secret`, then become `/../secret` after the `/static` prefix is
// removed.

test('mounted encoded-slash prefix traversal is not a match', (t) => {
  req('/static..%2fspace%20in%20filename.txt', (er, res, body) => {
    t.error(er)
    t.equal(res.statusCode, 404)
    t.notMatch(body, /space in filename/)
    t.end()
  })
})

test('mounted encoded-dot prefix traversal is not a match', (t) => {
  req('/static%2e%2e%2fspace%20in%20filename.txt', (er, res, body) => {
    t.error(er)
    t.equal(res.statusCode, 404)
    t.notMatch(body, /space in filename/)
    t.end()
  })
})

test('mounted encoded-backslash prefix traversal is not a match', (t) => {
  req('/static..%5cspace%20in%20filename.txt', (er, res, body) => {
    t.error(er)
    t.equal(res.statusCode, 404)
    t.notMatch(body, /space in filename/)
    t.end()
  })
})

test('mounted encoded traversal inside the mount is forbidden', (t) => {
  req('/static/..%2fspace%20in%20filename.txt', (er, res, body) => {
    t.error(er)
    t.equal(res.statusCode, 403)
    t.notMatch(body, /space in filename/)
    t.end()
  })
})
