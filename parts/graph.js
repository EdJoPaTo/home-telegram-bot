const fs = require('fs')
const Telegraf = require('telegraf')
const util = require('util')

const exec = util.promisify(require('child_process').exec)

const format = require('../lib/format.js')
const lastData = require('../lib/lastData.js')

const { Extra, Markup } = Telegraf

const DATA_PLOT_DIR = './tmp/'
const DAY_IN_SECONDS = 60 * 60 * 24
const HOUR_IN_SECONDS = 60 * 60

function calculateXMinFromTimeframe(timeframe) {
  let match

  if ((match = timeframe.match(/(\d+)d/))) {
    const days = match[1]
    return calculateXMinForDays(days)
  } else if ((match = timeframe.match(/(\d+)h/))) {
    const hours = match[1]
    return calculateXMinForHours(hours)
  } else {
    return calculateXMinForDays(7)
  }
}

function calculateXMinForDays(days) {
  return Math.floor(Date.now() / 1000 / DAY_IN_SECONDS - (days - 1)) * DAY_IN_SECONDS
}

function calculateXMinForHours(hours) {
  return Math.floor(Date.now() / 1000 / HOUR_IN_SECONDS - (hours - 1)) * HOUR_IN_SECONDS
}


const bot = new Telegraf.Composer()
module.exports = bot

function generateKeyboardButtons(ctx) {
  const buttons = []

  const positions = lastData.getPositions()
  const types = Object.keys(format.information)

  // TODO: put in session

  buttons.push([ Markup.callbackButton('Graph erstellen', 'g:create') ])

  return buttons
}

bot.command('graph', ctx => {
  const buttons = generateKeyboardButtons(ctx)

  return ctx.reply(
    'Wie möchtest du deinen Graphen haben?',
    Extra.markup(Markup.inlineKeyboard(buttons))
  )
})

bot.action('g:create', async ctx => {
  ctx.editMessageText('Die Graphen werden erstellt, habe einen Moment Geduld…')

  // TODO: get from session
  const selectedSettings = {
    types: ['temp', 'hum', 'rssi'],
    positions: ['bude', 'bed', 'wt', 'rt'],
    timeframe: '48h'
  }

  const { types, positions, timeframe } = selectedSettings

  const xmin = calculateXMinFromTimeframe(timeframe)
  await Promise.all(types.map(o => exec(createGnuplotCommandLine(o, positions, xmin))))
  ctx.replyWithChatAction('upload_photo')
  if (types.length > 1) {
    const mediaArr = types.map(o => ({media: { source: `${DATA_PLOT_DIR}${o}.png` }, type: 'photo'}))
    await ctx.replyWithMediaGroup(mediaArr)
  } else {
    await ctx.replyWithPhoto({ source: `${DATA_PLOT_DIR}${types[0]}.png` })
  }

  return ctx.deleteMessage()
})

// console.log('gnuplot commandline:', createGnuplotCommandLine('temp', ['bude', 'bed', 'books', 'rt', 'wt']))
function createGnuplotCommandLine(type, positions, xmin) {
  const typeInformation = format.information[type]

  const gnuplotParams = []
  gnuplotParams.push(`files='${positions.join(' ')}'`)
  gnuplotParams.push(`set ylabel '${typeInformation.label}'`)
  const unit = typeInformation.unit.replace('%', '%%')
  gnuplotParams.push(`unit='${unit}'`)
  gnuplotParams.push(`type='${type}'`)

  gnuplotParams.push(`set xrange [${xmin}:*]`)

  // TODO: set DATA_PLOT_DIR in options in order to have always a seperate tmp dir for each plot
  if (!fs.existsSync(DATA_PLOT_DIR)) {
    fs.mkdirSync(DATA_PLOT_DIR)
  }

  return `gnuplot -e "${gnuplotParams.join(';')}" graph.gnuplot`
}
