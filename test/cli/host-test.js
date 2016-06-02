var os = require('os')
var tap = require('tap')
var test = tap.test
var common = require('./common')
var serve = common.serve

var otherAddress = (function () {
  var ifaces = os.networkInterfaces()
  for (var iface in ifaces) {
    var addrs = ifaces[iface]
    for (var i = 0; i < addrs.length; ++i) {
      var addr = addrs[i].address
      if (/^127\./.test(addr) || /^::1$/.test(addr)) // loopback device
        continue
      if (/^fe80:/.test(addr)) // link-local address
        continue
      return addr
    }
  }
  return null
})()
if (!otherAddress) {
  tap.fail('No non-loopback network address found', {skip: true})
  test = function () {}
} else {
  tap.comment('Using ' + otherAddress + ' as non-localhost address')
}

function addr2url (addr, path) {
  if (/:/.test(addr)) addr = '[' + addr + ']'
  addr = 'http://' + addr + ':' + common.port
  if (path) addr += path
  return addr
}

function testServer (name, args, addr, canConnect, cannotConnect) {
  test(name, function (t) {
    serve(args, function (req) {
      canConnect.forEach(checkConnections(t, req, true))
      cannotConnect.forEach(checkConnections(t, req, false))
    }, function (err, stdout, stderr) {
      t.ifError(err)
      t.equal(stderr, '')
      if (addr) {
        t.equal(stdout, 'listening at ' + addr2url(addr) + '\n')
      }
      t.end()
    })
  })
}

function checkConnections (t, req, canConnect) {
  return function (addr) {
    var url = addr2url(addr, '/st.js')
    req(url, function (er, res, body) {
      if (canConnect) {
        t.ifError(er, url) && t.equal(res.statusCode, 200, url)
      } else {
        t.ok(er, url)
      }
    })
  }
}

testServer(
  'Listening on all ports by default',
  [], null,
  ['127.0.0.1', 'localhost', otherAddress], []
)

testServer(
  'Restricted to localhost',
  ['--localhost'], 'localhost',
  ['127.0.0.1', 'localhost'], [otherAddress]
)

testServer(
  'Restricted to non-local host',
  ['--host', otherAddress], otherAddress,
  [otherAddress], ['127.0.0.1']
)

testServer(
  'Restricted to IPv4',
  ['--host', '127.0.0.1'], '127.0.0.1',
  ['127.0.0.1'], ['::1']
)
