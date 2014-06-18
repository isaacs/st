var zlib = require('zlib')
var test = require('tap').test
var common = require('./common')

var req = common.req
var stExpect = common.stExpect
var opts = common.opts

var stEtag

module.exports.mount = common.mount
module.exports.req = common.req
module.exports.stExpect = common.stExpect


test('simple request', function (t) {
  req('/test/st.js', function (er, res, body) {
    t.equal(res.statusCode, 200)
    t.ok(/\/javascript$/.test(res.headers['content-type']))
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


if (opts.gzip !== false) {
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
}


test('multiball!', function (t) {
  var n = 6
  req('/test/st.js', then)
  req('/test/README.md', then)
  req('/test/LICENSE', then)
  req('/test/package.json', then)
  req('/test/favicon.ico', then)
  req('/test/bin/server.js', then)

  function then (er, res) {
    if (er)
      throw er
    t.equal(res.statusCode, 200)

    // give them all time to close, then go again.
    if (--n === 0)
      setTimeout(function () {
        n = 6
        req('/test/st.js', then2)
        req('/test/README.md', then2)
        req('/test/LICENSE', then2)
        req('/test/package.json', then2)
        req('/test/favicon.ico', then2)
        req('/test/bin/server.js', then2)
      }, 200)
  }

  function then2 (er, res) {
    if (er)
      throw er

    t.equal(res.statusCode, 200)

    if (opts.cache === false)
      t.equal(res.headers['cache-control'], 'no-cache')
    else if (opts.cache && opts.cache.content && opts.cache.content.maxAge === false)
      t.ok(res.headers['cache-control'] === undefined)
    else if (opts.cache && opts.cache.content && opts.cache.content.cacheControl)
      t.equal(res.headers['cache-control'], opts.cache.content.cacheControl)
    else
      t.equal(res.headers['cache-control'], 'public, max-age=600')

    if (--n === 0)
      t.end()
  }
})


test('space in filename', function (t) {
  req('/test/test/fixtures/space in filename.txt', function (er, res, body) {
    t.equal(res.statusCode, 200)
    t.ok(body)
    t.end()
  })
})


test('malformed URL', function (t) {
  req('/test%2E%git', function (er, res) {
    t.equal(res.statusCode, 404)
    t.end()
  })
})


test('shenanigans', function(t) {
  req('/%2e%2E/%2e%2E/%2e%2E/%2e%2E/%2e%2E/%2e%2E/etc/passwd', function(er, res) {
    if (er)
      throw er
    t.equal(res.statusCode, 403)
    t.end()
  })
})
