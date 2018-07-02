const Telegraf = require('telegraf')

const format = require('../lib/format.js')
const lastData = require('../lib/lastData.js')
const telegrafHandlerUpdatedReply = require('../lib/telegrafHandlerUpdatedReply.js')

const { Extra } = Telegraf

const UPDATE_EVERY_MS = 1000 * 5 // update message every 5 seconds
const UPDATE_UNTIL_MS = 1000 * 30 // update message for 30 seconds
const AGE_HIDE = 1000 * 60 * 60 * 3 // 3h

const bot = new Telegraf.Composer()
module.exports = bot

bot.command('status', telegrafHandlerUpdatedReply(UPDATE_EVERY_MS, UPDATE_UNTIL_MS, generateStatusText))

function generateStatusText() {
  const positions = lastData.getPositions()
  const lines = positions.map(position => {
    const sensorData = lastData.getAllSensorValues(position)
    const types = Object.keys(sensorData)

    const timestamps = types.map(type => sensorData[type].time)
    const minAge = Date.now() - Math.min(...timestamps)

    if (minAge > AGE_HIDE) {
      return '' // will be filtered out
    }

    let parts = `*${position}*`
    parts += ' '
    parts += types.map(type =>
      format.basedOnAge(sensorData[type].time, Date.now(), type,
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
