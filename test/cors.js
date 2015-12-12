global.options = {
  cors: true
}

var common = require('./common')

var test = require('tap').test
var req = common.req

test('CORS headers', function (t) {
  req('/test/st.js', function (er, res) {
    t.equal(res.headers['access-control-allow-origin'], '*');
    var headers = res.headers['access-control-allow-headers']
    t.ok(/Origin/.test(headers));
    t.ok(/X-Requested-With/.test(headers));
    t.ok(/Content-Type/.test(headers));
    t.ok(/Accept/.test(headers));
    t.ok(/Range/.test(headers));
    t.end()
  })
})
