const Telegraf = require('telegraf')

const format = require('../lib/format.js')
const lastData = require('../lib/last-data.js')

const bot = new Telegraf.Composer()
module.exports = bot

bot.command('checksensors', ctx => {
  const positions = lastData.getPositions()
  const currentDate = Date.now()

  const entries = positions.map(p => {
    const values = lastData.getAllSensorValues(p)
    const types = Object.keys(values)
      .filter(o => o !== 'connected')
    types.sort()

    let text = `*${p}*\n`

    text += format.connectionStatus(values, {withText: true, withTime: true})
    text += '\n'

    text += types.map(t => {
      const old = values[t].time
      const age = currentDate - old

      return `  ${t} ${format.basedOnAge(old, currentDate, t, format.timespan(age))}`
    }).join('\n')

    return text
  })
    .filter(o => o !== '')

  const text = entries.join('\n')
  return ctx.replyWithMarkdown(text)
})
