const Socket = require('net').Socket
    , EventEmitter = require('events').EventEmitter
    , util = require('util')
    , defaults = require('./default')
    , NEW_LINE = '\r\n'
    , END_LINE = '\r\n\r\n'
    , COLON_SEP = ': '

function AMI(opt) {
  opt = opt || {}

  this._config = Object.assign(defaults, opt)

  this._connection = null
  this._requestMap = {}
  this._connected = false
  this._msgBuffer = ''
  this._requestQueues = []
  this._requestOnWork = false
  // This just for unique ActionID
  this._requestId = +new Date()
}

AMI.prototype.start = function() {
  let eventMap = {
    'connect': this._onConnect.bind(this),
    'close': this._onClose.bind(this),
    'data': this._onData.bind(this),
    'end': this._onEnd.bind(this),
    'error': this._onError.bind(this)
  }
  this._connection = new Socket()

  this._connection.connect(this._config.port, this._config.host)
  this._connection.setKeepAlive(true)
  this._connection.setNoDelay(true)
  this._connection.setEncoding('utf-8')
  this._connection.once('connect', this._authenticate.bind(this))

  for (let evt in eventMap) {
    this._connection.on(evt, eventMap[evt])
  }
}

AMI.prototype.action = function(name, params) {
  params = params || {}
  params.Action = name
  params.ActionID = this._requestId++

  let message = this._createMessage(params)
    , promise = new Promise((resolve, reject) => {
    this._requestMap[params.ActionID] = {
      resolve: resolve,
      reject: reject
    }
  })

  this._requestQueues.push(message)

  if (!this._requestOnWork) {
    this._requestWorker()
  }

  return promise
}

AMI.prototype._requestWorker = function() {
  let message = this._requestQueues.shift()
  this._requestOnWork = this._requestQueues.length > 0

  if (message) {
    this._connection.write(message)
  }
}

AMI.prototype._createMessage = function(obj) {
  let msg = []
  for (let k in obj) {
    msg.push([k, COLON_SEP, obj[k]].join(''))
  }

  msg.push(NEW_LINE)

  return msg.join(NEW_LINE)
}

AMI.prototype._authenticate = function() {
  this._connected = true

  this.action('Login', {
    Username: this._config.username,
    Secret: this._config.secret,
    Events: this._config.events ? 'on' : 'off'
  }).then(() => {
    this.emit('authenticated')
  }).catch((err) => {
    this.emit('error', new Error(err.toString()))
  })
}

AMI.prototype._parseMessage = function(message) {
  let result, endLineIndex, msgLines
    , msgLine, msgLineSplit

  this._msgBuffer += message

  while ((endLineIndex = this._msgBuffer.indexOf(END_LINE)) != -1) {
    msgLines = this._msgBuffer.substr(0, endLineIndex+2).split(NEW_LINE)
    this._msgBuffer = this._msgBuffer.substr(endLineIndex+4)
    result = {}

    for (let i=0;i<msgLines.length;i++) {
      msgLine = msgLines[i]

      if (msgLine.indexOf(COLON_SEP) != -1) {
        msgLineSplit = msgLine.split(COLON_SEP)
        result[msgLineSplit[0]] = msgLineSplit[1]
      }
    }

    if (result.Event || result.Response) {
      this._asteriskResponse(result)
    }
  }
}

AMI.prototype._onConnect = function() {
  this.emit('connected')
}

AMI.prototype._onClose = function(err) {
  this._connected = false
  this.emit('disconnected', err)
  this._connection.destroy()

  if (this._config.keepAlive) {

  }
}

AMI.prototype._onEnd = function() {
  this._connection.end()
  this._onClose()
}

AMI.prototype._onError = function(err) {
  this.emit('error', err)
}

AMI.prototype._onData = function(buffer) {
  let data = buffer.toString()

  if (data.startsWith('Asterisk Call Manager')) {
    data.split(NEW_LINE)
        .splice(1)
        .join(NEW_LINE)
  }

  this._parseMessage(data)
}

AMI.prototype._asteriskResponse = function(message) {
  this._requestWorker()

  if (this._config.debug) {
    this.emit('debug', message)
  }

  if (message.Response) {
    this._resolveAction(message)
  } else {
    let evt = message.Event
    delete message.Event
    this.emit(evt, message)
  }
}

AMI.prototype._resolveAction = function(msg) {
  let requestMap = this._requestMap[msg.ActionID]

  if (!requestMap)
    return

  let resolve = requestMap.resolve
    , reject = requestMap.reject

  delete this._requestMap[msg.ActionID]

  if (msg.Response == 'Error') {
    reject(new Error(msg.Message))
  } else {
    resolve(msg)
  }
}

util.inherits(AMI, EventEmitter)

module.exports = AMI
