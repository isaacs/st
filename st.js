import mime from 'mime'
import path from 'node:path'
import fsBuiltin from 'node:fs'
import zlib from 'node:zlib'
import { STATUS_CODES } from 'node:http'
import { createRequire } from 'node:module'
import Neg from 'negotiator'
import { LRUCache } from 'lru-cache'
import FD from 'fd'
import { BufferListStream } from 'bl'

const require = createRequire(import.meta.url)
let fs = fsBuiltin
try {
  fs = require('graceful-fs')
} catch {
  // graceful-fs is optional.
}

/**
 * @typedef {object} CacheEntryOptions
 * @property {number} [max] Maximum number of entries to keep.
 * @property {number} [maxSize] Maximum calculated cache size.
 * @property {number | false} [maxAge] Time in milliseconds before entries expire.
 * @property {(value: unknown, key?: string) => number} [sizeCalculation] Custom entry size calculation.
 * @property {string} [cacheControl] Explicit Cache-Control response header.
 */

/**
 * @typedef {object} CacheOptions
 * @property {false | CacheEntryOptions} [fd] File descriptor cache options.
 * @property {false | CacheEntryOptions} [stat] Stat cache options.
 * @property {false | CacheEntryOptions} [content] File content cache options.
 * @property {false | CacheEntryOptions} [index] Autoindex HTML cache options.
 * @property {false | CacheEntryOptions} [readdir] Directory listing cache options.
 */

/**
 * @typedef {object} Options
 * @property {string} path Directory to serve from.
 * @property {string} [url] URL mount point. Defaults to `/`.
 * @property {boolean | string} [index] Autoindex, index filename, or false for directory 404s.
 * @property {boolean} [dot] Allow dotfiles to be served.
 * @property {boolean | CacheOptions} [cache] Cache controls, or false to disable all caches.
 * @property {boolean} [passthrough] Call the next handler instead of returning a 404.
 * @property {boolean} [gzip] Enable gzip when accepted by the client. Defaults to true.
 * @property {boolean} [cors] Enable permissive CORS headers.
 * @property {boolean} [cachedHeader] Add an `x-from-cache` header to cached content responses.
 */

/**
 * @typedef {import('node:http').IncomingMessage & {
 *   sturl?: string | number | false,
 *   negotiator?: { preferredEncoding: (encodings: string[]) => string | undefined }
 * }} Request
 */

/**
 * @typedef {Request & { sturl: string }} ServedRequest
 */

/**
 * @typedef {import('node:http').ServerResponse & {
 *   filter?: NodeJS.ReadWriteStream,
 *   error?: (statusCode: number, error: unknown) => void
 * }} Response
 */

/**
 * @typedef {(req: Request, res: Response, next?: () => void) => boolean} ServeFunction
 */

/**
 * @typedef {ServeFunction & { _this: Mount }} Handler
 */

const defaultCacheOptions = {
  fd: {
    max: 1000,
    maxAge: 1000 * 60 * 60,
    ignoreFetchAbort: true
  },
  stat: {
    max: 5000,
    maxAge: 1000 * 60,
    ignoreFetchAbort: true
  },
  content: {
    maxSize: 1024 * 1024 * 64,
    sizeCalculation: (n) => n.length,
    maxAge: 1000 * 60 * 10,
    ignoreFetchAbort: true
  },
  index: {
    maxSize: 1024 * 8,
    sizeCalculation: (n) => n.length,
    maxAge: 1000 * 60 * 10,
    ignoreFetchAbort: true
  },
  readdir: {
    maxSize: 1000,
    sizeCalculation: (n) => Object.keys(n).length,
    maxAge: 1000 * 60 * 10,
    ignoreFetchAbort: true
  }
}

// lru-cache doesn't like when max=0, so we just pretend
// everything is really big.  kind of a kludge, but easiest way
// to get it done
const none = {
  maxSize: 1,
  sizeCalculation: () => Number.MAX_SAFE_INTEGER
}

const noCaching = {
  fd: none,
  stat: none,
  index: none,
  readdir: none,
  content: none
}

