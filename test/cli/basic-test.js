import { test } from '../support/tap-shim.js'
import { serve, stExpect } from '../support/cli-common.js'

test('Basic cli operation', (t) => {
  serve([], (req) => {
    req('/st.js', (er, res, body) => {
      t.error(er) &&
      t.equal(res.statusCode, 200) &&
      t.equal(body.toString(), stExpect)
    })
  }, (er, stdout, stderr) => {
    t.error(er)
    t.match(stdout, /^listening at http:\/\/(\[::\]|0\.0\.0\.0):[0-9]+\n$/)
    t.equal(stderr, '')
    t.end()
  })
})

test('Listening on localhost only', (t) => {
  serve(['--localhost'], (req) => {
    req('/st.js', (er, res, body) => {
      t.error(er) &&
      t.equal(res.statusCode, 200) &&
      t.equal(body.toString(), stExpect)
    })
  }, (er, stdout, stderr) => {
    t.error(er)
    t.match(stdout, /^listening at http:\/\/localhost:[0-9]+\n$/)
    t.equal(stderr, '')
    t.end()
  })
})
