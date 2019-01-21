const fs = require('fs')
const util = require('util')
const childProcess = require('child_process')

const Telegraf = require('telegraf')
const TelegrafInlineMenu = require('telegraf-inline-menu')

const exec = util.promisify(childProcess.exec)

const format = require('../lib/format.js')
const lastData = require('../lib/last-data.js')
const {getWithoutCommonPrefix} = require('../lib/mqtt-topic')

const fsPromises = fs.promises

const DATA_PLOT_DIR = './tmp/'
const MINUTES_IN_SECONDS = 60
const HOUR_IN_SECONDS = 60 * MINUTES_IN_SECONDS
const DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS

const XLABEL_AMOUNT = 8
const POSITIONS_PER_MENU_PAGE = 10

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

  if ((match = timeframe.match(/(\d+) ?min/))) {
    const minutes = match[1]
    return calculateXRangeForMinutes(minutes)
  }

  if (timeframe === 'all') {
    return {
      format: '%b',
      tics: DAY_IN_SECONDS * 30,
      mtics: 1,
      min: '*',
      max: '*'
    }
  }

  return calculateXRangeForDays(7)
}

function calculateXRangeForDays(days) {
  const daysPerTic = Math.max(1, Math.round(days / XLABEL_AMOUNT))
  return {
    format: '%d. %b',
    tics: DAY_IN_SECONDS * daysPerTic,
    mtics: daysPerTic > 1 ? daysPerTic : 4,
    min: Math.floor((Date.now() / 1000 / DAY_IN_SECONDS) - (days - 1)) * DAY_IN_SECONDS,
    max: Math.ceil(Date.now() / 1000 / DAY_IN_SECONDS) * DAY_IN_SECONDS
  }
}

function calculateXRangeForHours(hours) {
  const hoursPerTic = Math.max(1, Math.round(hours / XLABEL_AMOUNT))
  return {
    format: '%d. %b %H:00',
    tics: HOUR_IN_SECONDS * hoursPerTic,
    mtics: hoursPerTic > 1 ? hoursPerTic : 4,
    min: Math.floor((Date.now() / 1000 / HOUR_IN_SECONDS) - (hours - 1)) * HOUR_IN_SECONDS,
    max: Math.ceil(Date.now() / 1000 / HOUR_IN_SECONDS) * HOUR_IN_SECONDS
  }
}

function calculateXRangeForMinutes(minutes) {
  const minutesPerTic = Math.max(1, Math.round(minutes / XLABEL_AMOUNT))
  return {
    format: '%d. %b %H:%M',
    tics: MINUTES_IN_SECONDS * minutesPerTic,
    mtics: minutesPerTic > 1 ? minutesPerTic : 1,
    min: Math.floor((Date.now() / 1000 / MINUTES_IN_SECONDS) - (minutes - 1)) * MINUTES_IN_SECONDS,
    max: Math.ceil(Date.now() / 1000 / MINUTES_IN_SECONDS) * MINUTES_IN_SECONDS
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

menu.select('timeframe', ['40min', '4h', '12h', '48h', '7d', '28d', 'all'], {
  columns: 4,
  isSetFunc: (ctx, key) => key === ctx.session.graph.timeframe,
  setFunc: (ctx, key) => {
    ctx.session.graph.timeframe = key
  }
})

function positionsOptions(ctx) {
  const positions = lastData.getPositions()
  const page = ctx.session.graph.positionsPage || 0
  const firstEntry = page * POSITIONS_PER_MENU_PAGE
  const currentPageEntries = positions.slice(firstEntry, firstEntry + POSITIONS_PER_MENU_PAGE)
  return currentPageEntries
}

menu.select('positions', positionsOptions, {
  columns: 1,
  maxRows: POSITIONS_PER_MENU_PAGE,
  multiselect: true,
  isSetFunc: (ctx, key) => ctx.session.graph.positions.indexOf(key) >= 0,
  setFunc: (ctx, key) => {
    const allPositions = lastData.getPositions()
    ctx.session.graph.positions = toggleKeyInArray(ctx.session.graph.positions, key, allPositions)
  }
})

function possiblePages() {
  const positions = lastData.getPositions()
  const result = []
  const pages = Math.ceil(positions.length / POSITIONS_PER_MENU_PAGE)
  for (let i = 1; i <= pages; i++) {
    result.push(i)
  }

  return result
}

menu.select('positionPage', possiblePages, {
  isSetFunc: (ctx, key) => (ctx.session.graph.positionsPage || 0) === Number(key) - 1,
  setFunc: (ctx, key) => {
    console.log('set positionsPage', key)
    ctx.session.graph.positionsPage = Number(key - 1)
  },
  hide: (ctx, key) => {
    console.log('positionsPag hidee', key)
    return lastData.getPositions().length <= POSITIONS_PER_MENU_PAGE
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
      const sensorValue = lastData.getSensorValue(pos, type)
      if (sensorValue) {
        values[pos] = sensorValue.value
      }
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

function createGnuplotCommandLine(dir, type, positions, xrange) {
  const typeInformation = format.information[type]

  const gnuplotParams = []
  gnuplotParams.push(`dir='${dir}'`)
  gnuplotParams.push(`files='${positions.join(' ')}'`)
  gnuplotParams.push(`fileLabels='${getWithoutCommonPrefix(positions).join(' ')}'`)
  gnuplotParams.push(`set ylabel '${typeInformation.label}'`)
  const unit = typeInformation.unit.replace('%', '%%')
  gnuplotParams.push(`unit='${unit}'`)
  gnuplotParams.push(`type='${type}'`)

  gnuplotParams.push(`set xrange [${xrange.min}:${xrange.max}]`)
  gnuplotParams.push(`set xtics format '${xrange.format}'`)
  gnuplotParams.push(`set xtics ${xrange.tics}`)
  gnuplotParams.push(`set mxtics ${xrange.mtics}`)

  return `nice gnuplot -e "${gnuplotParams.join(';')}" graph.gnuplot`
}

module.exports = {
  bot
}
