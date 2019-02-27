const Socket = require('net').Socket
    , EventEmitter = require('events').EventEmitter
    , util = require('util')
    , defaults = require('./default')
    , isEmptyObj = require('./is-empty-object')

function AMI(opt) {
  opt = opt || {}

  this._config = Object.assign(defaults, opt)

  this._connection = null
  this._requestMap = {}
  this._connected = false
  this._loggedIn = false
  this._msgBuffer = ''
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

  for (let evt in eventMap) {
    this._connection.addListener(evt, eventMap[evt])
  }
}

AMI.prototype.action = function(name, params) {
  let message = ''

  params = params || {}
  params.Action = name
  params.ActionID = params.ActionID || +new Date()

  message = this._createMessage(params)

  let promise = new Promise((resolve, reject) => {
    this._requestMap[params.ActionID] = {
      resolve: resolve,
      reject: reject,
      eventList: false
    }
  })

  this._connection.write(message)

  return promise
}

AMI.prototype._createMessage = function(obj) {
  let msg = []
  for (let k in obj) {
    msg.push([k, ': ', obj[k]].join(''))
  }

  msg.push('\r\n')

  return msg.join('\r\n')
}

AMI.prototype._parseMessage = function(message) {
  let result = {}
    , endLineIndex, msgLines, msgLine, msgLineSplit

  this._msgBuffer += message

  while ((endLineIndex = this._msgBuffer.indexOf('\r\n\r\n')) != -1) {
    msgLines = this._msgBuffer.substr(0, endLineIndex+2).split('\r\n')
    this._msgBuffer = this._msgBuffer.substr(endLineIndex+4)

    for (let i=0;i<msgLines.length;i++) {
      msgLine = msgLines[i]
      if (msgLine.indexOf(': ') != -1) {
        msgLineSplit = msgLine.split(': ')
        result[msgLineSplit[0]] = msgLineSplit[1]
      }
    }
  }

  return isEmptyObj(result) ? null : result
}

AMI.prototype._onConnect = function() {
  this.emit('connected')
}

AMI.prototype._onClose = function() {
  console.log('Closed')
}

AMI.prototype._onEnd = function() {
  console.log('Ended')
}

AMI.prototype._onError = function(err) {
  this.emit('error', err)
}

AMI.prototype._onData = function(buffer) {
  let data = buffer.toString()

  if (data.match(/^Asterisk Call Manager/) && !this._loggedIn) {
    this._connected = true
    this.action('Login', {
      Username: this._config.username,
      Secret: this._config.password,
      Events: this._config.events ? 'on' : 'off'
    }).then(msg => {
      this.emit('authenticated')
    }).catch((err) => {
      this.emit('error', new Error(err.toString()))
    })
  } else if (data && this._connected) {
    let message = this._parseMessage(data)

    if (!message)
      return

    if (message.Response && this._requestMap[message.ActionID]) {

      if (this._config.wrapEventList && message.EventList
          && !this._requestMap[message.ActionID].eventList) {
        this._requestMap[message.ActionID].eventList = true
        this._requestMap[message.ActionID].message = message
        this._requestMap[message.ActionID].events = []
      } else {
        this._resolveAction(message)
      }

    } else if (message.Event) {
      if (this._config.debug) {
        this.emit('debug', message)
      }

      if (this._requestMap[message.ActionID]) {
        this._requestMap[message.ActionID].events.push(message)

        if (message.EventList && (message.EventList == 'Complete' || message.EventList == 'Cancelled')) {
          let responseMsg = this._requestMap[message.ActionID].message
          responseMsg.Events = this._requestMap[message.ActionID].events

          this._resolveAction(responseMsg)
        }
      } else {
        this.emit(message.Event, message)
      }
    }

  } else {
    ami.emit('error', new Error('Unknown AMI data'))
  }
}

AMI.prototype._resolveAction = function(msg) {
  let resolve = this._requestMap[msg.ActionID].resolve
    , reject = this._requestMap[msg.ActionID].reject

  delete this._requestMap[msg.ActionID]

  if (msg.Response == 'Error') {
    reject(new Error(msg.Message))
  } else {
    resolve(msg)
  }
}

util.inherits(AMI, EventEmitter)

module.exports = AMI