const noCache = (fetch) => {
  return {
    maxSize: 0,
    fetch,
    has: () => false,
    get: () => undefined,
    set: () => {},
    dump: () => []
  }
}

/**
 * Create a static file serving handler.
 *
 * @param {string | Options} opt Path to serve, or full options object.
 * @param {string | Options} [url] Mount URL, or options when the first parameter is a path.
 * @param {Options} [options] Options when the first two parameters are path and URL.
 * @returns {Handler}
 */
function st (opt, url, options) {
  let p, u
  /** @type {Options | undefined} */
  let stOpt
  if (typeof opt === 'string') {
    p = opt
    if (typeof url === 'string') {
      u = url
      stOpt = options
    } else {
      stOpt = url
    }
  } else {
    stOpt = opt
  }

  if (!stOpt) {
    stOpt = /** @type {Options} */ ({})
  } else {
    stOpt = Object.assign({}, stOpt)
  }

  if (!p) {
    p = stOpt.path
  }
  if (typeof p !== 'string') {
    throw new Error('no path specified')
  }
  p = path.resolve(p)
  if (!u) {
    u = stOpt.url
  }
  if (!u) {
    u = ''
  }
  if (u.charAt(0) !== '/') {
    u = '/' + u
  }

  stOpt.url = u
  stOpt.path = p

  const m = new Mount(stOpt)
  const fn = /** @type {Handler} */ (m.serve.bind(m))
  fn._this = m
  return fn
}

class Mount {
  /**
   * @param {Options} opt
   */
  constructor (opt) {
    if (!opt) {
      throw new Error('no options provided')
    }
    if (typeof opt !== 'object') {
      throw new Error('invalid options')
    }
    this.opt = opt
    this.url = opt.url
    this.path = opt.path
    this._index = opt.index === false
      ? false
      : typeof opt.index === 'string'
        ? opt.index
        : true
    this.fdman = FD()

    // cache basically everything
    const c = this.getCacheOptions(opt)
    this.cache = {
      fd: c.fd.noCache ? noCache(c.fd.fetchMethod) : new LRUCache(c.fd),
      stat: c.stat.noCache ? noCache(c.stat.fetchMethod) : new LRUCache(c.stat),
      index: c.index.noCache ? noCache(c.index.fetchMethod) : new LRUCache(c.index),
      readdir: c.readdir.noCache ? noCache(c.readdir.fetchMethod) : new LRUCache(c.readdir),
      content: c.content.noCache ? noCache(c.content.fetchMethod) : new LRUCache(c.content)
    }

    this._cacheControl =
      c.content.maxAge === false
        ? undefined
        : typeof c.content.cacheControl === 'string'
          ? c.content.cacheControl
          : opt.cache === false
            ? 'no-cache'
            : 'public, max-age=' + (c.content.maxAge / 1000)
  }

  /**
   * @param {Options} opt
   */
  getCacheOptions (opt) {
    let o = opt.cache
    const set = (key) => {
      return o[key] === false
        ? Object.assign({ noCache: true }, none)
        : Object.assign(Object.assign({}, d[key]), o[key])
    }

    if (o === false) {
      o = noCaching
    } else if (!o) {
      o = {}
    }

    const d = defaultCacheOptions

    // should really only ever set max and maxAge here.
    // fetchMethod and fd disposal is important to control.
    const c = {
      fd: set('fd'),
      stat: set('stat'),
      index: set('index'),
      readdir: set('readdir'),
      content: set('content')
    }

    c.fd.dispose = (fd, key) => this.fdman.close(key, fd)
    c.fd.fetchMethod = (key) => new Promise((resolve, reject) => this.fdman.open(key, (err, fd) => err ? reject(err) : resolve(fd)))

    c.stat.fetchMethod = (key) => new Promise((resolve, reject) => this._loadStat(key, (err, fd) => err ? reject(err) : resolve(fd)))
    c.index.fetchMethod = (key) => new Promise((resolve, reject) => this._loadIndex(key, (err, fd) => err ? reject(err) : resolve(fd)))
    c.readdir.fetchMethod = (key) => new Promise((resolve, reject) => this._loadReaddir(key, (err, fd) => err ? reject(err) : resolve(fd)))
    c.content.fetchMethod = (key) => new Promise((resolve, reject) => this._loadContent(key, (err, fd) => err ? reject(err) : resolve(fd)))

    return c
  }

