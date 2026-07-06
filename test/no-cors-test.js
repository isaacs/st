import { test } from './support/tap-shim.js'

global.options = {
  cors: false
}

const { req } = await import('./support/common.js')

test('without CORS headers', function (t) {
  req('/test/st.js', function (er, res) {
    t.error(er)
    t.notOk(res.headers['access-control-allow-origin'])
    t.end()
  })
})
