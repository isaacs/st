'use strict'

var path = require('path')
var fs = require('fs')
var request = require('request')
var child_process = require('child_process')
var bl = require('bl')

var port = process.env.PORT || 1337

var server
var stdout = bl()
var stderr = bl()

var stExpect = fs.readFileSync(require.resolve('../../st.js'), 'utf8')


// Run server with given command line arguments,
// then allow cbRequests to schedule a bunch of requests,
// finally call cbDone.
// cbRequests gets the req function as an argument.

function serve (args, cbRequests, cbDone) {
  args = [require.resolve('../../bin/server.js')].concat(args || [])
  var server = child_process.spawn(process.execPath, args, {
    cwd: path.dirname(path.dirname(__dirname)),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { LANG: 'C', LC_ALL: 'C' }
  })
  var stdout = bl()
  var stderr = bl()
  server.stdout.pipe(stdout)
  server.stderr.pipe(stderr)
  var thingsToDo = 4 // cbRequests, exit, stdout, stderr
  var code = null
  var signal = null
  var cbReqEr = null
  var outputSeen = false
  server.once('error', function (er) {
    thingsToDo = -10 // only call cbDone once
    cbDone(er)
  })
  server.once('exit', function (c, s) {
    code = c
    signal = s
    if (!outputSeen) {
      outputSeen = true
      --thingsToDo
    }
    then()
  })
  stdout.once('finish', then)
  stderr.once('finish', then)
  server.stdout.once('data', function () {
    if (outputSeen) return
    outputSeen = true
    try {
      cbRequests(req)
    } catch (er) {
      cbReqEr = er
    } finally {
      then()
    }
  })

  function then () {
    --thingsToDo
    if (thingsToDo === 3) { // all requests done, one way or another
      server.kill()
    } else if (thingsToDo === 0) {
      var er = null
      if (cbReqEr)
        er = cbReqEr
      else if (signal !== null && signal !== 'SIGTERM')
        er = Error("Terminated by signal " + signal)
      else if (code !== null && code !== 0)
        er = Error("Exited with code " + code)
      var o = stdout.toString(), e = stderr.toString()
      if (er) console.info(o), console.error(e)
      cbDone(er, o, e)
    }
  }

  function req (url, headers, cb) {
    if (typeof headers === 'function') {
      cb = headers
      headers = {}
    }
    if (!/:\/\//.test(url)) {
      url = 'http://localhost:' + port + url
    }
    ++thingsToDo
    request({
      encoding: null,
      url: url,
      headers: headers
    }, function () {
      try {
        cb.apply(null, arguments)
      } finally {
        then()
      }
    })
  }

}

module.exports.port = port
module.exports.stExpect = stExpect
module.exports.serve = serve
