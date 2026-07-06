import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from './support/tap-shim.js'
import st from '../st.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const opts = Object.assign({
  autoindex: true,
  path: path.dirname(__dirname),
  url: '/test'
}, global.options || {})

const mount = st(opts)

test('call next() if asset not found', (t) => {
  const req = { url: '/does-not-exist?a=b' }
  t.plan(1)
  mount(req, req, () => t.equal(req.url, '/does-not-exist?a=b'))
})
