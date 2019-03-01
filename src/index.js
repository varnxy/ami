const Socket = require('net').Socket
    , EventEmitter = require('events').EventEmitter
    , util = require('util')
    , C = require('./constants')
    , createMessage = require('./create-message')
    , MessageParser = require('./message-parser')

function AMI(opt) {
  opt = opt || {}

  this._config = Object.assign(C.DEFAULT, opt)

  this._connection = null
  this._requestMap = {}
  this._connected = false
  this._requestQueues = []
  this._requestOnWork = false
  this._reconnectInterval = null
  this._reconnectTime = 0
  this._messageParser = new MessageParser(this._asteriskResponse.bind(this))
  // This just for unique ActionID
  this._requestId = +new Date()
}

AMI.prototype.start = function() {
  this._connection = new Socket()
  this._connection.connect(this._config.port, this._config.host)
  this._connection.once('connect', this._authenticate.bind(this))
  this._initialSocket()
}

AMI.prototype._initialSocket = function() {
  let eventMap = {
    'connect': this._onConnect.bind(this),
    'close': this._onClose.bind(this),
    'data': this._onData.bind(this),
    'end': this._onEnd.bind(this),
    'error': this._onError.bind(this)
  }

  this._connection.setKeepAlive(true)
  this._connection.setNoDelay(true)
  this._connection.setEncoding(C.ENCODING)

  for (let evt in eventMap) {
    this._connection.on(evt, eventMap[evt])
  }
}

AMI.prototype.action = function(name, params) {
  params = params || {}
  params.Action = name
  params.ActionID = params.ActionID || this._requestId++

  let message = createMessage(params)
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

AMI.prototype._authenticate = function() {
  this.action(C.ACTION_LOGIN, {
    Username: this._config.username,
    Secret: this._config.secret,
    Events: this._config.events ? C.RESPONSE_EVENT_ON : C.RESPONSE_EVENT_OFF
  }).then(() => {
    this.emit(!this._connected ? C.SIGNAL.AUTHENTICATED : C.SIGNAL.RECONNECTED)
    this._connected = true
  }).catch((err) => {
    this.emit(C.SIGNAL.ERROR, new Error(err.toString()))
  })
}

AMI.prototype._onConnect = function() {
  this.emit(C.SIGNAL.CONNECTED)
}

AMI.prototype._onClose = function(err) {
  this._connection.removeAllListeners()

  this.emit(C.SIGNAL.DISCONNECTED, err)
  this._connection.destroy()

  if (this._config.keepConnected) {
    this._reconnectTime = Math.min(this._reconnectTime+1, C.MAX_RECONNECT_TIME)
    setTimeout(() => {
      this._tryReconnect()
    }, C.RECONNECT_BACKOFF * (++this._reconnectTime))
  }
}

AMI.prototype._tryReconnect = function() {
  this._connection.connect(this._config.port, this._config.host)
  this._initialSocket()

  this._connection.once('connect', () => {
    this._reconnectTime = 0
    this._authenticate()
  })
}

AMI.prototype._onEnd = function() {
  this._connection.end()
  this._onClose()
}

AMI.prototype._onError = function(err) {
  this._connection.end()
  this.emit(C.SIGNAL.ERROR, err)
}

AMI.prototype._onData = function(buffer) {
  let data = buffer.toString()

  if (data.startsWith(C.AMI_PROTO_HEADER)) {
    data.split(C.NEW_LINE)
        .splice(1)
        .join(C.NEW_LINE)
  }

  this._messageParser.addMessage(data)
}

AMI.prototype._asteriskResponse = function(message) {
  this._requestWorker()

  if (this._config.debug) {
    this.emit(C.SIGNAL.DEBUG, message)
  }

  if (message.Response) {
    this._resolveAction(message)
  } else {
    let evt = message.Event

    delete message.Event
    this.emit(evt, message)
  }
}

AMI.prototype._resolveAction = function(message) {
  let requestMap = this._requestMap[message.ActionID]

  if (!requestMap)
    return

  let resolve = requestMap.resolve
    , reject = requestMap.reject
    , response = message.Response

  delete this._requestMap[message.ActionID]
  delete message.Response

  if (response == C.ACTION_RESPONSE_ERROR) {
    reject(new Error(message.Message))
  } else {
    resolve(message)
  }
}

util.inherits(AMI, EventEmitter)

module.exports = AMI
