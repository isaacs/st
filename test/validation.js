var common = require('./common')
var tap = require('tap')

var test = tap.test
var st = require('../st.js')

module.exports.stExpect = common.stExpect


test('Throw no path', function (t) {
    try {
        st({})
    }
    catch(e) {
        t.equal(e.message, 'foo')
        t.end()
    }
})

