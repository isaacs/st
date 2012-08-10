var st = require('../st.js')
var http = require('http')
var port = +(process.env.PORT || 1337)
var dir = ''
var cacheSize = 0

for (var i = 2; i < process.argv.length; i++) {
  switch (process.argv[i]) {
    case '-p':
    case '--port':
      port = +(process.argv[++i])
      break
    case '-d':
    case '--dir':
      dir = process.argv[++i]
      break
    case '-c':
    case '--cache-size':
      cacheSize = +(process.argv[++i])
      break
  }
}

if (isNaN(port)) throw new Error('invalid port: '+port)

var mount = st({
  url: '/',
  path: dir,
  autoindex: true,
  cacheSize: cacheSize
})

http.createServer(function (q, s) {
  if (mount(q, s)) return
  s.statusCode = 404
  s.end('not found')
}).listen(port)
