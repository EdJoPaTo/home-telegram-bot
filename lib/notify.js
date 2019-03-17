const stringify = require('json-stable-stringify')
const debounce = require('debounce-promise')
const {Extra} = require('telegraf')

const data = require('./data')
const notifyRules = require('./notify-rules')
const {isRising, isFalling, isUnequal} = require('./notify-math')
const {typeValue} = require('./format')

const {CHANGE_TYPES} = notifyRules

let telegram

function init(tg) {
  telegram = tg
}

function getChangeCheckFunction(change) {
  if (change === 'rising') {
    return isRising
  }

  if (change === 'falling') {
    return isFalling
  }

  if (change === 'unequal') {
    return isUnequal
  }
}

function check(position, type, value) {
  const last = data.getLastValue(position, type)

  const rulesByPosition = notifyRules.getByPosition(position, type)
  for (const rule of rulesByPosition) {
    checkRulePosition(rule, value, last.value)
  }

  const rulesByCompareTo = notifyRules.getByCompareTo(position, type)
  for (const rule of rulesByCompareTo) {
    checkRuleCompareTo(rule, value, last.value)
  }
}

function checkRulePosition(rule, currentValue, lastValue) {
  const compareTo = rule.compare === 'value' ?
    rule.compareTo :
    (data.getLastValue(rule.compareTo, rule.type) || {}).value

  for (const change of rule.change) {
    const checkFunction = getChangeCheckFunction(change)
    const isLast = checkFunction(lastValue, compareTo)
    const isNow = checkFunction(currentValue, compareTo)
    if (isLast !== isNow) {
      initiateNotification(rule, change, currentValue, compareTo)
    }
  }
}

function checkRuleCompareTo(rule, currentValue, lastValue) {
  const positionLastValue = (data.getLastValue(rule.position, rule.type) || {}).value

  for (const change of rule.change) {
    const checkFunction = getChangeCheckFunction(change)
    const isLast = checkFunction(positionLastValue, lastValue)
    const isNow = checkFunction(positionLastValue, currentValue)
    if (isLast !== isNow) {
      initiateNotification(rule, change, positionLastValue, currentValue)
    }
  }
}

const debouncers = {}
async function initiateNotification(rule, change, currentValue, compareTo) {
  const values = {
    currentValue,
    compareTo
  }
  const identifier = stringify(rule) + change
  if (!debouncers[identifier]) {
    debouncers[identifier] = debounce(
      async argsArr => {
        await initiateNotificationDebounced(rule, change, argsArr)

        // Fix required. See https://github.com/bjoerge/debounce-promise/pull/19
        return argsArr.map(() => null)
      },
      rule.stableSeconds * 1000,
      {accumulate: true}
    )
  }

  return debouncers[identifier](values)
}

async function initiateNotificationDebounced(rule, change, argsArr) {
  // The argsArr contains arrays or arguments per call.
  // As only one argument is used (values) this array of arrays is annoying so simplify it with .flat().
  const values = argsArr.flat()
  const first = values[0]
  const last = values.slice(-1)[0]
  const {currentValue, compareTo} = last

  const checkFunction = getChangeCheckFunction(change)
  const isFirst = checkFunction(first.currentValue, first.compareTo)
  const isNow = checkFunction(currentValue, compareTo)
  if (!isFirst || !isNow) {
    // Reason isNow: if its currently not the case, why send notify
    // Reason isFirst: if it did not start with a change its only a bump (below and up again)
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
