import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)

global.options = {
  path: path.dirname(__filename) + '/..'
}

// otherwise just the same as basic.
await import('./basic-test.js')
