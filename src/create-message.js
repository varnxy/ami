const C = require('./constants')

module.exports = function(obj) {
  let msg = []
  for (let k in obj) {
    msg.push([k, C.COLON_SEP, obj[k]].join(''))
  }

  msg.push(C.NEW_LINE)

  return msg.join(C.NEW_LINE)
}
