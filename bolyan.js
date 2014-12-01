var stringify  = require('json-stringify-safe')
  , format     = require('util').format
  , is         = require('core-util-is')
  , individual = require('individual')('$$bolyan', { })
  , levels     = 'trace debug info warn error fatal'.split(' ')
  , hostname   = require('os').hostname()
  , pid        = process.pid

/**
 * START: bits copied from bunyan
 */

var LOG_VERSION = 0;

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

// Serialize an HTTP request.
function reqSerializer (req) {
    if (!req || !req.connection)
        return req;
    return {
        method: req.method,
        url: req.url,
        headers: req.headers,
        remoteAddress: req.connection.remoteAddress,
        remotePort: req.connection.remotePort
    };
    // Trailers: Skipping for speed. If you need trailers in your app, then
    // make a custom serializer.
    //if (Object.keys(trailers).length > 0) {
    //  obj.trailers = req.trailers;
    //}
};

// Serialize an HTTP response.
function resSerializer (res) {
    if (!res || !res.statusCode)
        return res;
    return {
        statusCode: res.statusCode,
        header: res._header
    }
};

// Serialize an Error object
// (Core error properties are enumerable in node 0.4, not in 0.6).
function errSerializer (err) {
    if (!err || !err.stack)
        return err;
    var obj = {
        message: err.message,
        name: err.name,
        stack: stackToString(err),
        code: err.code,
        signal: err.signal
    }
    return obj;
};

function _applySerializers (fields) {

  Object.keys(serializers).forEach(function (name) {

    if (fields[name] === undefined)
    {
      return;
    }
    fields[name] = serializers[name](fields[name]);

  })
}
/**
 * END: bits copied from bunyan
 */

// TODO: maybe make this editable/configurable like output is
var serializers = {
  req: reqSerializer,
  res: resSerializer,
  err: errSerializer
}


/*
 * (Doc block from bunyan - for info purposes)
 * This function dumps long stack traces for exceptions having a cause()
 * method. The error classes from
 * [verror](https://github.com/davepacheco/node-verror) and
 * [restify v2.0](https://github.com/mcavage/node-restify) are examples.
 *
 * Based on `dumpException` in
 * https://github.com/davepacheco/node-extsprintf/blob/master/lib/extsprintf.js
 */
function stackToString (e) {
  var s = e.stack
    , ce

  if (is.isFunction(e.cause) && (ce = e.cause()))
    s += '\nCaused by: ' + stackToString(ce)

  return s
}


function levelLogger (level, name) {
  return function (inp) {
    var outputs = individual[level]

    if (!outputs)
      return // no outputs for this level

    var out = {
            name     : name
          , hostname : hostname
          , pid      : pid
          , level    : resolveLevel(level)
          , msg      : ''
          , v        : LOG_VERSION
          , time     : new Date().toISOString()
          , 
        }
      , k
      , i = 0
      , s

    if (is.isError(inp)) {
      if (arguments.length > 1)
        out.msg = format.apply(null, Array.prototype.slice.call(arguments, 1))

      out.err = errSerializer(inp)
    } else if (is.isObject(inp) && inp.method && inp.url && inp.headers && inp.socket) {
      if (arguments.length > 1)
        out.msg = format.apply(null, Array.prototype.slice.call(arguments, 1))

      out.req = reqSerializer(inp)
    } else if (is.isObject(inp)) {
      if (arguments.length > 1)
        out.msg = format.apply(null, Array.prototype.slice.call(arguments, 1))
      _applySerializers(inp); // magic serialisation goes here...
      for (k in inp) {
        if (Object.prototype.hasOwnProperty.call(inp, k))
          out[k] = inp[k]
      }
    } else if (!is.isUndefined(inp)) {
      out.msg = format.apply(null, arguments)
    }

    s = stringify(out) + '\n'

    for (; i < outputs.length; i++)
      outputs[i].write(s)
  }
}


function bolyan (name) {
  function bolyanLogger (subname) {
    return bolyan(name + ':' + subname)
  }

  function makeLogger (p, level) {
    p[level] = levelLogger(level, name)
    return p
  }

  return levels.reduce(makeLogger, bolyanLogger)
}


bolyan.output = function (opt) {
  if (Array.isArray(opt))
    return opt.forEach(bolyan.output)

  var i = 0
    , b = false

  for (; i < levels.length; i++) {
    if (levels[i] === opt.level)
      b = true

    if (b) {
      if (!individual[levels[i]])
        individual[levels[i]] = []
      individual[levels[i]].push(opt.stream)
    }
  }
}


bolyan.reset = function () {
  for (var k in individual)
    delete individual[k]
}


module.exports = bolyan