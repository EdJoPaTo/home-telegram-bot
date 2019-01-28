const fs = require('fs')

const debounce = require('debounce-promise')
const Telegraf = require('telegraf')
const TelegrafInlineMenu = require('telegraf-inline-menu')

const data = require('../lib/data')
const format = require('../lib/format.js')
const notifyRules = require('../lib/notify-rules')

const {DEFAULT_RULE, CHANGE_TYPES} = notifyRules
const {Extra} = Telegraf

const MILLISECONDS_NEEDED_CONSTANT_FOR_CHANGE = 1000 * 60 * 3 // Time needed to be constantly on right temp in order to notify
const MILLISECONDS_NEEDED_ON_ERROR_FOR_NOTIFY = 1000 * 60 * 5 // Time needed before the bot notifies about the sensor error
const TEMP_SENSOR_OUTDOOR = process.env.npm_package_config_temp_sensor_outdoor

let chats = {}
try {
  chats = JSON.parse(fs.readFileSync('chats.json', 'utf8'))
} catch (error) {}

let hotLocationsDontOpen = []
const changeInitiated = {}

const bot = new Telegraf.Composer()

function getIndoorPositions() {
  return data.getPositions().filter(o => o !== TEMP_SENSOR_OUTDOOR)
}

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

menu.select('position', () => data.getPositions(), {
  columns: 1,
  multiselect: true,
  isSetFunc: (ctx, key) => {
    if (!chats[key]) {
      return false
    }

    return chats[key].indexOf(ctx.chat.id) >= 0
  },
  setFunc: (ctx, key) => togglePositionNotify(ctx, key)
})

bot.use(menu.init({
  actionCode: 'notify',
  backButtonText: '🔙 zurück…'
}))

function togglePositionNotify(ctx, position) {
  const {id} = ctx.chat
  try {
    chats = JSON.parse(fs.readFileSync('chats.json', 'utf8'))
  } catch (error) {
    chats = {}
  }

  if (!chats[position]) {
    chats[position] = [id]
  } else if (chats[position].indexOf(id) < 0) {
    chats[position].push(id)
  } else {
    chats[position] = chats[position].filter(i => i !== id)
  }

  console.log('chats to notify was changed', chats)
  fs.writeFileSync('chats.json', JSON.stringify(chats, null, 2), 'utf8')
}

const notifyConnectedPositionFunc = {}
function notifyConnectedWhenNeeded(telegram, position, ...args) {
  if (!notifyConnectedPositionFunc[position]) {
    notifyConnectedPositionFunc[position] = debounce(
      (...args) => notifyConnectedWhenNeededDebounced(telegram, position, ...args),
      MILLISECONDS_NEEDED_ON_ERROR_FOR_NOTIFY
    )
  }

  return notifyConnectedPositionFunc[position](...args)
}

function notifyConnectedWhenNeededDebounced(telegram, position, val) {
  const connected = Number(val)
  if (connected === 2) {
    // Everything is ok, sensor is connected
    return
  }

  const idsToNotify = chats[position] || []

  const textPrefix = `${format.connectionStatusParts[connected].emoji} *${position}*: `
  let text = ''
  const textSuffix = '\n\nBenutze /checksensors beim Beheben des Problems um sofort zu sehen, ob du erfolgreich warst.'

  if (connected === 1) {
    text = 'Der Sensor kann nicht mehr gelesen werden.'
  } else if (connected === 0) {
    text = 'Das Board ist offline. Tipp: Benutze den Reset Button.'
  } else {
    text = `connection status ${connected}. This is not expected.`
  }

  return broadcastToIds(telegram, idsToNotify, textPrefix + text + textSuffix)
}

function notifyTempWhenNeeded(telegram) {
  const outdoor = data.getLastValue(TEMP_SENSOR_OUTDOOR, 'temp')

  if (!outdoor) {
    console.log('notifyTempWhenNeeded is still waiting for init')
    return
  }

  const positions = getIndoorPositions()
    // Get positions that have subscribers
    .filter(p => (chats[p] || []).length > 0)

  return Promise.all(positions.map(position => notifyTempPositionWhenNeeded(telegram, position, outdoor)))
}

function notifyTempPositionWhenNeeded(telegram, position, outdoor) {
  const indoor = data.getLastValue(position, 'temp')
  if (!indoor) {
    // Sensor not yet initialized. Should only happen with retained false sensors
    return
  }

  const isClosed = hotLocationsDontOpen.indexOf(position) >= 0
  const idsToNotify = chats[position]

  const diff = outdoor.value - indoor.value
  const changeNeeded = isWindowStateChangeNeeded(position, isClosed, diff)

  // Debug
  // console.log('notifyTempPositionWhenNeeded', outdoor.value, indoor.value, diff.toFixed(2), position, isClosed ? 'next open' : 'next close', changeNeeded)

  if (!changeNeeded) {
    return
  }

  const textPrefix = `*${position}*: `
  let text = ''
  const textSuffix = `\n${outdoor.value}°C < ${indoor.value}°C\n\nBenutze /status oder /graph für umfassende Infos.`

  if (isClosed) {
    hotLocationsDontOpen = hotLocationsDontOpen.filter(o => o !== position)
    text += 'Es ist draußen *kälter* als drinnen. Man könnte die Fenster aufmachen.'
  } else {
    hotLocationsDontOpen.push(position)
    text += 'Es ist draußen *wärmer* als drinnen. Sind alle Fenster zu?'
  }

  return broadcastToIds(telegram, idsToNotify, textPrefix + text + textSuffix)
}

function isWindowStateChangeNeeded(position, isClosed, diff) {
  const changeInitiatedTime = changeInitiated[position]

  // Debug
  // console.log('isWindowStateChangeNeeded', position, isClosed ? 'next open' : 'next close', diff.toFixed(2), changeInitiatedTime ? Date.now() - changeInitiatedTime : 0, '>', MILLISECONDS_NEEDED_CONSTANT_FOR_CHANGE)

  if ((isClosed && diff < 0) || (!isClosed && diff > 0)) {
    if (!changeInitiatedTime) {
      // First time change is wished
      changeInitiated[position] = Date.now()
    } else if (changeInitiatedTime + MILLISECONDS_NEEDED_CONSTANT_FOR_CHANGE <= Date.now()) {
      // Constantly high enough, do something
      delete changeInitiated[position]
      return true
    }
  } else {
    delete changeInitiated[position]
    return false
  }
}

function broadcastToIds(telegram, ids, text) {
  return Promise.all(ids.map(chat =>
    telegram.sendMessage(chat, text, Extra.markdown())
  ))
}

module.exports = {
  bot,
  notifyConnectedWhenNeeded,
  notifyTempWhenNeeded
}
