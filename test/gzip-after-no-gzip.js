global.options = {
  cachedHeader: true // inspect to see if something is served from cache
}

var zlib = require('zlib')
var common = require('./common.js')
var req = common.req
var stExpect = common.stExpect

var test = require('tap').test


test('does not gzip first response', function(t) {
  req('/test/st.js', {'accept-encoding':'none'},
      function (er, res, body) {

    t.equal(res.statusCode, 200)
    t.notOk(res.headers['content-encoding'])
    t.notOk(res.headers['x-from-cache'])
    t.equal(body.toString(), stExpect)
    t.end()
  })
})


test('gzips second response', function (t) {
  req('/test/st.js', {'accept-encoding':'gzip'},
      function (er, res, body) {

    t.ifError(er, 'no error')

    t.equal(res.statusCode, 200)
    t.equal(res.headers['content-encoding'], 'gzip')
    t.equal(res.headers['x-from-cache'], 'true')

    t.ok(body, 'returned a body')
    t.notEqual(body.toString(), stExpect, 'gzipped string')

    zlib.gunzip(body, function (er, body) {
      if (er) throw er
      t.equal(body.toString(), stExpect)
      t.end()
    })
  })
})
