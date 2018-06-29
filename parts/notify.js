const fs = require('fs')
const Telegraf = require('telegraf')

const lastData = require('../lib/lastData.js')

const { Extra, Markup } = Telegraf

const MILLISECONDS_NEEDED_CONSTANT_FOR_CHANGE = 1000 * 60 // one Minute constantly on right temp in order to notify
const TEMP_SENSOR_OUTDOOR = process.env.npm_package_config_temp_sensor_outdoor

let chats = {}
try {
  chats = JSON.parse(fs.readFileSync('chats.json', 'utf8'))
} catch (err) {}
let hotLocationsDontOpen = []
const changeInitiated = {}

function enabledEmoji(truthy) {
  return truthy ? '✅' : '❎'
}

const bot = new Telegraf.Composer()

function getIndoorPositions() {
  return lastData.getPositions().filter(o => o !== TEMP_SENSOR_OUTDOOR)
}

bot.command('notify', ctx => {
  return ctx.reply(`Wähle die Sensoren aus, bei denen du erinnert werden willst. Wird es draußen wärmer als beim jeweiligen Sensor, bekommst du eine Benachrichtigung.`, Extra.markup(createNotifyKeyboard(ctx)))
})

function createNotifyKeyboard(ctx) {
  const chatID = ctx.chat.id
  const positions = getIndoorPositions()
  return Markup.inlineKeyboard(positions.map(position => {
    const hasPositionEnabled = chats[position] && chats[position].indexOf(chatID) >= 0
    return [ Markup.callbackButton(`${enabledEmoji(hasPositionEnabled)} ${position}`, `notify:${position}`) ]
  }))
}

bot.action(/notify:(.+)/, ctx => {
  const id = ctx.chat.id
  const position = ctx.match[1]
  try {
    chats = JSON.parse(fs.readFileSync('chats.json', 'utf8'))
  } catch (err) {
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

async function notifyWhenNeeded(telegram) {
  const outdoor = lastData.getSensorValue(TEMP_SENSOR_OUTDOOR, 'temp')

  if (!outdoor) {
    console.log('notifyWhenNeeded is still waiting for init')
    return
  }

  const notifyPositions = Object.keys(chats)
  const positions = getIndoorPositions()
    .filter(p => notifyPositions.indexOf(p) >= 0)
    .filter(p => chats[p].length > 0)

  for (const position of positions) {
    const indoor = lastData.getSensorValue(position, 'temp')
    const isClosed = hotLocationsDontOpen.indexOf(position) >= 0
    const changeInitiatedTime = changeInitiated[position]
    const idsToNotify = chats[position]

    const diff = outdoor.value - indoor.value

    // console.log('notifyWhenNeeded diff', outdoor.value, indoor.value, Math.round(diff * 10) / 10, position, isClosed ? 'next open' : 'next close', changeInitiatedTime ? `${Date.now() - changeInitiatedTime} > ${MILLISECONDS_NEEDED_CONSTANT_FOR_CHANGE}` : 'unplanned')

    const textSuffix = `\n\nBenutze /status oder /graph für umfassende Infos.`

    if (isClosed) {
      // next open
      if (diff < 0) {
        if (changeInitiatedTime + MILLISECONDS_NEEDED_CONSTANT_FOR_CHANGE <= Date.now()) {
          hotLocationsDontOpen = hotLocationsDontOpen.filter(o => o !== position)
          delete changeInitiated[position]
          const text = `*${position}*: Es ist draußen *kälter* als drinnen. Man könnte die Fenster aufmachen.\n${outdoor.value}°C < ${indoor.value}°C`
          await broadcastToIds(telegram, idsToNotify, text + textSuffix)
        } else if (!changeInitiatedTime) {
          changeInitiated[position] = Date.now()
        }
      } else {
        delete changeInitiated[position]
      }
    } else {
      // next close
      if (diff > 0) {
        if (changeInitiatedTime + MILLISECONDS_NEEDED_CONSTANT_FOR_CHANGE <= Date.now()) {
          hotLocationsDontOpen.push(position)
          delete changeInitiated[position]
          const text = `*${position}*: Es ist draußen *wärmer* als drinnen. Sind alle Fenster zu?\n${outdoor.value}°C > ${indoor.value}°C`
          await broadcastToIds(telegram, idsToNotify, text + textSuffix)
        } else if (!changeInitiatedTime) {
          changeInitiated[position] = Date.now()
        }
      } else {
        delete changeInitiated[position]
      }
    }
  }
}

function broadcastToIds(telegram, ids, text) {
  return Promise.all(ids.map(chat =>
    telegram.sendMessage(chat, text, Extra.markdown())
  ))
}

module.exports = {
  bot: bot,
  notifyWhenNeeded: notifyWhenNeeded
}
