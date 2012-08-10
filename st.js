module.exports = st

var mime = require('mime')
var path = require('path')
var LRU = require('lru-cache')
var fs = require('fs')
var url = require('url')
var zlib = require('zlib')
var Neg = require('negotiator')
var http = require('http')

function st (opt) {
  var p, u
  if (typeof opt === 'string') {
    p = opt
    opt = arguments[1]
    if (typeof opt === 'string') {
      u = opt
      opt = arguments[2]
    }
  }
  if (!opt) opt = {}
  if (!p) p = opt.path
  if (typeof p !== 'string') throw new Error('no path specified')
  p = path.resolve(p)
  if (!u) u = opt.url
  if (!u) u = p.substr(path.cwd().length).replace(/\\/g, '/')
  if (u.charAt(0) !== '/') u = '/' + u

  // default to 10 minutes
  var cacheExpiry = opt.cacheExpiry
  if (isNaN(cacheExpiry)) cacheExpiry = 1000 * 60 * 10

  // fd cache
  var fdCacheSize = +opt.fdCacheSize
  if (isNaN(fdCacheSize) || fdCacheSize < 0) {
    fdCacheSize = 1024
  }
  var fdCache, statCache
  if (fdCacheSize > 0) {
    fdCache = LRU({
      max: fdCacheSize,
      dispose: function (key, fd) {
        fs.close(fd, function () {})
      }
    })
    statCache = new LRU({
      max: fdCacheSize,
      maxAge: cacheExpiry
    })
  } else {
    // fake cache
    fdCache = statCache = {
      opening: {},
      set: function () {},
      get: function () {}
    }
  }

  // content cache
  var cacheSize = opt.cacheSize
  if (isNaN(cacheSize)) cacheSize = 0
  var contentCache
  if (cacheSize) {
    contentCache = LRU({
      max: cacheSize,
      maxAge: cacheExpiry,
      length: function (item) {
        return item.size
      }
    })
  }

  var etags = {}

  return mount
  function mount (req, res, next) {
    var ru = url.parse(req.url).pathname.replace(/\/\/+/g, '/')
    var pos = ru.indexOf(u)
    // not something we care about
    if (pos !== 0) {
      if (next) next()
      return false
    }

    // don't allow dot-urls by default, unless explicitly allowed.
    if (!opt.dot && ru.match(/(^|\/)\./)) {
      res.statusCode = 403
      res.end('Forbidden')
      return true
    }

    // At this point, we're taking the request, because it's into the mount.
    // make sure to return true!

    var pru = path.join(p, path.join('/', ru))
    pru = pru.replace(/\/+$/, '')
    var etag = etags[pru]
    if (etag && etag === req.headers['if-none-match']) {
      res.statusCode = 304
      res.end()
      return true
    }

    // TODO: byte range requests.
    // does that play nice with gzip?  the spec is kinda dense.

    var gz = false
    if (opt.gz !== false) {
      var neg = req.negotiator || new Neg(req)
      gz = neg.preferredEncoding('gzip', 'identity') === 'gzip'
    }

    // see if the content is in cache.
    if (contentCache) {
      var cached = contentCache.get(pru)
      if (cached) {
        res.statusCode = 200
        res.setHeader('etag', cached.etag)
        res.setHeader('mime-type', mime.lookup(path.extname(pru)))
        if (gz) {
          res.setHeader('content-encoding', 'gzip')
          res.setHeader('content-length', cached.gz.length)
          res.end(cached.gz)
        } else {
          res.setHeader('content-length', cached.length)
          res.end(cached)
        }
        return true
      }
    }

    // not served out of cache.
    // we have to read the actual file, i guess.
    open(pru, fdCache, function (er, fd) {
      if (er) return error(res, er)

      // the fd is opened now, and in the cache
      // need to get the fstat
      fstat(fd, pru, statCache, function (er, stat) {
        if (er) return error(res, er)
        if (stat.isDirectory()) {
          if (opt.autoindex !== false) {
            // url should always end in /
            if (!ru.match(/\/$/)) {
              res.statusCode = 301
              res.setHeader('location', ru + '/')
              res.end('Moved: ' + ru + '/')
              return
            }
            return autoindex(ru, pru, opt, res)
          } else {
            res.statusCode = 404
            res.end('not found: ' + u)
            return
          }
        }

        // don't bother even attempting to cache if it's too big
        var doCache = contentCache && stat.size < cacheSize
        var cache = fdCache ? contentCache : null
        serve(res, fd, pru, cache, gz, stat, etags, fdCache)
      })
    })
    return true
  }
}

