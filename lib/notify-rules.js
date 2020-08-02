const fs = require('fs')

const stringify = require('json-stable-stringify')

const {typeValue} = require('./format')

const RULE_FILE = 'persistent/rules.json'
const rules = loadRules()

const DEFAULT_RULE = {
  compare: 'value',
  stableSeconds: 60,
  change: ['rising', 'falling'],
  compareTo: 42
}

const CHANGE_TYPES = {
  unequal: '≠',
  rising: '📈',
  falling: '📉'
}

function loadRules() {
  try {
    const json = JSON.parse(fs.readFileSync(RULE_FILE, 'utf8'))
    return json
  } catch {
    return {}
  }
}

function saveRules() {
  const content = stringify(rules, {space: 2})
  fs.writeFileSync(RULE_FILE, content, 'utf8')
}

function getByPosition(position, type) {
  return rules[position + '/' + type] || []
}

function getByCompareTo(position, type) {
  return Object.values(rules)
    .flat()
    .filter(o => o.compare === 'position')
    .filter(o => o.type === type)
    .filter(o => o.compareTo === position)
}

function getByChat(chat) {
  return Object.values(rules)
    .flat()
    .filter(o => o.chat === chat)
}

function add(rule) {
  const {position, type} = rule
  const key = position + '/' + type
  if (!rules[key]) {
    rules[key] = []
  }

  rules[key].push(rule)
  saveRules()
}

function remove(rule) {
  const {position, type} = rule
  const key = position + '/' + type
  if (!rules[key]) {
    return
  }

  const stringifiedRule = stringify(rule)
  rules[key] = rules[key]
    .filter(o => stringify(o) !== stringifiedRule)

  if (rules[key].length === 0) {
    delete rules[key]
  }

  saveRules()
}

function asString(rule, markdown = false) {
  const {position, type, change, compare, compareTo, stableSeconds} = rule

  let text = type + ' '
  if (markdown) {
    text += `*${position}*`
  } else {
    text += position
  }

  text += ' '

  const changeSymbols = change
    .sort()
    .map(o => CHANGE_TYPES[o])
  text += changeSymbols.join('') + ' '

  if (compare === 'value') {
    text += typeValue(rule.type, compareTo)
  } else {
    text += compareTo
  }

  text += ' '
  const stableMinutes = Math.round(stableSeconds / 6) / 10
  text += `>${stableMinutes} min`

  return text
}

module.exports = {
  DEFAULT_RULE,
  CHANGE_TYPES,
  add,
  remove,
  getByChat,
  getByCompareTo,
  getByPosition,
  asString
}
