import { after, test as nodeTest } from 'node:test'
import assert from 'node:assert/strict'

// Minimal compatibility layer for the old tap-style tests. This keeps the
// accumulated assertion coverage intact while running the suite on node:test,
// and intentionally implements only the tap APIs this test suite uses.

export const teardown = after

export const comment = (...args) => {
  console.log('# ' + args.join(' '))
}

export const fail = (message, options = {}) => {
  if (options.skip) {
    comment('SKIP', message)
    return false
  }
  assert.fail(message)
}

const callAssert = (assertion, args, message) => {
  if (message === undefined) {
    assertion(...args)
  } else {
    assertion(...args, message)
  }
}

export const test = (name, fn) => {
  return nodeTest(name, async () => {
    await new Promise((resolve, reject) => {
      let ended = false
      let planned = null
      let assertions = 0
      const endHandlers = []

      const done = (error) => {
        if (ended) {
          return
        }
        ended = true

        if (error) {
          reject(error)
          return
        }

        try {
          if (planned !== null) {
            assert.equal(assertions, planned, 'test assertion count matches plan')
          }
          for (const handler of endHandlers) {
            handler()
          }
          resolve()
        } catch (er) {
          reject(er)
        }
      }

      const run = (assertion) => {
        if (ended) {
          return false
        }
        try {
          assertion()
          assertions++
          if (planned !== null && assertions >= planned) {
            done()
          }
          return true
        } catch (er) {
          done(er)
          return false
        }
      }

      const t = {
        plan: (count) => {
          planned = count
          if (count === 0) {
            done()
          }
        },
        end: () => done(),
        on: (event, handler) => {
          if (event !== 'end') {
            throw new Error('unsupported tap event: ' + event)
          }
          endHandlers.push(handler)
          return t
        },
        pass: (message) => run(() => callAssert(assert.ok, [true], message)),
        fail: (message, options) => {
          if (options && options.skip) {
            return false
          }
          return run(() => assert.fail(message))
        },
        error: (error, message) => run(() => {
          if (error && message !== undefined) {
            error.message = message + ': ' + error.message
          }
          assert.ifError(error)
        }),
        equal: (actual, expected, message) => run(() => callAssert(assert.equal, [actual, expected], message)),
        same: (actual, expected, message) => run(() => callAssert(assert.deepEqual, [actual, expected], message)),
        not: (actual, expected, message) => run(() => callAssert(assert.notEqual, [actual, expected], message)),
        ok: (value, message) => run(() => callAssert(assert.ok, [value], message)),
        notOk: (value, message) => run(() => callAssert(assert.ok, [!value], message)),
        match: (value, pattern, message) => run(() => callAssert(assert.match, [String(value), pattern], message)),
        notMatch: (value, pattern, message) => run(() => callAssert(assert.doesNotMatch, [String(value), pattern], message))
      }

      try {
        const result = fn(t)
        if (result && typeof result.then === 'function') {
          result.then(() => {
            if (!ended && planned === null) {
              done()
            }
          }, done)
        }
      } catch (er) {
        done(er)
      }
    })
  })
}
