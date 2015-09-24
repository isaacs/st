global.dot = false

var common = require('./dot-common')

var req = common.req
var test = common.test

// failing per https://github.com/isaacs/st/issues/67
test('non-dotted file', function (t) {
  req('/index.html', function (er, res, body) {
    t.equal(res.statusCode, 200)
    t.end()
  })
})

test('dotted file', function (t) {
  req('/.index.html', function (er, res, body) {
    t.equal(res.statusCode, 403)
    t.end()
  })
})
