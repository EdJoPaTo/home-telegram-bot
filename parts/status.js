const Telegraf = require('telegraf')

const lastData = require('../lib/lastData.js')

const { Extra } = Telegraf

const DATA_AGE_HINT = 10 * 1000 // 10 s
const DATA_AGE_WARNING = 2 * 60 * 1000 // 2 min
const DATA_AGE_HIDE = 3 * 60 * 60 * 1000 // 3h

const bot = new Telegraf.Composer()
module.exports = bot

bot.command('status', async ctx => {
  const msgSend = await ctx.reply(generateStatusText(), Extra.markdown())

  setInterval(doStatusUpdates, 5000, ctx.telegram, msgSend.chat.id, msgSend.message_id, msgSend.date * 1000)
})

function doStatusUpdates(telegram, chatID, messageID, initialMessageDate) {
  const secondsSinceInitialMessage = Math.round((Date.now() - initialMessageDate) / 1000)
  if (secondsSinceInitialMessage > 30) { // stop updating after 30 seconds
    clearInterval(this)
    return
  }

  const newStatus = generateStatusText()
  telegram.editMessageText(chatID, messageID, undefined, newStatus, Extra.markdown())
}

function generateStatusText() {
  const positions = lastData.getPositions()
  const lines = positions.map(position => {
    const sensorData = lastData.getAllSensorValues(position)
    const types = Object.keys(sensorData)

    const timestamps = types.map(type => sensorData[type].time)
    const minTimestamp = Date.now() - Math.min(...timestamps)
    const maxTimestamp = Date.now() - Math.max(...timestamps)

    if (minTimestamp > DATA_AGE_HIDE) {
      return '' // will be filtered out
    }

    let parts = ''

    if (maxTimestamp < DATA_AGE_HINT) {
      parts += `*${position}*`
    } else {
      parts += `${position}`
    }
    parts += ' '
    parts += types.map(type =>
      formatBasedOnAge(sensorData[type].time, Date.now(),
        formatTypeValue(type, sensorData[type].value)
      )
    ).join(', ')

    return parts
  })
    .filter(o => o !== '')

  return lines.join('\n')
}

function formatBasedOnAge(oldDate, currentDate, value) {
  const msAgo = currentDate - oldDate

  if (msAgo > DATA_AGE_WARNING) {
    return '⚠️ _' + value + '_'
  } else if (msAgo > DATA_AGE_HINT) {
    return '_' + value + '_'
  } else {
    return value
  }
}

function formatTypeValue(type, value) {
  if (type === 'temp') {
    return `${value} °C`
  } else if (type === 'hum') {
    return `${value}%`
  } else if (type === 'rssi') {
    return `${value} dBm`
  } else {
    return `${value} (${type})`
  }
}
