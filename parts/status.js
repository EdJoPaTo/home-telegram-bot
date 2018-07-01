const Telegraf = require('telegraf')

const format = require('../lib/format.js')
const lastData = require('../lib/lastData.js')
const telegrafHandlerUpdatedReply = require('../lib/telegrafHandlerUpdatedReply.js')

const { Extra } = Telegraf

const UPDATE_EVERY_MS = 1000 * 5 // update message every 5 seconds
const UPDATE_UNTIL_MS = 1000 * 30 // update message for 30 seconds

const bot = new Telegraf.Composer()
module.exports = bot

bot.command('status', telegrafHandlerUpdatedReply(UPDATE_EVERY_MS, UPDATE_UNTIL_MS, generateStatusText))

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

  return {
    text: lines.join('\n'),
    extra: Extra.markdown()
  }
}
