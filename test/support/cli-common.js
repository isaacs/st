import path from 'node:path'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { request } from './http-client.js'

const port = process.env.PORT || 1337
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const stExpect = fs.readFileSync(fileURLToPath(new URL('../../st.js', import.meta.url)), 'utf8')

// Run server with given command line arguments,
// then allow cbRequests to schedule a bunch of requests,
// finally call cbDone.
// cbRequests gets the req function as an argument.

function serve (args, cbRequests, cbDone) {
  args = [fileURLToPath(new URL('../../bin/server.js', import.meta.url))].concat(args || [])
  const server = spawn(process.execPath, args, {
    cwd: path.dirname(path.dirname(__dirname)),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { LANG: 'C', LC_ALL: 'C' }
  })
  const stdout = []
  const stderr = []
  let thingsToDo = 4 // cbRequests, exit, stdout, stderr
  let code = null
  let signal = null
  let cbReqEr = null
  let outputSeen = false
  server.stdout.on('data', (chunk) => stdout.push(chunk))
  server.stderr.on('data', (chunk) => stderr.push(chunk))
  server.once('error', (er) => {
    thingsToDo = -10 // only call cbDone once
    cbDone(er)
  })
  server.once('exit', (c, s) => {
    code = c
    signal = s
    if (!outputSeen) {
      outputSeen = true
      --thingsToDo
    }
    then()
  })
  server.stdout.once('end', then)
  server.stderr.once('end', then)
  server.stdout.once('data', () => {
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
      let er = null
      if (cbReqEr) {
        er = cbReqEr
      } else if (signal !== null && signal !== 'SIGTERM') {
        er = Error('Terminated by signal ' + signal)
      } else if (code !== null && code !== 0) {
        er = Error('Exited with code ' + code)
      }
      const o = Buffer.concat(stdout).toString()
      const e = Buffer.concat(stderr).toString()
      if (er) {
        console.info(o)
        console.error(e)
      }
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
      url,
      headers
    }, (...args) => {
      try {
        cb.apply(null, args)
      } finally {
        then()
      }
    })
  }
}

export { port, stExpect, serve }
