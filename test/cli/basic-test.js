const test = require('tap').test
const common = require('./common')
const serve = common.serve

test('Basic cli operation', (t) => {
  serve([], (req) => {
    req('/st.js', (er, res, body) => {
      t.ifError(er) &&
      t.equal(res.statusCode, 200) &&
      t.equal(body.toString(), common.stExpect)
    })
  }, (er, stdout, stderr) => {
    t.ifError(er)
    t.match(stdout, /^listening at http:\/\/(\[::\]|0\.0\.0\.0):[0-9]+\n$/)
    t.equal(stderr, '')
    t.end()
  })
})

test('Listening on localhost only', (t) => {
  serve(['--localhost'], (req) => {
    req('/st.js', (er, res, body) => {
      t.ifError(er) &&
      t.equal(res.statusCode, 200) &&
      t.equal(body.toString(), common.stExpect)
    })
  }, (er, stdout, stderr) => {
    t.ifError(er)
    t.match(stdout, /^listening at http:\/\/localhost:[0-9]+\n$/)
    t.equal(stderr, '')
    t.end()
  })
})
