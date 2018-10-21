const fs = require('fs')

const debounce = require('debounce-promise')
const Telegraf = require('telegraf')

const lastData = require('../lib/last-data.js')
const format = require('../lib/format.js')

const {Extra, Markup} = Telegraf

const MILLISECONDS_NEEDED_CONSTANT_FOR_CHANGE = 1000 * 60 * 3 // 3 Minutes constantly on right temp in order to notify
const TEMP_SENSOR_OUTDOOR = process.env.npm_package_config_temp_sensor_outdoor

let chats = {}
try {
  chats = JSON.parse(fs.readFileSync('chats.json', 'utf8'))
} catch (error) {}
let hotLocationsDontOpen = []
const changeInitiated = {}

const bot = new Telegraf.Composer()

function getIndoorPositions() {
  return lastData.getPositions().filter(o => o !== TEMP_SENSOR_OUTDOOR)
}

function getAllIdsWithAnyNotification() {
  const notifyPositions = Object.keys(chats)
  const merged = [].concat(...notifyPositions.map(pos => chats[pos]))
  const distinct = [...new Set(merged)]

  return distinct
}

bot.command('notify', ctx => {
  return ctx.reply('Wähle die Sensoren aus, bei denen du erinnert werden willst. Wird es draußen wärmer als beim jeweiligen Sensor, bekommst du eine Benachrichtigung.', Extra.markup(createNotifyKeyboard(ctx)))
})

function createNotifyKeyboard(ctx) {
  const chatID = ctx.chat.id
  const positions = getIndoorPositions()
  return Markup.inlineKeyboard(positions.map(position => {
    const hasPositionEnabled = chats[position] && chats[position].indexOf(chatID) >= 0
    return [
      Markup.callbackButton(
        `${format.enabledEmoji(hasPositionEnabled)} ${position}`,
        `notify:${position}`
      )
    ]
  }))
}

bot.action(/notify:(.+)/, ctx => {
  const {id} = ctx.chat
  const position = ctx.match[1]
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
  return ctx.editMessageReplyMarkup(createNotifyKeyboard(ctx))
})

const notifyConnectedPositionFunc = {}
function notifyConnectedWhenNeeded(telegram, position, ...args) {
  if (!notifyConnectedPositionFunc[position]) {
    notifyConnectedPositionFunc[position] = debounce(
      (...args) => notifyConnectedWhenNeededDebounced(telegram, position, ...args),
      1000 * 30 // Wait 30 Seconds before possible notification
    )
  }

  return notifyConnectedPositionFunc[position](...args)
}

function notifyConnectedWhenNeededDebounced(telegram, position, val) {
  const connected = Number(val.value)
  if (connected === 2) {
    // Everything is ok, sensor is connected
    return
  }

  let idsToNotify = []
  if (position === TEMP_SENSOR_OUTDOOR) {
    idsToNotify = getAllIdsWithAnyNotification()
  } else {
    idsToNotify = chats[position] || []
  }

  const textPrefix = `${format.connectionStatusParts[connected].emoji} *${position}*: `
  let text = ''
  const textSuffix = '\n\nBenutze /checksensors beim Beheben des Problems um sofort zu sehen, ob du erfolgreich warst.'

  if (connected === 1) {
    text = 'Der Sensor kann nicht mehr gelesen werden.'
  } else if (connected === 0) {
    text = 'Das Board ist offline. Tipp: Benutze den Reset Button.'
  } else {
    text = `#∞!@∆Ω† ${connected}`
  }

  return broadcastToIds(telegram, idsToNotify, textPrefix + text + textSuffix)
}

function notifyTempWhenNeeded(telegram) {
  const outdoor = lastData.getSensorValue(TEMP_SENSOR_OUTDOOR, 'temp')

  if (!outdoor) {
    console.log('notifyTempWhenNeeded is still waiting for init')
    return
  }

  const notifyPositions = Object.keys(chats)
  const positions = getIndoorPositions()
    .filter(p => notifyPositions.indexOf(p) >= 0)
    .filter(p => chats[p].length > 0)

  return Promise.all(positions.map(position => notifyTempPositionWhenNeeded(telegram, position, outdoor)))
}

function notifyTempPositionWhenNeeded(telegram, position, outdoor) {
  const indoor = lastData.getSensorValue(position, 'temp')
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
