var path = require('path')
var fs = require('fs')
var zlib = require('zlib')
var http = require('http')
var server
var st = require('../st.js')
var request = require('request')
var test = require('tap').test
var port = process.env.PORT || 1337
var mount = st({
  autoindex: true,
  path: path.dirname(__dirname),
  url: '/test'
})

function req (url, headers, cb) {
  if (typeof headers === 'function') cb = headers, headers = {}
  request({ encoding: null,
            url: 'http://localhost:' + port + url,
            headers: headers }, cb)
}

test('setup', function (t) {
  server = http.createServer(function (req, res) {
    if (!mount(req, res)) {
      res.statusCode = 404
      return res.end('Not a match: ' + req.url)
    }
  }).listen(port, function () {
    t.pass('listening')
    t.end()
  })
})

var stEtag
var stExpect = fs.readFileSync(require.resolve('../st.js')).toString()
test('simple request', function (t) {
  req('/test/st.js', function (er, res, body) {
    t.equal(res.statusCode, 200)
    t.ok(res.headers.etag)
    stEtag = res.headers.etag
    t.equal(body.toString(), stExpect)
    t.end()
  })
})

test('304 request', function (t) {
  req('/test/st.js', {'if-none-match':stEtag}, function (er, res, body) {
    t.equal(res.statusCode, 304)
    t.notOk(body)
    t.end()
  })
})

test('gzip', function (t) {
  req('/test/st.js', {'accept-encoding':'gzip'},
      function (er, res, body) {
    t.equal(res.statusCode, 200)
    t.equal(res.headers['content-encoding'], 'gzip')
    zlib.gunzip(body, function (er, body) {
      if (er) throw er;
      t.equal(body.toString(), stExpect)
      t.end()
    })
  })
})

test('teardown', function (t) {
  server.close(function () {
    t.pass('closed')
    t.end()
  })
})
