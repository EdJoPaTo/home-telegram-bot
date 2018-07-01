const Telegraf = require('telegraf')

const format = require('../lib/format.js')
const lastData = require('../lib/lastData.js')

const { Extra } = Telegraf

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

    if (minTimestamp > format.AGE_HIDE) {
      return '' // will be filtered out
    }

    let parts = ''

    if (maxTimestamp < format.AGE_HINT) {
      parts += `*${position}*`
    } else {
      parts += `${position}`
    }
    parts += ' '
    parts += types.map(type =>
      format.basedOnAge(sensorData[type].time, Date.now(),
        format.typeValue(type, sensorData[type].value)
      )
    ).join(', ')

    return parts
  })
    .filter(o => o !== '')

  return lines.join('\n')
}
