var path = require('path')
var fs = require('fs')
var http = require('http')
var util = require('util')
var request = require('request')
var tap = require('tap')

var st = require('../st.js')

var port = process.env.PORT || 1337
var test = tap.test

var server

var opts = util._extend({
  autoindex: true,
  path: path.dirname(__dirname),
  url: '/test'
}, global.options || {})

var stExpect = fs.readFileSync(require.resolve('../st.js'), 'utf8')
var mount = st(opts)


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


tap.tearDown(function() {
  server.close()
})


module.exports.mount = mount
module.exports.req = req
module.exports.stExpect = stExpect
module.exports.opts = opts