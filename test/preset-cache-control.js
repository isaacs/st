var st = require('../st.js')
var tap = require('tap')
var test = require('tap').test
var util = require('util')
var path = require('path')
var http = require('http')
var request = require('request')
var port = process.env.PORT || 1337

var opts = util._extend({
  index: false,
  path: path.dirname(__dirname),
  url: '/test'
}, global.options || {})

var mount = st(opts)
var server
var cacheControl = null

function req (url, headers, cb) {
  if (typeof headers === 'function') cb = headers, headers = {}
  request({ encoding: null,
            url: 'http://localhost:' + port + url,
            headers: headers }, cb)
}

tap.test('setup', function (t) {
  server = http.createServer(function (req, res) {
    if (cacheControl)
      res.setHeader('cache-control', cacheControl)
    if (!mount(req, res)) {
      res.statusCode = 404
      return res.end('Not a match: ' + req.url)
    }
  }).listen(port, function () {
    t.pass('listening')
    t.end()
  })
})

tap.tearDown(function() {
  server.close()
})

tap.test('simple request', function (t) {
  cacheControl = null
  req('/test/st.js', function (er, res, body) {
    t.ifError(er)
    t.equal(res.headers['cache-control'], 'public, max-age=600')
    t.end()
  })
})

tap.test('pre-set cache-control', function (t) {
  cacheControl = 'I\'m so excited, and I just can\'t hide it'
  req('/test/st.js', function (er, res, body) {
    t.ifError(er)
    t.equal(res.headers['cache-control'], cacheControl)
    t.end()
  })
})
