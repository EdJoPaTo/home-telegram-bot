const Telegraf = require('telegraf')

const format = require('../lib/format.js')
const lastData = require('../lib/last-data.js')

const AGE_HIDE = 1000 * 60 * 60 * 3 // 3h

const bot = new Telegraf.Composer()
module.exports = bot

bot.command('status', ctx => {
  const positions = lastData.getPositions()

  const lines = positions.map(position => {
    const sensorData = lastData.getAllSensorValues(position)
    const types = Object.keys(sensorData)
      .filter(o => o !== 'connected')

    const timestamps = types.map(type => sensorData[type].time)
    const minAge = Date.now() - Math.max(...timestamps)

    if (minAge > AGE_HIDE) {
      return '' // Will be filtered out
    }

    let parts = ''
    parts += format.connectionStatus(sensorData, {withText: false})
    parts += ' '

    parts += `*${position}*`
    parts += ' '
    parts += types.map(type =>
      format.typeValue(type, sensorData[type].value)
    ).join(', ')

    return parts
  })
    .filter(o => o !== '')

  const text = lines.join('\n')
  return ctx.replyWithMarkdown(text)
})
