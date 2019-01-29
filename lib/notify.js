const stringify = require('json-stable-stringify')
const debounce = require('debounce-promise')
const {Extra} = require('telegraf')

const data = require('./data')
const notifyRules = require('./notify-rules')
const {isRising, isFalling, equalityChanged} = require('./notify-math')
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

  if (rule.change.indexOf('unequal') >= 0 && equalityChanged(lastValue, currentValue, compareTo)) {
    initiateNotification(rule, 'unequal', currentValue, compareTo)
  }
}

const debouncers = {}
async function initiateNotification(rule, change, currentValue, compareTo) {
  const reason = {
    change,
    currentValue,
    compareTo
  }
  const identifier = stringify(rule)
  if (!debouncers[identifier]) {
    debouncers[identifier] = debounce(
      (...args) => initiateNotificationDebouncedFixed(rule, ...args),
      rule.stableSeconds * 1000,
      {accumulate: true}
    )
  }

  return debouncers[identifier](reason)
}

async function initiateNotificationDebouncedFixed(rule, argsArr) {
  await initiateNotificationDebounced(rule, argsArr)

  // Fix required. See https://github.com/bjoerge/debounce-promise/pull/19
  return argsArr.map(() => null)
}

async function initiateNotificationDebounced(rule, argsArr) {
  // The argsArr contains arrays or arguments.
  // As only one argument is rules (reason) this array of arrays is anoying so simplify it with flat
  // It contains an array of arguments. As there is only one argument per call, flatten simplifies the own logic
  const reasons = argsArr.flat()

  const first = reasons[0]
  const last = reasons.slice(-1)[0]
  const {change, currentValue, compareTo} = last

  if (first.change !== last.change) {
    // Example of events that are wrong here
    // rising -> falling: still below compareTo value
    // Example of correct events
    // rising -> falling -> rising: last change was rising and the stableSeconds are over as the debounce fired -> notify
    return
  }

  if (rule.change.indexOf(change) < 0) {
    // Not subscribed to this kind of change
    return
  }

  if (change === 'unequal' && currentValue === compareTo) {
    // Value was unequal but is now equal again
    return
  }

  let text = ''

  if (rule.compare === 'position') {
    text += rule.compareTo
    text += ' '
    text += CHANGE_TYPES[change]
    text += ' '
  }

  text += `*${rule.position}*`
  text += '\n'
  text += typeValue(rule.type, compareTo)
  text += ' '
  text += CHANGE_TYPES[change]
  text += ' '
  text += typeValue(rule.type, currentValue)

  await telegram.sendMessage(rule.chat, text, Extra.markdown())
}

module.exports = {
  init,
  check
}