  // get the path component from a URI
  /**
   * @param {string} u
   */
  getUriPath (u) {
    let p = new URL(u, 'http://base').pathname

    // Percent-decode before checking for `..` segments. The URL parser only
    // resolves dot-segments that appear literally in the pathname, so an
    // encoded separator (e.g. `/..%2f..%2fsecret`) keeps the `..` hidden and
    // sails past the traversal check below until it is decoded. Decoding first
    // means the check, and `path.normalize` after it, see the real path.
    try {
      p = decodeURIComponent(p)
    } catch (e) {
      // not a valid url-encoded path, so we can't safely serve it
      return false
    }

    // Convert any backslashes to forward slashes (for consistency)
    p = p.replace(/\\/g, '/')

    if ((/(^|\/)\.\.(\/|$)/).test(p)) {
      return 403
    }

    u = path.normalize(p).replace(/\\/g, '/')
    const prefix = this.url.endsWith('/') ? this.url : this.url + '/'
    if (this.url !== '/' && u !== this.url && u.indexOf(prefix) !== 0) {
      return false
    }

    u = u.substr(this.url.length)
    if (u.charAt(0) !== '/') {
      u = '/' + u
    }
    if ((/(^|\/)\.\.(\/|$)/).test(u)) {
      return 403
    }

    return u
  }

  // get a path from a url
  /**
   * @param {string} u
   */
  getPath (u) {
    // Normalize paths by removing trailing slashes
    // This ensures consistent paths for directory content rendering
    while (u.length > 0 && u[u.length - 1] === '/') {
      u = u.slice(0, -1)
    }

    const p = path.resolve(this.path, '.' + u)
    const rel = path.relative(this.path, p)
    if (rel === '..' || rel.indexOf('..' + path.sep) === 0 || path.isAbsolute(rel)) {
      return 403
    }

    return p
  }

  // get a url from a path
  /**
   * @param {string} p
   */
  getUrl (p) {
    p = path.resolve(p)
    if (p.indexOf(this.path) !== 0) {
      return false
    }
    p = path.join('/', p.substr(this.path.length))
    const u = path.join(this.url, p).replace(/\\/g, '/')
    return u
  }

