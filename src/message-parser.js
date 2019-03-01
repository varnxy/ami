const C = require('./constants')

function MessageParser(consumer) {
  this._consumer = consumer
  this._message = ''
}

MessageParser.prototype.addMessage = function(message) {
  let result, endLineIndex, msgLines
    , msgLine, msgLineSplit

  this._message += message

  while ((endLineIndex = this._message.indexOf(C.END_LINE)) != -1) {
    msgLines = this._message.substr(0, endLineIndex+2).split(C.NEW_LINE)
    this._message = this._message.substr(endLineIndex+4)
    result = {}

    for (let i=0;i<msgLines.length;i++) {
      msgLine = msgLines[i]

      if (msgLine.indexOf(C.COLON_SEP) != -1) {
        msgLineSplit = msgLine.split(C.COLON_SEP)
        result[msgLineSplit[0]] = msgLineSplit[1]
      }
    }

    if (result.Event || result.Response) {
      this._consumer(result)
    }
  }
}

module.exports = MessageParser
