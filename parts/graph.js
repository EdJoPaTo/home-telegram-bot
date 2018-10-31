const fs = require('fs')
const util = require('util')
const childProcess = require('child_process')

const Telegraf = require('telegraf')
const TelegrafInlineMenu = require('telegraf-inline-menu')

const exec = util.promisify(childProcess.exec)

const format = require('../lib/format.js')
const lastData = require('../lib/last-data.js')

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
  }
  if ((match = timeframe.match(/(\d+)h/))) {
    const hours = match[1]
    return calculateXRangeForHours(hours)
  }
  if (timeframe === 'all') {
    return {min: '*', max: '*'}
  }
  return calculateXRangeForDays(7)
}

function calculateXRangeForDays(days) {
  return {
    min: Math.floor((Date.now() / 1000 / DAY_IN_SECONDS) - (days - 1)) * DAY_IN_SECONDS,
    max: '*'
  }
}

function calculateXRangeForHours(hours) {
  return {
    min: Math.floor((Date.now() / 1000 / HOUR_IN_SECONDS) - (hours - 1)) * HOUR_IN_SECONDS,
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

function toggleKeyInArray(arr, key, allKeysOrdered) {
  const currentState = arr.indexOf(key) >= 0
  const newState = !currentState
  return setKeyInArray(arr, key, newState, allKeysOrdered)
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

const menu = new TelegrafInlineMenu('Wie möchtest du deine Graphen haben?')
menu.setCommand('graph')

menu.select('type', typeOptions(), {
  columns: 2,
  multiselect: true,
  isSetFunc: (ctx, key) => ctx.session.graph.types.indexOf(key) >= 0,
  setFunc: (ctx, key) => {
    const allTypes = Object.keys(format.information)
    ctx.session.graph.types = toggleKeyInArray(ctx.session.graph.types, key, allTypes)
  }
})

function typeOptions() {
  const allTypes = Object.keys(format.information)
  const result = {}
  allTypes.forEach(type => {
    result[type] = format.information[type].label
  })
  return result
}

menu.select('timeframe', ['4h', '12h', '48h', '7d', '28d', 'all'], {
  columns: 3,
  isSetFunc: (ctx, key) => key === ctx.session.graph.timeframe,
  setFunc: (ctx, key) => {
    ctx.session.graph.timeframe = key
  }
})

menu.select('positions', lastData.getPositions, {
  columns: 2,
  multiselect: true,
  isSetFunc: (ctx, key) => ctx.session.graph.positions.indexOf(key) >= 0,
  setFunc: (ctx, key) => {
    const allPositions = lastData.getPositions()
    ctx.session.graph.positions = toggleKeyInArray(ctx.session.graph.positions, key, allPositions)
  }
})

menu.simpleButton('Graph erstellen', 'create', {
  doFunc: ctx => createGraph(ctx),
  hide: ctx => isCreationNotPossible(ctx)
})

menu.simpleButton('⚠️ Graph erstellen ⚠️', 'create-hint', {
  doFunc: ctx => ctx.answerCbQuery(isCreationNotPossible(ctx)),
  hide: ctx => !isCreationNotPossible(ctx)
})

const bot = new Telegraf.Composer()
bot.use(menu.init({
  actionCode: 'graph'
}))

function isCreationNotPossible(ctx) {
  if (!ctx.session.graph) {
    ctx.session.graph = defaultSettings()
    return 'Ich hab den Faden verloren 🎈. Stimmt alles?'
  }
  if (!ctx.session.graph.positions || ctx.session.graph.positions.length === 0) {
    return 'Ohne gewählte Sensoren kann ich das nicht! 😨'
  }
  if (!ctx.session.graph.types || ctx.session.graph.types.length === 0) {
    return 'Ohne gewählte Graphenarten kann ich das nicht! 😨'
  }
}

async function createGraph(ctx) {
  ctx.editMessageText('Die Graphen werden erstellt, habe einen Moment Geduld…')

  const {types, positions, timeframe} = ctx.session.graph

  const xrange = calculateXRangeFromTimeframe(timeframe)
  const dir = await fsPromises.mkdtemp(DATA_PLOT_DIR)
  await Promise.all(types.map(type => {
    const values = {}
    positions.forEach(pos => {
      values[pos] = lastData.getSensorValue(pos, type).value
    })

    const orderedPositions = [...positions]
    orderedPositions.sort((posA, posB) => {
      const valA = values[posA]
      const valB = values[posB]
      return valB - valA
    })
    return exec(createGnuplotCommandLine(dir, type, orderedPositions, xrange))
  }))

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
}

// Debug
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

module.exports = {
  bot
}