  /**
   * @param {Request} req
   * @param {Response} res
   * @param {() => void} [next]
   */
  serve (req, res, next) {
    if (req.method !== 'HEAD' && req.method !== 'GET') {
      if (typeof next === 'function') {
        next()
      }
      return false
    }

    // querystrings are of no concern to us
    if (!req.sturl) {
      req.sturl = this.getUriPath(req.url)
    }

    // don't allow dot-urls by default, unless explicitly allowed.
    // If we got a 403, then it's explicitly forbidden.
    if (req.sturl === 403 || (!this.opt.dot && typeof req.sturl === 'string' && (/(^|\/)\./).test(req.sturl))) {
      res.statusCode = 403
      res.end(STATUS_CODES[res.statusCode])
      return true
    }

    // Falsey here means we got some kind of invalid path.
    // Probably urlencoding we couldn't understand, or some
    // other "not compatible with st, but maybe ok" thing.
    if (typeof req.sturl !== 'string' || req.sturl === '') {
      if (typeof next === 'function') {
        next()
      }
      return false
    }

    const sturl = req.sturl
    const servedReq = /** @type {ServedRequest} */ (req)
    const p = this.getPath(sturl)
    if (p === 403) {
      res.statusCode = 403
      res.end(STATUS_CODES[res.statusCode])
      return true
    }

    // now we have a path.  check for the fd.
    this.cache.fd.fetch(p).then(
      (fd) => {
        // we may be about to use this, so don't let it be closed by cache purge
        this.fdman.checkout(p, fd)
        // a safe end() function that can be called multiple times but
        // only perform a single checkin
        const end = this.fdman.checkinfn(p, fd)

        this.cache.stat.fetch(fd + ':' + p).then(
          (stat) => {
            const isDirectory = stat.isDirectory()

            if (isDirectory) {
              end() // we won't need this fd for a directory in any case
              if (next && this.opt.passthrough === true && this._index === false) {
                // this is done before if-modified-since and if-non-match checks so
                // cached modified and etag values won't return 304's if we've since
                // switched to !index. See Issue #51.
                return next()
              }
            }

            const imsHeader = req.headers['if-modified-since']
            const ims = imsHeader ? new Date(String(imsHeader)).getTime() : 0
            if (ims && ims >= stat.mtime.getTime()) {
              res.statusCode = 304
              res.end()
              return end()
            }

            const etag = getEtag(stat)
            if (req.headers['if-none-match'] === etag) {
              res.statusCode = 304
              res.end()
              return end()
            }

            // only set headers once we're sure we'll be serving this request
            if (!res.getHeader('cache-control') && this._cacheControl) {
              res.setHeader('cache-control', this._cacheControl)
            }
            res.setHeader('last-modified', stat.mtime.toUTCString())
            res.setHeader('etag', etag)

            if (this.opt.cors) {
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.setHeader('Access-Control-Allow-Headers',
                'Origin, X-Requested-With, Content-Type, Accept, Range')
            }

            return isDirectory
              ? this.index(p, servedReq, res)
              : this.file(p, fd, stat, etag, req, res, end)
          },
          (er) => {
            if (next && this.opt.passthrough === true && this._index === false) {
              return next()
            }
            end()
            return this.error(er, res)
          }
        )
      },
      (er) => {
        // inability to open is some kind of error, probably 404
        // if we're in passthrough, AND got a next function, we can
        // fall through to that.  otherwise, we already returned true,
        // send an error.
        if (this.opt.passthrough === true && er.code === 'ENOENT' && next) {
          return next()
        }
        return this.error(er, res)
      }
    )

    return true
  }

  /**
   * @param {NodeJS.ErrnoException | number} er
   * @param {Response} res
   */
  error (er, res) {
    res.statusCode = typeof er === 'number'
      ? er
      : er.code === 'ENOENT' || er.code === 'EISDIR'
        ? 404
        : er.code === 'EPERM' || er.code === 'EACCES'
          ? 403
          : 500

    if (typeof res.error === 'function') {
      // pattern of express and ErrorPage
      return res.error(res.statusCode, er)
    }

    res.setHeader('content-type', 'text/plain')
    res.end(STATUS_CODES[res.statusCode] + '\n')
  }

  /**
   * @param {string} p
   * @param {ServedRequest} req
   * @param {Response} res
   */
  index (p, req, res) {
    if (this._index === true) {
      return this.autoindex(p, req, res)
    }
    if (typeof this._index === 'string') {
      if (!/\/$/.test(req.sturl)) {
        req.sturl += '/'
      }
      req.sturl += this._index
      return this.serve(req, res)
    }
    return this.error(404, res)
  }

  /**
   * @param {string} p
   * @param {ServedRequest} req
   * @param {Response} res
   */
  autoindex (p, req, res) {
    if (!/\/$/.exec(req.sturl)) {
      res.statusCode = 301
      res.setHeader('location', req.sturl + '/')
      res.end('Moved: ' + req.sturl + '/')
      return
    }

    this.cache.index.fetch(p).then(
      (html) => {
        res.statusCode = 200
        res.setHeader('content-type', 'text/html')
        res.setHeader('content-length', html.length)
        res.end(html)
      },
      (er) => this.error(er, res)
    )
  }

  /**
   * @param {string} p
   * @param {number} fd
   * @param {import('node:fs').Stats} stat
   * @param {string} etag
   * @param {Request} req
   * @param {Response} res
   * @param {() => void} end
   */
  file (p, fd, stat, etag, req, res, end) {
    const key = stat.size + ':' + etag

    const mt = mime.getType(path.extname(p))
    if (mt !== 'application/octet-stream') {
      res.setHeader('content-type', mt)
    }

    // only use the content cache if it will actually fit there.
    if (this.cache.content.has(key)) {
      end()
      this.cachedFile(p, stat, etag, req, res)
    } else {
      this.streamFile(p, fd, stat, etag, req, res, end)
    }
  }

