# st

A module for serving static files.  Does etags, caching, etc.

## USAGE

```javascript
var st = require('st')
var mount = st({
  path: 'resources/static/',
  url: 'static/', // defaults to path option
  cacheSize: 1024*1024*1024, // 1GB memory cache. default = 0
  fdCacheSize: 1024, // number of fd's to cache. default = 1024
  // TODO index: true, // show an html index for dirs
  // TODO index: 'index.html', // use index.html for dirs, if present
  cacheExpiry: 10*60*1000, // expiration of contentCache in ms
  // TODO serveStale: true // update in the background, 
})

// other options
mount2 = st('resources/static/', 'static/', {
  cacheSize: 1024*1024*1024, // 1GB memory cache. default = 0
  fdCacheSize: 1024, // number of fd's to cache. default = 1024
  // TODO index: true, // show an html index for dirs
  // TODO index: 'index.html', // use index.html for dirs, if present
  cacheExpiry: 10*60*1000, // expiration of contentCache in ms
  // TODO serveStale: true // update in the background, 
})
mount3 = st('static/favicon.ico', {
  url: '/favicon.ico',
  cacheSize: 1024*1024*1024, // 1GB memory cache. default = 0
  fdCacheSize: 1024, // number of fd's to cache. default = 1024
  // TODO index: true, // show an html index for dirs
  // TODO index: 'index.html', // use index.html for dirs, if present
  cacheExpiry: 10*60*1000, // expiration of contentCache in ms
  // TODO serveStale: true // update in the background, 
})
mount4 = st('static/')

// with bare node.js
http.createServer(function (req, res) {
  if (mount(req, res)) return // serving a static file
  myCustomLogic(req, res)
}).listen(PORT)

// with express
app.use(mount)
// or
app.route('/static/:fooblz', function (req, res, next) {
  mount(req, res, next) // will call next() if it doesn't do anything
})
```


