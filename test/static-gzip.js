// turn off gzip compression
global.options = {
  staticGzip: true
}

var fs = require('fs')
var zlib = require('zlib')
var basic = require('./basic.js')
var req = basic.req
var mount = basic.mount
var stExpect = basic.stExpect

// additional test to ensure that it's actually not gzipping
var test = require('tap').test

test('gzip-static', function (t) {
  zlib.gzip(stExpect, function(er, gzipped) {
    if (er) throw er;
    process.stdout.write(gzipped.toString())
    fs.writeFile('../tmp.txt.gz', gzipped, function(er) {
      fs.writeFile('../tmp.txt', 'this shouldn\'t be returned', function(er) {
        if (er) throw er;
        req('/test/tmp.txt', {'accept-encoding':'gzip'},
            function (er, res, body) {
          t.equal(res.statusCode, 200)
          t.equal(res.headers['content-encoding'], 'gzip')
          zlib.gunzip(body, function (er, body) {
            if (er) throw er;
            t.equal(body.toString(), stExpect)
            fs.unlink('../tmp.txt.gz', function(er) {
              if (er) throw er;
              fs.unlink('../tmp.txt', function(er) {
                if (er) throw er;
                t.end()
              })
            })
          })
        })
      })
    })
  })
})