  /**
   * @param {string} p
   * @param {import('node:fs').Stats} stat
   * @param {string} etag
   * @param {Request} req
   * @param {Response} res
   */
  cachedFile (p, stat, etag, req, res) {
    const key = stat.size + ':' + etag
    const gz = this.opt.gzip !== false && getGz(p, req)

    const content = this.cache.content.get(key)
    res.statusCode = 200
    if (this.opt.cachedHeader) {
      res.setHeader('x-from-cache', 'true')
    }
    if (gz && content.gz) {
      res.setHeader('content-encoding', 'gzip')
      res.setHeader('content-length', content.gz.length)
      res.end(content.gz)
    } else {
      res.setHeader('content-length', content.length)
      res.end(content)
    }
  }

  /**
   * @param {string} p
   * @param {number} fd
   * @param {import('node:fs').Stats} stat
   * @param {string} etag
   * @param {Request} req
   * @param {Response} res
   * @param {() => void} end
   */
  streamFile (p, fd, stat, etag, req, res, end) {
    const streamOpt = { fd, start: 0, end: stat.size }
    const sourceStream = fs.createReadStream(p, streamOpt)
    sourceStream.destroy = () => sourceStream
    let stream = /** @type {NodeJS.ReadableStream} */ (sourceStream)

    // gzip only if not explicitly turned off or client doesn't accept it
    const gzOpt = this.opt.gzip !== false
    const gz = gzOpt && getGz(p, req)
    const cachable = this.cache.content.maxSize > stat.size
    let gzstr

    // need a gzipped version for the cache, so do it regardless of what the client wants
    if (gz || (gzOpt && cachable)) {
      gzstr = zlib.createGzip()
    }

    // too late to effectively handle any errors.
    // just kill the connection if that happens.
    stream.on('error', (e) => {
      console.error('Error serving %s fd=%d\n%s', p, fd, e.stack || e.message)
      res.socket.destroy()
      end()
    })

    if (res.filter) {
      stream = stream.pipe(res.filter)
    }

    res.statusCode = 200

    if (gz) {
      // we don't know how long it'll be, since it will be compressed.
      res.setHeader('content-encoding', 'gzip')
      stream.pipe(gzstr).pipe(res)
    } else {
      if (!res.filter) {
        res.setHeader('content-length', stat.size)
      }
      stream.pipe(res)
      if (gzstr) {
        stream.pipe(gzstr)
      } // for cache
    }

    stream.on('end', () => process.nextTick(end))

    if (cachable) {
      // collect it, and put it in the cache

      let calls = 0

      // called by bl() for both the raw stream and gzipped stream if we're
      // caching gzipped data
      const collectEnd = () => {
        if (++calls === (gzOpt ? 2 : 1)) {
          const content = /** @type {Buffer & { gz?: Buffer }} */ (bufs.slice())
          content.gz = gzbufs && gzbufs.slice()
          this.cache.content.set(key, content)
        }
      }

      const key = stat.size + ':' + etag
      const bufs = new BufferListStream(collectEnd)
      let gzbufs

      stream.pipe(bufs)

      if (gzstr) {
        gzbufs = new BufferListStream(collectEnd)
        gzstr.pipe(gzbufs)
      }
    }
  }

  // cache-fillers

