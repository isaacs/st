module.exports = st

var mime = require('mime')
var path = require('path')
var LRU = require('lru-cache')
var fs = require('fs')
var url = require('url')
var zlib = require('zlib')
var Neg = require('negotiator')

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
  var cacheExpiry = opts.cacheExpiry
  if (isNaN(cacheExpiry)) cacheExpiry = 1000 * 60 * 10

  // fd cache
  var fdCacheSize = +opts.fdCacheSize
  if (isNaN(fdCacheSize) || fdCacheSize < 0) {
    fdCacheSize = 1024
  }
  var fdCache, statCache
  if (fdCacheSize > 0) {
    var fdCacheOpts = {
      max: fdCacheSize,
      dispose: function (key, fd) {
        fs.close(fd, function () {})
      }
    }
    fdCache = new LRU(fdCacheOpts)
    statCache = new LRU(fdCacheOpts)
  } else {
    // fake cache
    fdCache = statCache = {
      opening: {},
      set: function () {},
      get: function () {}
    }
  }

  // content cache
  var cacheSize = opts.cacheSize
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
    ru = ru.replace(/\/+$/, '')
    var pos = ru.indexOf(u)
    // not something we care about
    if (pos !== 0) {
      if (next) next()
      return false
    }

    // At this point, we're taking the request, because it's into the mount.
    // make sure to return true!

    var pru = path.resolve(p, ru)
    var etag = etags[pru]
    if (etag && etag === req.headers['if-none-match']) {
      res.statusCode = 304
      res.end()
      return true
    }

    // TODO: byte range requests.
    // does that play nice with gzip?  the spec is kinda dense.

    var gz = false
    if (opts.gz !== false) {
      var neg = req.negotiator || new Negotiator(req)
      gz = neg.preferredEncoding('gzip', 'identity') === 'gzip'
    }

    // see if the content is in cache.
    if (contentCache) {
      var cached = contentCache.get(pru)
      if (cached) {
        res.statusCode = 200
        res.setHeader('etag', cached.etag)
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
        // don't bother even attempting to cache if it's too big
        var doCache = contentCache && stat.size < cacheSize
        serve(res, fd, pru, doCache ? contentCache : null, gz, stat, etags)
      })
    })
    return true
  }
}

function serve (res, fd, pru, cache, gz, stat, etags) {
  // kind of wasteful.
  // should probably do the fs stuff manually
  // but if you aren't caching contents, then it's probably because the
  // files are big, and if you are caching contents, then it doesn't
  // matter most of the time anyway.
  var stream = fs.createReadStream(pru, { fd: fd, end: false })
  var gzstr = zlip.Gzip()
  stream.pipe(gzstr)

  res.statusCode = 200

  if (cache) {
    var ended = 0

    var clearBufs = []
    stream.on('data', clearBufs.push.bind(clearBufs))
    stream.on('end', function () {
      clearBufs = Buffer.concat(clearBufs)
      if (++ended === 2) finishCache()
    })

    var gzBufs = []
    gzstr.on('data', gzBufs.push.bind(gzBufs))
    gzstr.on('end', function () {
      gzBufs = Buffer.concat(gzBufs)
      if (++ended === 2) finishCache()
    })

    function finishCache () {
      // put it in the contentCache
      clearBufs.gz = gzBufs
      clearBufs.etag = [stat.dev, stat.ino, stat.mtime.getTime()].join(':')
      etags[pru] = etag
      cache.set(pru, clearBufs)
    }
  }

  // not sure whether it's better to gzip or to send a content-length
  // but at this point, ti would mean reading the whole file before
  // sending anything, since we don't know how big the gzipped will be.
  if (!gz) {
    res.setHeader(stat.size)
    stream.pipe(res)
  } else {
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
  res.statusCode = er.code === 'ENOENT' ? 404
                 : er.code === 'EACCES' ? 403
                 : 500
  if (res.error) {
    // pattern of express and ErrorPage
    return res.error(er, res.statusCode)
  }
  res.setHeader('content-type', 'text/plain')
  res.end(http.STATUS_CODES[res.statusCode] + '\n' er.message)
}
