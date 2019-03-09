const Telegraf = require('telegraf')
const TelegrafInlineMenu = require('telegraf-inline-menu')

const data = require('../lib/data')
const format = require('../lib/format')
const {getCommonPrefix, getWithoutCommonPrefix} = require('../lib/mqtt-topic')
const {toggleKeyInArray} = require('../lib/array-helper')

const Graph = require('../lib/graph')

const MINUTES_IN_SECONDS = 60
const HOUR_IN_SECONDS = 60 * MINUTES_IN_SECONDS
const DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS

const POSITIONS_PER_MENU_PAGE = 10

function calculateSecondsFromTimeframeString(timeframe) {
  const match = timeframe.match(/(\d+) ?(\w+)/)

  if (match[2] === 'min') {
    return Number(match[1]) * MINUTES_IN_SECONDS
  }

  if (match[2] === 'h') {
    return Number(match[1]) * HOUR_IN_SECONDS
  }

  if (match[2] === 'd') {
    return Number(match[1]) * DAY_IN_SECONDS
  }

  return 7 * DAY_IN_SECONDS
}

function defaultSettings() {
  return {
    positions: [],
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

menu.submenu(ctx => '🕑 ' + (ctx.session.graph || defaultSettings()).timeframe, 'timeframe', new TelegrafInlineMenu('Welchen Zeitbereich soll der Graph zeigen?'))
  .select('t', ['40min', '4h', '12h', '48h', '7d', '28d', '90d'], {
    columns: 2,
    setParentMenuAfter: true,
    isSetFunc: (ctx, key) => key === ctx.session.graph.timeframe,
    setFunc: (ctx, key) => {
      ctx.session.graph.timeframe = key
    }
  })

function getRelevantPositions(ctx) {
  const selectedTypes = (ctx.session.graph || defaultSettings()).types
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

  const result = {}
  for (let i = 0; i < positions.length; i++) {
    result[positions[i]] = displayNames[i]
  }

  return result
}

function positionsButtonText(ctx) {
  const relevantPositions = getRelevantPositions(ctx)
  const selectedPositions = (ctx.session.graph || defaultSettings()).positions
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
  },
  getCurrentPage: ctx => ctx.session.graph.positionsPage,
  setPage: (ctx, page) => {
    ctx.session.graph.positionsPage = page
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
  ctx.answerCbQuery()
  ctx.editMessageText('Die Graphen werden erstellt, habe einen Moment Geduld…')

  const {types, positions, timeframe} = ctx.session.graph

  const timeframeInSeconds = calculateSecondsFromTimeframeString(timeframe)
  const minDate = Date.now() - (timeframeInSeconds * 1000)
  const minUnixTimestamp = minDate / 1000

  const graphs = []

  for (const t of types) {
    const g = new Graph(t, minUnixTimestamp)
    for (const p of positions) {
      g.addSeries(p)
    }

    graphs.push(g)
  }

  const files = await Promise.all(
    graphs.map(g => g.create())
  )

  ctx.replyWithChatAction('upload_photo')
  if (files.length > 1) {
    const mediaArr = files.map(o => ({media: {source: o}, type: 'photo'}))
    await ctx.replyWithMediaGroup(mediaArr)
  } else {
    await ctx.replyWithPhoto({source: files[0]})
  }

  return Promise.all([
    ...graphs.map(g => g.cleanup()),
    ctx.deleteMessage()
  ])
}

module.exports = {
  bot
}
