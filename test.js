var http = require('http')
  , hreq = require('hyperquest')
  , test = require('tape')
  , bl   = require('bl')
  , bole = require('./')
  , pid  = process.pid
  , host = require('os').hostname()

/**
 * Awful copy pasting from bole.js
 */
var TRACE = 10;
var DEBUG = 20;
var INFO = 30;
var WARN = 40;
var ERROR = 50;
var FATAL = 60;

var levelFromName = {
    'trace': TRACE,
    'debug': DEBUG,
    'info': INFO,
    'warn': WARN,
    'error': ERROR,
    'fatal': FATAL
};

/**
 * Resolve a level number, name (upper or lowercase) to a level number value.
 */
function resolveLevel(nameOrNum) {
    var level = (typeof (nameOrNum) === 'string'
            ? levelFromName[nameOrNum.toLowerCase()]
            : nameOrNum);
    if (! (TRACE <= level && level <= FATAL)) {
        throw new Error('invalid level: ' + nameOrNum);
    }
    return level;
}

/**
 * End Awful copy pasting from bole.js
 */

function mklogobj (name, level, inp) {
  var out = {
          name    : name
        , hostname : host
        , pid      : pid
        , level    : resolveLevel(level)
        , msg      : ''
        , v        : 0      
        , time     : new Date().toISOString()
        , 
      }
    , k

  for (k in inp) {
    if (Object.prototype.hasOwnProperty.call(inp, k))
      out[k] = inp[k]
  }

  return out
}