  /**
   * @param {string} p
   * @param {(error: NodeJS.ErrnoException | null, data?: Buffer) => void} cb
   */
  _loadIndex (p, cb) {
    // truncate off the first bits
    const url = p.substr(this.path.length).replace(/\\/g, '/')
    const t = url
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&#39;')

    let str =
      '<!doctype html>' +
      '<html>' +
      '<head><title>Index of ' + t + '</title></head>' +
      '<body>' +
      '<h1>Index of ' + t + '</h1>' +
      '<hr><pre><a href="../">../</a>\n'

    this.cache.readdir.fetch(p).then(
      (data) => {
        let nameLen = 0
        let sizeLen = 0

        Object.keys(data).map((f) => {
          const d = data[f]

          let name = f
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/'/g, '&#39;')

          if (d.size === '-') {
            name += '/'
          }
          const showName = name.replace(/^(.{40}).{3,}$/, '$1..>')
          const linkName = encodeURIComponent(name)
            .replace(/%2e/ig, '.') // Encoded dots are dots
            .replace(/%2f|%5c/ig, '/') // encoded slashes are /
            .replace(/[/\\]/g, '/') // back slashes are slashes

          nameLen = Math.max(nameLen, showName.length)
          sizeLen = Math.max(sizeLen, ('' + d.size).length)
          return ['<a href="' + linkName + '">' + showName + '</a>',
            d.mtime, d.size, showName]
        }).sort((a, b) => {
          return a[2] === '-' && b[2] !== '-' // dirs first
            ? -1
            : a[2] !== '-' && b[2] === '-'
              ? 1
              : a[0].toLowerCase() < b[0].toLowerCase() // then alpha
                ? -1
                : a[0].toLowerCase() > b[0].toLowerCase()
                  ? 1
                  : 0
        }).forEach((line) => {
          const namePad = new Array(8 + nameLen - line[3].length).join(' ')
          const sizePad = new Array(8 + sizeLen - ('' + line[2]).length).join(' ')
          str += line[0] + namePad +
            line[1].toISOString() +
            sizePad + line[2] + '\n'
        })

        str += '</pre><hr></body></html>'
        cb(null, Buffer.from(str))
      },
      (er) => cb(er)
    )
  }

  /**
   * @param {string} p
   * @param {(error: NodeJS.ErrnoException | null, data?: Record<string, import('node:fs').Stats>) => void} cb
   */
  _loadReaddir (p, cb) {
    let len
    let data
    fs.readdir(p, (er, files) => {
      if (er) {
        return cb(er)
      }
      files = files.filter((f) => {
        if (!this.opt.dot) {
          return !/^\./.test(f)
        } else {
          return f !== '.' && f !== '..'
        }
      })
      len = files.length
      data = {}
      files.forEach((file) => {
        const pf = path.join(p, file)
        this.cache.stat.fetch(pf).then(
          (stat) => {
            if (stat.isDirectory()) {
              stat.size = '-'
            }
            data[file] = stat
            next()
          },
          (er) => cb(er)
        )
      })
    })

    const next = () => {
      if (--len === 0) {
        cb(null, data)
      }
    }
  }

  /**
   * @param {string} key
   * @param {(error: NodeJS.ErrnoException | null, data?: import('node:fs').Stats) => void} cb
   */
  _loadStat (key, cb) {
    // key is either fd:path or just a path
    const fdp = key.match(/^(\d+):(.*)/)
    if (fdp) {
      const fd = +fdp[1]
      const p = fdp[2]
      fs.fstat(fd, (er, stat) => {
        if (er) {
          return cb(er)
        }
        this.cache.stat.set(p, stat)
        cb(null, stat)
      })
    } else {
      fs.stat(key, cb)
    }
  }

  /**
   * @param {string} _
   * @param {(error: Error) => void} cb
   */
  _loadContent (_, cb) {
    // this function should never be called.
    // we check if the thing is in the cache, and if not, stream it in
    // manually.  this.cache.content.fetch() should not ever happen.
    return cb(new Error('This should never happen'))
  }
}

/**
 * @param {import('node:fs').Stats} s
 */
function getEtag (s) {
  return '"' + s.dev + '-' + s.ino + '-' + s.mtime.getTime() + '"'
}

/**
 * @param {string} p
 * @param {Request} req
 */
function getGz (p, req) {
  let gz = false
  if (!/\.t?gz$/.exec(p)) {
    const neg = req.negotiator || new Neg(req)
    gz = neg.preferredEncoding(['gzip', 'identity']) === 'gzip'
  }
  return gz
}

export { Mount }
export default st
