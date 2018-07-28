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

function calculateXRangeFromTimeframe(timeframe) {
  let match

  if ((match = timeframe.match(/(\d+)d/))) {
    const days = match[1]
    return calculateXRangeForDays(days)
  } else if ((match = timeframe.match(/(\d+)h/))) {
    const hours = match[1]
    return calculateXRangeForHours(hours)
  } else if (timeframe === 'all') {
    return { min: '*', max: '*' }
  } else {
    return calculateXRangeForDays(7)
  }
}

function calculateXRangeForDays(days) {
  return {
    min: Math.floor(Date.now() / 1000 / DAY_IN_SECONDS - (days - 1)) * DAY_IN_SECONDS,
    max: '*'
  }
}

function calculateXRangeForHours(hours) {
  return {
    min: Math.floor(Date.now() / 1000 / HOUR_IN_SECONDS - (hours - 1)) * HOUR_IN_SECONDS,
    max: Math.ceil(Date.now() / 1000 / HOUR_IN_SECONDS) * HOUR_IN_SECONDS
  }
}

function defaultSettings() {
  return {
    positions: lastData.getPositions(),
    types: [
      'temp',
      'hum'
    ],
    timeframe: '48h'
  }
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
  if (!ctx.session.graph) {
    ctx.session.graph = defaultSettings()
  }
  const buttons = generateKeyboardButtons(ctx)

  return ctx.reply(
    'Wie möchtest du deine Graphen haben?',
    Extra.markup(Markup.inlineKeyboard(buttons))
  )
})

bot.action('g:create', async ctx => {
  ctx.editMessageText('Die Graphen werden erstellt, habe einen Moment Geduld…')

  const { types, positions, timeframe } = ctx.session.graph

  const xrange = calculateXRangeFromTimeframe(timeframe)
  await Promise.all(types.map(o => exec(createGnuplotCommandLine(o, positions, xrange))))
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
function createGnuplotCommandLine(type, positions, xrange) {
  const typeInformation = format.information[type]

  const gnuplotParams = []
  gnuplotParams.push(`files='${positions.join(' ')}'`)
  gnuplotParams.push(`set ylabel '${typeInformation.label}'`)
  const unit = typeInformation.unit.replace('%', '%%')
  gnuplotParams.push(`unit='${unit}'`)
  gnuplotParams.push(`type='${type}'`)

  gnuplotParams.push(`set xrange [${xrange.min}:${xrange.max}]`)

  // TODO: set DATA_PLOT_DIR in options in order to have always a seperate tmp dir for each plot
  if (!fs.existsSync(DATA_PLOT_DIR)) {
    fs.mkdirSync(DATA_PLOT_DIR)
  }

  return `gnuplot -e "${gnuplotParams.join(';')}" graph.gnuplot`
}
