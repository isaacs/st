global.dot = true

var common = require('./dot-common')

var req = common.req
var test = common.test

test('non-dotted file', function (t) {
  req('/index.html', function (er, res, body) {
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('dotted file', function (t) {
  req('/.index.html', function (er, res, body) {
    t.equal(res.statusCode, 200)
    t.end()
  })
})
