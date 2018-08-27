const Telegraf = require('telegraf')

const format = require('../lib/format.js')
const lastData = require('../lib/last-data.js')
const telegrafHandlerUpdatedReply = require('../lib/telegraf-handler-updated-reply.js')

const {Extra} = Telegraf

const UPDATE_EVERY_MS = 1000 * 1 // Update message every 1 second
const UPDATE_UNTIL_MS = 1000 * 30 // Update message for 30 seconds

const bot = new Telegraf.Composer()
module.exports = bot

bot.command('checksensors', telegrafHandlerUpdatedReply(UPDATE_EVERY_MS, UPDATE_UNTIL_MS, generate))

function generate() {
  const positions = lastData.getPositions()
  const currentDate = Date.now()

  const entries = positions.map(p => {
    const values = lastData.getAllSensorValues(p)
    const types = Object.keys(values)
      .filter(o => o !== 'connected')
    types.sort()

    let text = `*${p}*\n`

    text += format.connectionStatus(values, {withText: true, withTime: true})
    text += `\n`

    text += types.map(t => {
      const old = values[t].time
      const age = currentDate - old

      return `  ${t} ${format.basedOnAge(old, currentDate, t, format.timespan(age))}`
    }).join('\n')

    return text
  })
    .filter(o => o !== '')

  return {
    text: entries.join('\n'),
    extra: Extra.markdown()
  }
}
