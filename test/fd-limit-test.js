global.options = {
  cache: {
    fd: {
      max: 2
    }
  }
}

// otherwise just the same as basic.
await import('./basic-test.js')
