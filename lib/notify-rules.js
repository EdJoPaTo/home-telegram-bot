const fs = require('fs')

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
  } catch (error) {
    return {}
  }
}

function saveRules() {
  const content = JSON.stringify(rules, null, '  ')
  fs.writeFileSync(RULE_FILE, content, 'utf8')
}

function get(position, type) {
  return rules[position + '/' + type] || []
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

function asString(rule) {
  const {position, type, change, compareTo} = rule

  let text = position + ' '
  text += type + ' '

  const changeSymbols = change
    .sort()
    .map(o => CHANGE_TYPES[o])
  text += changeSymbols.join('') + ' '

  text += compareTo

  return text
}

module.exports = {
  DEFAULT_RULE,
  CHANGE_TYPES,
  add,
  get,
  asString
}
