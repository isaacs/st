global.dot = true

const { test } = require('tap')
const { req } = require('./dot-common')

// A percent-encoded separator must not smuggle a `..` past the traversal
// guard. `..%2f` (and `..%5c`) only decode to `../` after the path has been
// checked, so the check has to run on the decoded path. `dot: true` is needed
// to reach this: with the default `dot: false`, the decoded `..` is rejected
// independently as a dot-url. `space in filename.txt` lives in the parent of
// the served root, so a non-403 here would mean the response left the mount.

test('encoded-slash parent traversal is forbidden', (t) => {
  req('/..%2fspace%20in%20filename.txt', (er, res, body) => {
    t.error(er)
    t.equal(res.statusCode, 403)
    t.end()
  })
})

test('encoded-backslash parent traversal is forbidden', (t) => {
  req('/..%5cspace%20in%20filename.txt', (er, res, body) => {
    t.error(er)
    t.equal(res.statusCode, 403)
    t.end()
  })
})
