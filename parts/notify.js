const Telegraf = require('telegraf')
const TelegrafInlineMenu = require('telegraf-inline-menu')

const data = require('../lib/data')
const format = require('../lib/format.js')
const notifyRules = require('../lib/notify-rules')

const {DEFAULT_RULE, CHANGE_TYPES} = notifyRules

const bot = new Telegraf.Composer()

const menu = new TelegrafInlineMenu('Wähle die Sensoren aus, bei denen du erinnert werden willst. Wird es draußen wärmer als beim jeweiligen Sensor, bekommst du eine Benachrichtigung.')
menu.setCommand('notify')

const addMenu = menu.submenu('Regel hinzufügen…', 'add', new TelegrafInlineMenu('Spezifiziere die Regel…'))

function positionButtonText(position) {
  const exists = data.getPositions().indexOf(position) >= 0
  const prefix = '📡 '
  if (!position || !exists) {
    return prefix + 'Position'
  }

  return prefix + position
}

addMenu.submenu(ctx => positionButtonText((ctx.session.notify || {}).position), 'p', new TelegrafInlineMenu('Wähle das Gerät…'))
  .select('p', () => data.getPositions(), {
    columns: 1,
    setParentMenuAfter: true,
    isSetFunc: (ctx, key) => (ctx.session.notify || {}).position === key,
    setFunc: (ctx, key) => {
      ctx.session.notify = {
        ...DEFAULT_RULE,
        position: key
      }
    }
  })

function selectTypeButtonText(ctx) {
  const {type} = ctx.session.notify || {}
  const prefix = '🌡 '
  if (!type) {
    return prefix + 'Typ'
  }

  return prefix + (format.information[type] ? format.information[type].label : type)
}

function typeOptions(position) {
  const allTypes = data.getTypesOfPosition(position)
  const result = {}
  allTypes.forEach(type => {
    result[type] = format.information[type] ? format.information[type].label : type
  })
  return result
}

addMenu.submenu(selectTypeButtonText, 't', new TelegrafInlineMenu('Wähle den Typ…'), {
  hide: ctx => {
    const {position} = ctx.session.notify || {}
    return !position || data.getPositions().indexOf(position) < 0
  }
})
  .select('t', ctx => typeOptions(ctx.session.notify.position), {
    columns: 2,
    setParentMenuAfter: true,
    isSetFunc: (ctx, key) => (ctx.session.notify || {}).type === key,
    setFunc: (ctx, key) => {
      ctx.session.notify.type = key
      if (key === 'connected') {
        ctx.session.notify.change = ['unequal']
        ctx.session.notify.compare = 'value'
        ctx.session.notify.compareTo = 2
      }
    }
  })

addMenu.select('change', CHANGE_TYPES, {
  multiselect: true,
  hide: ctx => !(ctx.session.notify || {}).type,
  isSetFunc: (ctx, key) => ((ctx.session.notify || {}).change || []).indexOf(key) >= 0,
  setFunc: (ctx, key) => {
    if (!ctx.session.notify.change) {
      ctx.session.notify.change = []
    }

    if (ctx.session.notify.change.indexOf(key) >= 0) {
      ctx.session.notify.change = ctx.session.notify.change
        .filter(o => o !== key)
    } else {
      ctx.session.notify.change.push(key)
    }

    if (ctx.session.notify.change.length === 0) {
      if (key === 'unequal') {
        ctx.session.notify.change = ['rising', 'falling']
      } else {
        ctx.session.notify.change = ['unequal']
      }
    }
  }
})

addMenu.select('compare', {value: 'Wert', position: 'Position'}, {
  hide: ctx => !(ctx.session.notify || {}).type,
  isSetFunc: (ctx, key) => (ctx.session.notify || {}).compare === key,
  setFunc: (ctx, key) => {
    ctx.session.notify.compare = key
    delete ctx.session.notify.compareTo
  }
})

function possibleCompareToSensors(ctx) {
  const {position, type} = ctx.session.notify || {}
  return data.getPositions(o => Object.keys(o).indexOf(type) >= 0)
    .filter(o => o !== position)
}

addMenu.question(ctx => '🔢 ' + Number((ctx.session.notify || {}).compareTo), 'cv', {
  questionText: 'Mit welchem Wert soll verglichen werden?',
  hide: ctx => {
    const {type, compare} = ctx.session.notify || {}
    return !type || compare !== 'value'
  },
  setFunc: (ctx, answer) => {
    ctx.session.notify.compareTo = Number(answer)
  }
})

addMenu.submenu(ctx => positionButtonText((ctx.session.notify || {}).compareTo), 'cp', new TelegrafInlineMenu('Mit welchem Sensor willst du den Wert vergleichen?'), {
  hide: ctx => {
    const {type, compare} = ctx.session.notify || {}
    return !type || compare !== 'position'
  }
})
  .select('p', possibleCompareToSensors, {
    columns: 1,
    setParentMenuAfter: true,
    isSetFunc: (ctx, key) => (ctx.session.notify || {}).compareTo === key,
    setFunc: (ctx, key) => {
      ctx.session.notify.compareTo = key
    }
  })

const stableSecondsOptions = {
  0: 'instant',
  60: '1 min',
  300: '5 min'
}

addMenu.select('stableSeconds', stableSecondsOptions, {
  hide: ctx => !(ctx.session.notify || {}).type,
  isSetFunc: (ctx, key) => (ctx.session.notify || {}).stableSeconds === Number(key),
  setFunc: (ctx, key) => {
    ctx.session.notify.stableSeconds = Number(key)
  }
})

addMenu.button('Erstellen', 'addRule', {
  setParentMenuAfter: true,
  hide: ctx => {
    const {type, compare, compareTo} = ctx.session.notify || {}
    if (!type) {
      return true
    }

    if (compare === 'value') {
      const number = Number(compareTo)
      return !isFinite(number)
    }

    if (!compareTo) {
      return true
    }

    const exists = data.getPositions().indexOf(compareTo) >= 0
    return !exists
  },
  doFunc: ctx => {
    notifyRules.add({
      ...ctx.session.notify,
      chat: ctx.chat.id
    })
    delete ctx.session.notify
    return ctx.answerCbQuery('👍')
  }
})

bot.use(menu.init({
  actionCode: 'notify',
  backButtonText: '🔙 zurück…'
}))

module.exports = {
  bot
}
