const {Extra} = require('telegraf')

const data = require('./data')
const notifyRules = require('./notify-rules')

let telegram

function init(tg) {
  telegram = tg
}

function check(position, type, value) {
  const possibleRules = notifyRules.get(position, type)
  const last = data.getLastValue(position, type)

  for (const rule of possibleRules) {
    checkRule(rule, value, last)
  }
}

function checkRule(rule, currentValue, lastValue) {
  // TODO: implement
  console.log('notify.checkRule', currentValue, lastValue, rule)
}

function broadcastToIds(ids, text) {
  return Promise.all(ids.map(chat =>
    telegram.sendMessage(chat, text, Extra.markdown())
  ))
}

module.exports = {
  init,
  check
}
