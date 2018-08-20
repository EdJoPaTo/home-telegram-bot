const fs = require('fs')
const Telegraf = require('telegraf')
const util = require('util')

const exec = util.promisify(require('child_process').exec)

const format = require('../lib/format.js')
const lastData = require('../lib/lastData.js')

const {Extra, Markup} = Telegraf
const fsPromises = fs.promises

const DATA_PLOT_DIR = './tmp/'
const DAY_IN_SECONDS = 60 * 60 * 24
const HOUR_IN_SECONDS = 60 * 60

if (!fs.existsSync(DATA_PLOT_DIR)) {
  fs.mkdirSync(DATA_PLOT_DIR)
}

function calculateXRangeFromTimeframe(timeframe) {
  let match

  if ((match = timeframe.match(/(\d+)d/))) {
    const days = match[1]
    return calculateXRangeForDays(days)
  } else if ((match = timeframe.match(/(\d+)h/))) {
    const hours = match[1]
    return calculateXRangeForHours(hours)
  } else if (timeframe === 'all') {
    return {min: '*', max: '*'}
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

function setKeyInArray(arr, key, newState, allKeysOrdered) {
  if (newState) {
    arr.push(key)
  } else {
    arr = arr.filter(o => o !== key)
  }
  return allKeysOrdered.filter(o => arr.indexOf(o) >= 0)
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
  buttons.push(generateKeyboardTypeButtons(ctx))
  buttons.push(generateKeyboardTimeframeButtons(ctx))
  generateKeyboardPositionButtons(ctx)
    .forEach(o => buttons.push([o]))

  const createNotPossible = !ctx.session.graph.positions || ctx.session.graph.positions.length === 0 ||
    !ctx.session.graph.types || ctx.session.graph.types.length === 0
  let text = 'Graph erstellen'
  if (createNotPossible) {
    text = '⚠️ ' + text + ' ⚠️'
  }
  buttons.push([Markup.callbackButton(text, 'g:create')])
  return buttons
}

function generateKeyboardTypeButtons(ctx) {
  const allTypes = Object.keys(format.information)
  return allTypes.map(o => {
    const isEnabled = ctx.session.graph.types.indexOf(o) >= 0
    const label = format.information[o].label

    return Markup.callbackButton(`${format.enabledEmoji(isEnabled)} ${label}`, `g:t:${o}:${!isEnabled}`)
  })
}

function generateKeyboardPositionButtons(ctx) {
  const allPositions = lastData.getPositions()
  return allPositions
    .map(o => {
      const isEnabled = ctx.session.graph.positions.indexOf(o) >= 0
      return Markup.callbackButton(`${format.enabledEmoji(isEnabled)} ${o}`, `g:p:${o}:${!isEnabled}`)
    })
}

function generateKeyboardTimeframeButtons(ctx) {
  const timeframeOptions = ['12h', '48h', '7d', '28d', 'all']
  return timeframeOptions.map(o => {
    const isEnabled = o === ctx.session.graph.timeframe
    const text = isEnabled ? `${format.enabledEmoji(true)} ${o}` : o
    return Markup.callbackButton(text, `g:tf:${o}`)
  })
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

bot.action(/g:(\w+):(\w+)(?::(\w+))?/, async (ctx, next) => {
  // pre and post handling of settings from inline keyboard
  if (!ctx.session.graph) {
    ctx.session.graph = defaultSettings()
  }
  await next()
  const buttons = generateKeyboardButtons(ctx)
  return Promise.all([
    ctx.answerCbQuery('done ☺️'),
    ctx.editMessageReplyMarkup(Markup.inlineKeyboard(buttons))
  ])
})

bot.action(/g:t:(\w+):(\w+)/, ctx => {
  const key = ctx.match[1]
  const newState = ctx.match[2] === 'true'
  const allTypes = Object.keys(format.information)
  ctx.session.graph.types = setKeyInArray(ctx.session.graph.types, key, newState, allTypes)
})

bot.action(/g:p:(\w+):(\w+)/, ctx => {
  const key = ctx.match[1]
  const newState = ctx.match[2] === 'true'
  const allPositions = lastData.getPositions()
  ctx.session.graph.positions = setKeyInArray(ctx.session.graph.positions, key, newState, allPositions)
})

bot.action(/g:tf:(\w+)/, ctx => {
  ctx.session.graph.timeframe = ctx.match[1]
})

bot.action('g:create', async ctx => {
  if (!ctx.session.graph) {
    ctx.session.graph = defaultSettings()
    await ctx.editMessageReplyMarkup(Markup.inlineKeyboard(generateKeyboardButtons(ctx)))
    return ctx.answerCbQuery('Ich hab den Faden verloren 🎈. Stimmt alles?')
  }
  if (!ctx.session.graph.positions || ctx.session.graph.positions.length === 0) {
    return ctx.answerCbQuery('Ohne gewählte Sensoren kann ich das nicht! 😨')
  }
  if (!ctx.session.graph.types || ctx.session.graph.types.length === 0) {
    return ctx.answerCbQuery('Ohne gewählte Graphenarten kann ich das nicht! 😨')
  }

  ctx.editMessageText('Die Graphen werden erstellt, habe einen Moment Geduld…')

  const {types, positions, timeframe} = ctx.session.graph

  const xrange = calculateXRangeFromTimeframe(timeframe)
  const dir = await fsPromises.mkdtemp(DATA_PLOT_DIR)
  await Promise.all(types.map(o => exec(createGnuplotCommandLine(dir, o, positions, xrange))))

  ctx.replyWithChatAction('upload_photo')
  if (types.length > 1) {
    const mediaArr = types.map(o => ({media: {source: `${dir}/${o}.png`}, type: 'photo'}))
    await ctx.replyWithMediaGroup(mediaArr)
  } else {
    await ctx.replyWithPhoto({source: `${dir}/${types[0]}.png`})
  }

  await Promise.all(types.map(o => fsPromises.unlink(`${dir}/${o}.png`)))
  return Promise.all([
    ctx.answerCbQuery(),
    fsPromises.rmdir(dir),
    ctx.deleteMessage()
  ])
})

// console.log('gnuplot commandline:', createGnuplotCommandLine('temp', ['bude', 'bed', 'books', 'rt', 'wt']))
function createGnuplotCommandLine(dir, type, positions, xrange) {
  const typeInformation = format.information[type]

  const gnuplotParams = []
  gnuplotParams.push(`dir='${dir}'`)
  gnuplotParams.push(`files='${positions.join(' ')}'`)
  gnuplotParams.push(`set ylabel '${typeInformation.label}'`)
  const unit = typeInformation.unit.replace('%', '%%')
  gnuplotParams.push(`unit='${unit}'`)
  gnuplotParams.push(`type='${type}'`)

  gnuplotParams.push(`set xrange [${xrange.min}:${xrange.max}]`)

  return `nice gnuplot -e "${gnuplotParams.join(';')}" graph.gnuplot`
}