// take a log string and zero out the millisecond field
// to make comparison a little safer (not *entirely* safe)
function safe (str) {
  return str.replace(/("time":"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.)\d{3}Z"/, '$1xxxZ')
}


test('test simple logging', function (t) {
  t.plan(1)
  t.on('end', bole.reset)

  var sink     = bl()
    , log      = bole('simple')
    , expected = []

  bole.output({
      level  : 'debug'
    , stream : sink
  })

  expected.push(mklogobj('simple', 'debug', { aDebug : 'object' }))
  log.debug({ aDebug: 'object' })
  expected.push(mklogobj('simple', 'info', { anInfo : 'object' }))
  log.info({ anInfo: 'object' })
  expected.push(mklogobj('simple', 'warn', { aWarn : 'object' }))
  log.warn({ aWarn: 'object' })
  expected.push(mklogobj('simple', 'error', { anError : 'object' }))
  log.error({ anError: 'object' })

  sink.end(function () {
    var exp = expected.reduce(function (p, c) {
      return p + JSON.stringify(c) + '\n'
    }, '')

    t.equal(safe(sink.slice().toString()), safe(exp))
  })
})


test('test multiple logs', function (t) {
  t.plan(1)
  t.on('end', bole.reset)

  var sink     = bl()
    , log1     = bole('simple1')
    , log2     = bole('simple2')
    , expected = []

  bole.output({
      level  : 'debug'
    , stream : sink
  })

  expected.push(mklogobj('simple1', 'debug', { aDebug : 'object' }))
  log1.debug({ aDebug: 'object' })
  expected.push(mklogobj('simple1', 'info', { anInfo : 'object' }))
  log1.info({ anInfo: 'object' })
  expected.push(mklogobj('simple2', 'warn', { aWarn : 'object' }))
  log2.warn({ aWarn: 'object' })
  expected.push(mklogobj('simple2', 'error', { anError : 'object' }))
  log2.error({ anError: 'object' })

  sink.end(function () {
    var exp = expected.reduce(function (p, c) {
      return p + JSON.stringify(c) + '\n'
    }, '')

    t.equal(safe(sink.slice().toString()), safe(exp))
  })
})


test('test multiple outputs', function (t) {
  t.plan(4)
  t.on('end', bole.reset)

  var debugSink = bl()
    , infoSink  = bl()
    , warnSink  = bl()
    , errorSink = bl()
    , log       = bole('simple')
    , expected  = []


  // add individual
  bole.output({
      level  : 'debug'
    , stream : debugSink
  })

  // add array
  bole.output([
      {
          level  : 'info'
        , stream : infoSink
      }
    , {
          level  : 'warn'
        , stream : warnSink
      }
  ])

  bole.output({
      level  : 'error'
    , stream : errorSink
  })

  expected.push(mklogobj('simple', 'debug', { aDebug : 'object' }))
  log.debug({ aDebug: 'object' })
  expected.push(mklogobj('simple', 'info', { anInfo : 'object' }))
  log.info({ anInfo: 'object' })
  expected.push(mklogobj('simple', 'warn', { aWarn : 'object' }))
  log.warn({ aWarn: 'object' })
  expected.push(mklogobj('simple', 'error', { anError : 'object' }))
  log.error({ anError: 'object' })

  debugSink.end()
  infoSink.end()
  warnSink.end()
  errorSink.end(function () {
    // debug
    var exp = expected.reduce(function (p, c) {
      return p + JSON.stringify(c) + '\n'
    }, '')

    t.equal(safe(debugSink.slice().toString()), safe(exp))

    // info
    exp = expected.slice(1).reduce(function (p, c) {
      return p + JSON.stringify(c) + '\n'
    }, '')

    t.equal(safe(infoSink.slice().toString()), safe(exp))

    // warn
    exp = expected.slice(2).reduce(function (p, c) {
      return p + JSON.stringify(c) + '\n'
    }, '')

    t.equal(safe(warnSink.slice().toString()), safe(exp))

    // error
    exp = expected.slice(3).reduce(function (p, c) {
      return p + JSON.stringify(c) + '\n'
    }, '')

    t.equal(safe(errorSink.slice().toString()), safe(exp))
  })
})


test('test string formatting', function (t) {
  t.plan(7)
  t.on('end', bole.reset)

  function testSingle (level, msg, args) {
    var sink     = bl()
      , log      = bole('strfmt')
      , expected

    bole.output({
        level  : level
      , stream : sink
    })

    expected = mklogobj('strfmt', level, msg)
    log[level].apply(log, args)

    sink.end(function () {
      var exp = JSON.stringify(expected) + '\n'
      t.equal(safe(sink.slice().toString()), safe(exp))
    })

    bole.reset()
  }

  testSingle('debug', {}, [])
  testSingle('debug', { msg: 'test' }, [ 'test' ])
  testSingle('info', { msg: 'true' }, [ true ])
  testSingle('info', { msg: 'false' }, [ false ])
  testSingle('warn', { msg: 'a number [42]' }, [ 'a number [%d]', 42 ])
  testSingle('error', { msg: 'a string [str]' }, [ 'a string [%s]', 'str' ])
  testSingle('error', { msg: 'foo bar baz' }, [ 'foo', 'bar', 'baz' ])
})


test('test error formatting', function (t) {
  t.plan(1)
  t.on('end', bole.reset)

  var sink     = bl()
    , log      = bole('errfmt')
    , err      = new Error('error msg in here')
    , expected

  bole.output({
      level  : 'debug'
    , stream : sink
  })

  expected = mklogobj('errfmt', 'debug', { err: {
      message : 'error msg in here'
    , name    : 'Error'
    , stack   : 'STACK'
  }})
  log.debug(err)

  sink.end(function () {
    var exp = JSON.stringify(expected) + '\n'
      , act = safe(sink.slice().toString())

    act = act.replace(/("stack":")Error:[^"]+/, '$1STACK')
    t.equal(act, safe(exp))
  })
})


test('test error formatting with message', function (t) {
  t.plan(1)
  t.on('end', bole.reset)

  var sink     = bl()
    , log      = bole('errfmt')
    , err      = new Error('error msg in here')
    , expected

  bole.output({
      level  : 'debug'
    , stream : sink
  })

  expected = mklogobj('errfmt', 'debug', {
      msg : 'this is a message'
    , err     : {
          message : 'error msg in here'
        , name    : 'Error'
        , stack   : 'STACK'
      }
  })
  log.debug(err, 'this is a %s', 'message')

  sink.end(function () {
    var exp = JSON.stringify(expected) + '\n'
      , act = safe(sink.slice().toString())

    act = act.replace(/("stack":")Error:[^"]+/, '$1STACK')
    t.equal(act, safe(exp))
  })
})


test('test request object', function (t) {
  t.on('end', bole.reset)

  var sink     = bl()
    , log      = bole('reqfmt')
    , expected
    , server
    , host

  bole.output({
      level  : 'info'
    , stream : sink
  })

  server = http.createServer(function (req, res) {
    expected = mklogobj('reqfmt', 'info', {
        req: {
            method : 'GET'
          , url    : '/foo?bar=baz'
          , headers : {
                host       : host
              , connection : 'close'
            }
          , remoteAddress : '127.0.0.1'
          , remotePort    : 'RPORT'
        }
    })
    log.info(req)

    res.end()

    sink.end(function () {
      var exp = JSON.stringify(expected) + '\n'
        , act = safe(sink.slice().toString())

      act = act.replace(/("remotePort":)\d+/, '$1"RPORT"')
      t.equal(act, safe(exp))

      server.close(t.end.bind(t))
    })
  })

  server.listen(function () {
    hreq.get('http://' + (host = this.address().address + ':' + this.address().port) + '/foo?bar=baz')
  })

})


test('test request object with message', function (t) {
  t.on('end', bole.reset)

  var sink     = bl()
    , log      = bole('reqfmt')
    , expected
    , server
    , host

  bole.output({
      level  : 'info'
    , stream : sink
  })

  server = http.createServer(function (req, res) {
    expected = mklogobj('reqfmt', 'info', {
        msg : 'this is a message'
      , req: {
            method : 'GET'
          , url    : '/foo?bar=baz'
          , headers : {
                host       : host
              , connection : 'close'
            }
          , remoteAddress : '127.0.0.1'
          , remotePort    : 'RPORT'
        }
    })
    log.info(req, 'this is a %s', 'message')

    res.end()

    sink.end(function () {
      var exp = JSON.stringify(expected) + '\n'
        , act = safe(sink.slice().toString())

      act = act.replace(/("remotePort":)\d+/, '$1"RPORT"')
      t.equal(act, safe(exp))

      server.close(t.end.bind(t))
    })
  })

  server.listen(function () {
    hreq.get('http://' + (host = this.address().address + ':' + this.address().port) + '/foo?bar=baz')
  })

})


test('test sub logger', function (t) {
  t.plan(1)
  t.on('end', bole.reset)

  var sink     = bl()
    , log      = bole('parent')
    , expected = []
    , sub1
    , sub2

  bole.output({
      level  : 'debug'
    , stream : sink
  })

  expected.push(mklogobj('parent', 'debug', { aDebug : 'object' }))
  log.debug({ aDebug: 'object' })
  expected.push(mklogobj('parent', 'info', { anInfo : 'object' }))
  log.info({ anInfo: 'object' })
  expected.push(mklogobj('parent', 'warn', { aWarn : 'object' }))
  log.warn({ aWarn: 'object' })
  expected.push(mklogobj('parent', 'error', { anError : 'object' }))
  log.error({ anError: 'object' })

  expected.push(mklogobj('parent:sub1', 'debug', { aDebug : 'object' }))
  ;(sub1 = log('sub1')).debug({ aDebug: 'object' })
  expected.push(mklogobj('parent:sub1', 'info', { anInfo : 'object' }))
  sub1.info({ anInfo: 'object' })
  expected.push(mklogobj('parent:sub2', 'warn', { aWarn : 'object' }))
  ;(sub2 = log('sub2')).warn({ aWarn: 'object' })
  expected.push(mklogobj('parent:sub2:subsub', 'error', { anError : 'object' }))
  sub2('subsub').error({ anError: 'object' })

  sink.end(function () {
    var exp = expected.reduce(function (p, c) {
      return p + JSON.stringify(c) + '\n'
    }, '')

    t.equal(safe(sink.slice().toString()), safe(exp))
  })
})
