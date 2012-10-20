var st = require('../st.js')
var test = require('tap').test
var util = require('util')
var path = require('path')

var opts = util._extend({
  autoindex: true,
  path: path.resolve(__dirname, './fixtures'),
  url: '/',
  passthrough: true
}, global.options || {})

var mount = st(opts)

test('call next() if passthrough is set', function (t) {
  var req = { url: '/index.html' }
  var res = {}
  t.plan(1)
  function next() {
    t.ok(true, "next called")
  }
  mount(req, res, next)
})

opts = util._extend({
  autoindex: true,
  path: path.resolve(__dirname, './fixtures'),
  url: '/'
}, global.options || {})

mount = st(opts)

test('return error if passthrough is not set', function (t) {
  var req = { url: '/doesnotexist.txt' }
  var res = {
    error: function () {
      t.ok(true, "error used")
      t.end()
    }
  }
  t.plan(1)
  mount(req, res, function () {
    t.end()
  })
})
