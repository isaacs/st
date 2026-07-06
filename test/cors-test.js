import { test } from './support/tap-shim.js'

global.options = {
  cors: true
}

const { req } = await import('./support/common.js')

test('CORS headers', (t) => {
  req('/test/st.js', (er, res) => {
    t.equal(res.headers['access-control-allow-origin'], '*')
    const headers = res.headers['access-control-allow-headers']
    t.ok(/Origin/.test(headers))
    t.ok(/X-Requested-With/.test(headers))
    t.ok(/Content-Type/.test(headers))
    t.ok(/Accept/.test(headers))
    t.ok(/Range/.test(headers))
    t.end()
  })
})
