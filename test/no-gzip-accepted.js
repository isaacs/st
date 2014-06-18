global.options = {
}

var fs = require('fs')
var path = require('path')
var crypto = require('crypto')
var rimraf = require('rimraf')
var common = require('./common.js')
var req = common.req
var mount = common.mount
var stExpect = common.stExpect

var test = require('tap').test
var testFileName = 'bigfattestfile'
var testFile = path.join(__dirname, '../', testFileName)

var rndData = crypto.randomBytes(1024 * 128).toString('hex') // significantly larger than highWaterMark

test('does not gzip the response', function(t) {
  t.on('end', function () {
    rimraf(testFile, function () {})
  })

  fs.writeFile(testFile, rndData, function (err) {
    t.notOk(err)

    req('/test/' + testFileName, {'accept-encoding':'none'},
        function (er, res, body) {

      t.equal(res.statusCode, 200)
      t.notOk(res.headers['content-encoding'])
      t.equal(body.toString(), rndData)
      t.end()
    })
  })
})

