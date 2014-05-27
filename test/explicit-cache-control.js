global.options = {
  cache: {
    content: {
      cacheControl: 'pubic, marx-aged=-100'
    }
  }
}

// otherwise just the same as basic.
require('./basic.js')