function serve (res, fd, pru, cache, gz, stat, etags, fdCache) {
  // kind of wasteful.
  // should probably do the fs stuff manually
  // but if you aren't caching contents, then it's probably because the
  // files are big, and if you are caching contents, then it doesn't
  // matter most of the time anyway.
  var stream = fs.createReadStream(pru, { start: 0, fd: fd })
  // we're actually going to re-use the fd repeatedly, so no-op this.
  stream.destroy = function () {}

  function serveError(er) {
    console.error('Error', pru, er.stack || er.message)
    res.destroy()
    if (cache) cache.del(pru)
    fdCache.del(pru)
  }

  stream.on('error', serveError)

  // don't gzip files ending in .gz or .tgz
  if (!pru.match(/.\.t?gz$/)) {
    var gzstr = zlib.Gzip()
    stream.pipe(gzstr)
    // at this point it's too late to do anything about errors.
    // just kill the stream.
    gzstr.on('error', serveError)
  } else {
    gz = false
  }

  res.statusCode = 200
  var etag = [stat.dev, stat.ino, stat.mtime.getTime()].join(':')
  etag = '"' + etag + '"'
  res.setHeader('etag', etag)
  etags[pru] = etag
  res.setHeader('mime-type', mime.lookup(path.extname(pru)))

  if (cache) {
    var ended = 0
    if (!gzstr) ended++

    var clearBufs = []
    stream.on('data', clearBufs.push.bind(clearBufs))
    stream.on('end', function () {
      clearBufs = Buffer.concat(clearBufs)
      if (++ended === 2) finishCache()
    })

    if (gzstr) {
      var gzBufs = []
      gzstr.on('data', gzBufs.push.bind(gzBufs))
      gzstr.on('end', function () {
        gzBufs = Buffer.concat(gzBufs)
        if (++ended === 2) finishCache()
      })
    }

    function finishCache () {
      // put it in the contentCache
      if (gzstr) clearBufs.gz = gzBufs
      clearBufs.etag = etag
      cache.set(pru, clearBufs)
    }
  }

  // not sure whether it's better to gzip or to send a content-length
  // but at this point, ti would mean reading the whole file before
  // sending anything, since we don't know how big the gzipped will be.
  if (!gz) {
    res.setHeader('content-length', stat.size)
    stream.pipe(res)
  } else {
    res.setHeader('content-encoding', 'gzip')
    gzstr.pipe(res)
  }
}

function fstat (fd, path, statCache, cb_) {
  var key = fd + ':' + path
  var cached = statCache.get(key)
  if (cached) return cb_(null, cached)

  statCache.opening = statCache.opening || {}
  if (statCache.opening[key]) {
    statCache.opening[key].push(cb_)
    return
  }
  statCache.opening[key] = [ cb_ ]

  fs.fstat(fd, function (er, stat) {
    var cbs = statCache.opening[key]
    delete statCache.opening[key]
    if (!er) statCache.set(key, stat)
    cbs.forEach(function (cb) { return cb(er, stat) })
  })
}

// mixed sync/async!  it's ok, since this is private, but watch out!
function open (path, fdCache, cb_) {
  var cached = fdCache.get(path)
  if (cached) return cb_(null, cached)

  // don't open the same file multiple times.
  fdCache.opening = fdCache.opening || {}
  if (fdCache.opening[path]) {
    fdCache.opening[path].push(cb_)
    return
  }
  fdCache.opening[path] = [ cb_ ]

  fs.open(path, 'r', function cb (er, fd) {
    var cbs = fdCache.opening[path]
    delete fdCache.opening[path]
    if (!er) fdCache.set(path, fd)
    cbs.forEach(function (cb) { cb(er, fd) })
  })
}

function error (res, er) {
  res.statusCode = er.code === 'ENOENT' || er.code === 'EISDIR' ? 404
                 : er.code === 'EPERM' || er.code === 'EACCES' ? 403
                 : 500
  if (res.error) {
    // pattern of express and ErrorPage
    return res.error(er, res.statusCode)
  }
  res.setHeader('content-type', 'text/plain')
  res.end(http.STATUS_CODES[res.statusCode] + '\n' + er.message)
}

var dirsReading = {}
function autoindex (url, path, opt, res) {
  if (dirsReading[path]) {
    dirsReading[path].push(res)
    return
  }
  dirsReading[path] = [res]
  fs.readdir(path, function (er, files) {
    if (!opt.dot) files = files.filter(function (f) {
      return !f.match(/^\./)
    })
    var ress = dirsReading[path]
    delete dirsReading[path]

    if (er) return ress.forEach(function (res) { error(res, er) })

    html = index(url, files)
    ress.forEach(function (res) {
      res.statusCode = 200
      res.setHeader('content-type', 'text/html')
      res.setHeader('content-length', html.length)
      res.end(html)
    })
  })
}

function index (url, files) {
  var str =
    '<!doctype html>' +
    '<html>' +
    '<head><title>Index of ' + url + '</title></head>' +
    '<body>' +
    '<h1>Index of ' + url + '</h1>' +
    '<hr><pre><a href="../">../</a>\n'

  files.forEach(function (file) {
    file = file.replace(/"/g, '&quot;')
    str += '<a href="' + file + '">' + file + '</a>\n'
  })
  str += '</pre><hr></body></html>'
  return new Buffer(str)
}
