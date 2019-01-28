const Telegraf = require('telegraf')

const data = require('../lib/data')
const format = require('../lib/format.js')

const bot = new Telegraf.Composer()

bot.command('connected', ctx => {
  const positions = data.getPositions(o => Object.keys(o).indexOf('connected') >= 0)

  const lines = positions.map(position => {
    const connected = data.getLastValue(position, 'connected')

    const parts = []
    parts.push(format.connectionStatusParts[connected.value].emoji)
    parts.push(`*${position}*`)
    if (connected.value !== 2) {
      parts.push(format.connectionStatusParts[connected.value].text)
    }

    if (connected.time) {
      parts.push(format.timespan(Date.now() - connected.time))
    }

    return parts.join(' ')
  })

  const text = lines.join('\n')
  return ctx.replyWithMarkdown(text)
})

module.exports = {
  bot
}
