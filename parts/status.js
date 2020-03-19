const Telegraf = require('telegraf')
const TelegrafInlineMenu = require('telegraf-inline-menu')

const data = require('../lib/data')
const format = require('../lib/format')
const {getCommonPrefix} = require('../lib/mqtt-topic')
const {toggleKeyInArray} = require('../lib/array-helper')

const menu = new TelegrafInlineMenu(getStatusText)
menu.setCommand('status')

function getSelectedTypes(ctx) {
  return ((ctx.session.status || {}).types || data.getTypes())
    .filter(o => o !== 'connected')
}

function getStatusText(ctx) {
  const typesOfInterest = getSelectedTypes(ctx)
  if (typesOfInterest.length === 0) {
    return 'no type selected 😔'
  }

  const positions = data.getPositions(o =>
    Object.keys(o).some(type => typesOfInterest.includes(type))
  )
  const commonPrefix = getCommonPrefix(positions)

  const lines = positions.map(position => {
    const types = data.getTypesOfPosition(position)
      .filter(o => typesOfInterest.includes(o))

    let parts = ''
    const connected = data.getLastValue(position, 'connected')
    parts += format.connectionStatus(connected && connected.value).emoji
    parts += ' '

    parts += `*${position.slice(commonPrefix.length)}*`
    parts += ' '
    parts += types.map(type =>
      format.typeValue(type, data.getLastValue(position, type).value)
    ).join(', ')

    return parts
  })

  let text = `*${commonPrefix}*\n`
  text += lines.join('\n')
  return text
}

function typeOptions() {
  const allTypes = data.getTypes()
    .filter(o => o !== 'connected')
  const result = {}
  allTypes.forEach(type => {
    result[type] = format.information[type] ? format.information[type].label : type
  })
  return result
}

menu.select('type', typeOptions, {
  columns: 2,
  multiselect: true,
  isSetFunc: (ctx, key) => getSelectedTypes(ctx).includes(key),
  setFunc: (ctx, key) => {
    if (!ctx.session.status) {
      ctx.session.status = {}
    }

    ctx.session.status.types = toggleKeyInArray(getSelectedTypes(ctx), key)
  }
})

const bot = new Telegraf.Composer()
bot.use(menu.init({
  actionCode: 'status'
}))

module.exports = {
  bot
}
