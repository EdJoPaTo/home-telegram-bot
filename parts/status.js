const Telegraf = require('telegraf')

const format = require('../lib/format.js')
const lastData = require('../lib/last-data.js')

const bot = new Telegraf.Composer()
module.exports = bot

bot.command('status', ctx => {
  const positions = lastData.getPositions()

  const lines = positions.map(position => {
    const sensorData = lastData.getAllSensorValues(position)
    const types = Object.keys(sensorData)
      .filter(o => o !== 'connected')

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

  const text = lines.join('\n')
  return ctx.replyWithMarkdown(text)
})
