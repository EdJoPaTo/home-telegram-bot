const fs = require('fs')
const util = require('util')
const childProcess = require('child_process')

const Telegraf = require('telegraf')
const TelegrafInlineMenu = require('telegraf-inline-menu')

const exec = util.promisify(childProcess.exec)

const data = require('../lib/data')
const format = require('../lib/format.js')
const {getCommonPrefix, getWithoutCommonPrefix} = require('../lib/mqtt-topic')

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

function setKeyInArray(arr, key, newState) {
  if (newState) {
    arr.push(key)
  } else {
    arr = arr.filter(o => o !== key)
  }

  return arr
}

function toggleKeyInArray(arr, key) {
  const currentState = arr.indexOf(key) >= 0
  const newState = !currentState
  return setKeyInArray(arr, key, newState)
}

function defaultSettings() {
  return {
    positions: data.getPositions(),
    types: [
      'temp',
      'hum'
    ],
    timeframe: '48h'
  }
}

const menu = new TelegrafInlineMenu('Wie möchtest du deine Graphen haben?')
menu.setCommand('graph')

menu.select('type', typeOptions, {
  columns: 2,
  multiselect: true,
  isSetFunc: (ctx, key) => ctx.session.graph.types.indexOf(key) >= 0,
  setFunc: (ctx, key) => {
    ctx.session.graph.types = toggleKeyInArray(ctx.session.graph.types, key)
  }
})

function typeOptions() {
  const allTypes = data.getTypes()
  const result = {}
  allTypes.forEach(type => {
    result[type] = format.information[type] ? format.information[type].label : type
  })
  return result
}

menu.submenu(ctx => '🕑 ' + ctx.session.graph.timeframe, 'timeframe', new TelegrafInlineMenu('Welchen Zeitbereich soll der Graph zeigen?'))
  .select('t', ['40min', '4h', '12h', '48h', '7d', '28d', 'all'], {
    columns: 2,
    setParentMenuAfter: true,
    isSetFunc: (ctx, key) => key === ctx.session.graph.timeframe,
    setFunc: (ctx, key) => {
      ctx.session.graph.timeframe = key
    }
  })

function getRelevantPositions(ctx) {
  const selectedTypes = ctx.session.graph.types
  if (selectedTypes.length === 0) {
    return []
  }

  return data.getPositions(pos => {
    const typesOfPos = Object.keys(pos)
    const posHasRequiredType = selectedTypes
      .every(t => typesOfPos.indexOf(t) >= 0)
    return posHasRequiredType
  })
}

function positionsOptions(ctx) {
  const positions = getRelevantPositions(ctx)
  const displayNames = getWithoutCommonPrefix(positions)
  const maxPage = Math.ceil(positions.length / POSITIONS_PER_MENU_PAGE) - 1
  const page = Math.min(ctx.session.graph.positionsPage || 0, maxPage)
  const firstEntry = page * POSITIONS_PER_MENU_PAGE
  const currentPageEntries = positions.slice(firstEntry, firstEntry + POSITIONS_PER_MENU_PAGE)

  const result = {}
  for (let i = 0; i < currentPageEntries.length; i++) {
    result[currentPageEntries[i]] = displayNames[firstEntry + i]
  }

  return result
}

function positionsButtonText(ctx) {
  const relevantPositions = getRelevantPositions(ctx)
  const selectedPositions = ctx.session.graph.positions
    .filter(o => relevantPositions.indexOf(o) >= 0)

  let text = ''
  if (selectedPositions.length === 0 && relevantPositions.length > 0) {
    text += '⚠️'
  } else {
    text += '📡'
  }

  text += ' '
  text += `${selectedPositions.length} / ${relevantPositions.length}`
  return text
}

function positionsText(ctx) {
  let text = 'Welche Daten soll der Graph zeigen?'
  text += '\n\n'

  const relevantPositions = getRelevantPositions(ctx)
  const commonPrefix = getCommonPrefix(relevantPositions)
  const selectedPositions = ctx.session.graph.positions
    .filter(o => relevantPositions.indexOf(o) >= 0)
    .map(o => o.slice(commonPrefix.length))
    .sort()

  if (selectedPositions.length > 0) {
    text += '*Datenquellen*\n'
    text += selectedPositions
      .join('\n')
  }

  return text
}

const positionsMenu = new TelegrafInlineMenu(positionsText)

menu.submenu(positionsButtonText, 'pos', positionsMenu)

positionsMenu.select('p', positionsOptions, {
  columns: 1,
  maxRows: POSITIONS_PER_MENU_PAGE,
  multiselect: true,
  isSetFunc: (ctx, key) => ctx.session.graph.positions.indexOf(key) >= 0,
  setFunc: (ctx, key) => {
    ctx.session.graph.positions = toggleKeyInArray(ctx.session.graph.positions, key)
  }
})

function possiblePages(ctx) {
  const positions = getRelevantPositions(ctx)
  const result = []
  const pages = Math.ceil(positions.length / POSITIONS_PER_MENU_PAGE)
  for (let i = 1; i <= pages; i++) {
    result.push(i)
  }

  return result
}

positionsMenu.select('positionPage', possiblePages, {
  isSetFunc: (ctx, key) => (ctx.session.graph.positionsPage || 0) === Number(key) - 1,
  setFunc: (ctx, key) => {
    ctx.session.graph.positionsPage = Number(key - 1)
  },
  hide: ctx => {
    return getRelevantPositions(ctx).length <= POSITIONS_PER_MENU_PAGE
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
  backButtonText: '🔙 zurück…',
  actionCode: 'graph'
}))

function isCreationNotPossible(ctx) {
  if (!ctx.session.graph) {
    ctx.session.graph = defaultSettings()
    return 'Ich hab den Faden verloren 🎈. Stimmt alles?'
  }

  if ((ctx.session.graph.types || []).length === 0) {
    return 'Ohne gewählte Datentypen kann ich das nicht! 😨'
  }

  const availablePositions = getRelevantPositions(ctx)

  if (availablePositions.length === 0) {
    return 'Kein Sensor kann alle gewählten Datentypen! 😨'
  }

  const selectedPositions = (ctx.session.graph.positions || [])
    .filter(o => availablePositions.indexOf(o) >= 0)

  if (selectedPositions.length === 0) {
    return 'Ohne gewählte Sensoren kann ich das nicht! 😨'
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
      const sensorValue = data.getLastValue(pos, type)
      if (sensorValue) {
        values[pos] = sensorValue.value
      }
    })

    const orderedPositions = Object.keys(values)
      .sort((posA, posB) => {
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
  const typeInformation = format.information[type] || {}

  const gnuplotParams = []
  gnuplotParams.push(`dir='${dir}'`)
  gnuplotParams.push(`files='${positions.join(' ')}'`)
  gnuplotParams.push(`fileLabels='${getWithoutCommonPrefix(positions).join(' ')}'`)
  gnuplotParams.push(`set ylabel '${typeInformation.label || type}'`)
  const unit = (typeInformation.unit || '').replace('%', '%%')
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
