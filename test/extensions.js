var test = require('tap').test
var request = require('request')
var util = require('util')
var http = require('http')
var st = require('../st.js')
var fs = require('fs')

function req(url, opt, cb) {
  var mount = st(util._extend({
    url: '/test',
    path: __dirname,
    autoindex: true
  }, opt))

  var server = http.createServer(function(req, res) {
    if (!mount(req, res)) {
      res.statusCode = 404
      return res.end('Not a match: ' + req.url)
    }
  }).listen(function(er) {
    if (er) return cb(er)

    var port = this.address().port

    request.get({
      encoding: null,
      url: 'http://localhost:' + port + url
    }, function(er, res, body) {
      cb(er, res, body)
      server.close()
    })
  })
}

test('no extensions by default', function(t) {
  req('/test/fixtures/extension', {}, function (er, res, body) {
    t.ifError(er, 'no error')
    t.equal(res.statusCode, 404, '404')
    t.end()
  })
})

test('handles extensions without a dot prefix', function(t) {
  req('/test/fixtures/extension', {
    extensions: ['html']
  }, function (er, res, body) {
    t.ifError(er, 'no error')
    t.equal(res.statusCode, 200, '200')
    t.equal(String(body).trim(), 'html', 'found extension.html')
    t.end()
  })
})

test('finds first matching extension, in order they are specified', function(t) {
  t.plan(12)

  req('/test/fixtures/extension', {
    extensions: ['.html', '.js', '.css']
  }, function (er, res, body) {
    t.ifError(er, 'no error')
    t.equal(res.statusCode, 200, '200')
    t.equal(String(body).trim(), 'html', 'found extension.html')
  })

  req('/test/fixtures/extension', {
    extensions: ['.js', '.html', '.css']
  }, function (er, res, body) {
    t.ifError(er, 'no error')
    t.equal(res.statusCode, 200, '200')
    t.equal(String(body).trim(), 'js', 'found extension.js')
  })

  req('/test/fixtures/extension', {
    extensions: ['.md1', '.md2', '.css']
  }, function (er, res, body) {
    t.ifError(er, 'no error')
    t.equal(res.statusCode, 200, '200')
    t.equal(String(body).trim(), 'css', 'found extension.css')
  })

  req('/test/fixtures/extension', {
    extensions: ['.md', '.css', '.js', '.html']
  }, function (er, res, body) {
    t.ifError(er, 'no error')
    t.equal(res.statusCode, 200, '200')
    t.equal(String(body).trim(), 'css', 'found extension.css')
  })
})

test('original path attempted first', function(t) {
  t.plan(15)

  req('/test/fixtures/extension.js', {
    extensions: ['.html', '.js', '.css']
  }, function (er, res, body) {
    t.ifError(er, 'no error')
    t.equal(res.statusCode, 200, '200')
    t.equal(String(body).trim(), 'js', 'found extension.js')
  })

  req('/test/fixtures/extension.html', {
    extensions: ['.js', '.html', '.css']
  }, function (er, res, body) {
    t.ifError(er, 'no error')
    t.equal(res.statusCode, 200, '200')
    t.equal(String(body).trim(), 'html', 'found extension.html')
  })

  req('/test/fixtures/extension.html', {
    extensions: ['.css', '.js', '.html']
  }, function (er, res, body) {
    t.ifError(er, 'no error')
    t.equal(res.statusCode, 200, '200')
    t.equal(String(body).trim(), 'html', 'found extension.html')
  })

  req('/test/fixtures/extension.html', {
    extensions: ['.md']
  }, function (er, res, body) {
    t.ifError(er, 'no error')
    t.equal(res.statusCode, 200, '200')
    t.equal(String(body).trim(), 'html', 'found extension.html')
  })

  req('/test/fixtures/extension.html', {
    extensions: ['.html']
  }, function (er, res, body) {
    t.ifError(er, 'no error')
    t.equal(res.statusCode, 200, '200')
    t.equal(String(body).trim(), 'html', 'found extension.html')
  })
})

test('missing files are treated normally', function(t) {
  req('/test/fixtures/extension.missing', {
    extensions: ['.html']
  }, function (er, res, body) {
    t.ifError(er, 'no error')
    t.equal(res.statusCode, 404, '404')
    t.end()
  })
})
