global.options = {
  cors: false
}

var common = require('./common')

var test = require('tap').test
var req = common.req

test('without CORS headers', function (t) {
  req('/test/st.js', function (er, res) {
    t.notOk(res.headers['access-control-allow-origin'])
    t.end();
  })
})
