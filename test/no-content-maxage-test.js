global.options = {
  cache: {
    content: {
      maxAge: false
    }
  }
}

// otherwise just the same as basic.
await import('./basic-test.js')
