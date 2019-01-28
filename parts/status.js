const Telegraf = require('telegraf')

const data = require('../lib/data')
const format = require('../lib/format.js')

const bot = new Telegraf.Composer()
module.exports = bot

bot.command('status', ctx => {
  const positions = data.getPositions()

  const lines = positions.map(position => {
    const types = data.getTypesOfPosition(position)
      .filter(o => o !== 'connected')

    if (types.length === 0) {
      return ''
    }

    let parts = ''
    const connected = data.getLastValue(position, 'connected') || {}
    parts += format.connectionStatusEmoji(connected.value)
    parts += ' '

    parts += `*${position}*`
    parts += ' '
    parts += types.map(type =>
      format.typeValue(type, data.getLastValue(position, type).value)
    ).join(', ')

    return parts
  })
    .filter(o => o)

  const text = lines.join('\n')
  return ctx.replyWithMarkdown(text)
})
