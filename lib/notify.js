const {Extra} = require('telegraf')

const data = require('./data')
const notifyRules = require('./notify-rules')
const {isRising, isFalling} = require('./notify-math')
const {typeValue} = require('./format')

const {CHANGE_TYPES} = notifyRules

let telegram

function init(tg) {
  telegram = tg
}

function check(position, type, value) {
  const possibleRules = notifyRules.getByPosition(position, type)
  const last = data.getLastValue(position, type)

  for (const rule of possibleRules) {
    checkRule(rule, value, last.value)
  }
}

function checkRule(rule, currentValue, lastValue) {
  const compareTo = rule.compare === 'value' ?
    rule.compareTo :
    (data.getLastValue(rule.compareTo, rule.type) || {}).value

  if (rule.change.indexOf('rising') >= 0 || rule.change.indexOf('falling') >= 0) {
    if (isRising(lastValue, currentValue, compareTo)) {
      initiateNotification(rule, 'rising', currentValue, compareTo)
    } else if (isFalling(lastValue, currentValue, compareTo)) {
      initiateNotification(rule, 'falling', currentValue, compareTo)
    }
  }

  if (rule.change.indexOf('unequal') >= 0) {
    initiateNotification(rule, 'unequal', currentValue, compareTo)
  }
}

function initiateNotification(rule, reason, currentValue, compareTo) {
  let text = ''

  text += `*${rule.type}* `
  if (rule.compare === 'position') {
    text += rule.compareTo
    text += ' '
    text += CHANGE_TYPES[reason]
    text += ' '
  }

  text += rule.position
  text += '\n'
  text += typeValue(rule.type, compareTo)
  text += ' '
  text += CHANGE_TYPES[reason]
  text += ' '
  text += typeValue(rule.type, currentValue)

  telegram.sendMessage(rule.chat, text, Extra.markdown())
}

module.exports = {
  init,
  check
}
