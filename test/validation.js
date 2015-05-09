var common = require('./common')
var tap = require('tap')

var test = tap.test
var st = require('../st.js')

module.exports.stExpect = common.stExpect


test('Throw no path', function (t) {
    t.throws(function(){st({})},'no path specified')
    t.end()
})

test('A number is not a path', function (t) {
    t.throws(function(){st({path:1})},'no path specified')
    t.end()
})

test('A number is not a url', function (t) {
    t.throws(function(){st({path:"foo", url:1})},'URL not a string')
    t.end()
})

test('Bad options', function (t) {
    var options = {
        foo:1,
        path:"foo",
        url:"foo",
        index: 1,
        dot: 1,
        passthrough: 1,
        gzip: 1,
        autoindex:1,
        cachedHeader: 1,
        cache: 1
    }
    var list =[
        "options:2:cache does not match any spec",
        "options:2:cache:some:0 argument is not false",
        "options:2:cache:some:1 argument is not an object",
        "options:2:cachedHeader is not a boolean",
        "options:2:autoindex is not a boolean",
        "options:2:gzip is not a boolean",
        "options:2:passthrough is not a boolean",
        "options:2:dot is not a boolean",
        "options:2:index does not match any spec",
        "options:2:index:some:0 is not a string",
        "options:2:index:some:1 is not a boolean",
        "options:2:foo is not in the spec"
    ]
    t.throws(function(){st(options)},new Error(list.join('\n')))
    t.end()
})

test('Bad cache options', function (t) {
    var options = {
        path:"foo",
        url:"foo",
        cache: {
            fd:1,
            stat: 1,
            content: 1,
            index: 1,
            readdir: 1
        }
    }

    var list =[
        "options:2:cache does not match any spec",
        "options:2:cache:some:0 argument is not false",
        "options:2:cache:some:1:fd does not match any spec",
        "options:2:cache:some:1:fd:some:0 argument is not false",
        "options:2:cache:some:1:fd:some:1 argument is not an object",
        "options:2:cache:some:1:stat argument is not an object",
        "options:2:cache:some:1:content argument is not an object",
        "options:2:cache:some:1:index argument is not an object",
        "options:2:cache:some:1:readdir argument is not an object"
    ]
    t.throws(function(){st(options)},new Error(list.join('\n')))
    t.end()
})

test('Bad cache suboptions', function (t) {
    var options = {
        path:"foo",
        url:"foo",
        cache: {
            fd:{max:false, maxAge:false},
            stat: {max:false, maxAge:false},
            content: {max:false, maxAge:true, cacheControl:false, length:false},
            index: {max:false, maxAge:true, length:false},
            readdir: {max:false, maxAge:true, length:false}
        }
    }

    var list =[
        "options:2:cache does not match any spec",
        "options:2:cache:some:0 argument is not false",
        "options:2:cache:some:1:fd does not match any spec",
        "options:2:cache:some:1:fd:some:0 argument is not false",
        "options:2:cache:some:1:fd:some:1:max is not a number",
        "options:2:cache:some:1:fd:some:1:maxAge is not a number",
        "options:2:cache:some:1:stat:max is not a number",
        "options:2:cache:some:1:stat:maxAge is not a number",
        "options:2:cache:some:1:content:max is not a number",
        "options:2:cache:some:1:content:maxAge does not match any spec",
        "options:2:cache:some:1:content:maxAge:some:0 is not a number",
        "options:2:cache:some:1:content:maxAge:some:1 argument is not false",
        "options:2:cache:some:1:content:cacheControl is not a string",
        "options:2:cache:some:1:content:length is not a function",
        "options:2:cache:some:1:index:max is not a number",
        "options:2:cache:some:1:index:maxAge is not a number",
        "options:2:cache:some:1:index:length is not a function",
        "options:2:cache:some:1:readdir:max is not a number",
        "options:2:cache:some:1:readdir:maxAge is not a number",
        "options:2:cache:some:1:readdir:length is not a function"
    ]
    t.throws(function(){st(options)},new Error(list.join('\n')))
    t.end()
})
