var test = require('tap').test
var common = require('./common')
var serve = common.serve

test('Basic cli operation', function (t) {
  serve([], function (req) {

    req('/st.js', function (er, res, body) {
      t.ifError(er) &&
      t.equal(res.statusCode, 200) &&
      t.equal(body.toString(), common.stExpect)
    })

  }, function (er, stdout, stderr) {
    t.ifError(er)
    t.match(stdout, /^listening at http:\/\/(\[::\]|0\.0\.0\.0):[0-9]+\n$/)
    t.equal(stderr, '')
    t.end()
  })
})

test('Listening on localhost only', function (t) {
  serve(["--localhost"], function (req) {

    req('/st.js', function (er, res, body) {
      t.ifError(er) &&
      t.equal(res.statusCode, 200) &&
      t.equal(body.toString(), common.stExpect)
    })

  }, function (er, stdout, stderr) {
    t.ifError(er)
    t.match(stdout, /^listening at http:\/\/localhost:[0-9]+\n$/)
    t.equal(stderr, '')
    t.end()
  })
})
