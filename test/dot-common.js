var path = require('path')
var http = require('http')
var request = require('request')
var tap = require('tap')

var st = require('../st.js')

var port = process.env.PORT || 1337
var test = exports.test = tap.test

var server

var opts = {
  dot: global.dot,
  path: path.join(__dirname, "fixtures", ".dotted-dir"),
}

var mount = st(opts)

exports.req = function req (url, cb) {
  request({ url: 'http://localhost:' + port + url }, cb)
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

tap.tearDown(function() {
  server.close()
})
