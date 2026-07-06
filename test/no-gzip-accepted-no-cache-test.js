import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { test } from './support/tap-shim.js'

global.options = {
  cache: false // cache invokes a separate path
}

const { req } = await import('./support/common.js')
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const testFileName = 'no-gzip-accepted-no-cache.testfile'
const testFile = path.join(__dirname, '../', testFileName)

const rndData = crypto.randomBytes(1024 * 128).toString('hex') // significantly larger than highWaterMark

test('does not gzip the response', (t) => {
  t.on('end', () => {
    fs.rm(testFile, { force: true }, () => {})
  })

  fs.writeFile(testFile, rndData, (err) => {
    t.error(err)

    req(`/test/${testFileName}`, { 'accept-encoding': 'none' }, (er, res, body) => {
      t.error(er)
      t.equal(res.statusCode, 200)
      t.notOk(res.headers['content-encoding'])
      t.equal(body.toString(), rndData)
      t.end()
    })
  })
})
