// turn off gzip compression
global.options = {
  gzip: false
}

var basic = require('./basic.js')
var req = basic.req
var mount = basic.mount
var stExpect = basic.stExpect

// additional test to ensure that it's actually not gzipping
var test = require('tap').test

test('does not gzip the response', function(t) {
  req('/test/st.js', {'accept-encoding':'gzip'},
      function (er, res, body) {
    t.equal(res.statusCode, 200)
    t.notOk(res.headers['content-encoding'])
    t.equal(body.toString(), stExpect)
    t.end()
  })
})

