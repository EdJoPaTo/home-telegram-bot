const fs = require('fs')
const Telegraf = require('telegraf')
const util = require('util')

const exec = util.promisify(require('child_process').exec)

const format = require('../lib/format.js')
const lastData = require('../lib/lastData.js')

const DATA_PLOT_DIR = './tmp/'
const DAY_IN_SECONDS = 60 * 60 * 24
const DAYS_IN_GRAPH = 7

const bot = new Telegraf.Composer()
module.exports = bot

bot.command('graph', async ctx => {
  const tmpMsgPromise = ctx.reply('Die Graphen werden erstellt, habe einen Moment Geduld…')

  const positions = lastData.getPositions()
  const types = Object.keys(format.information)

  await Promise.all(types.map(o => exec(createGnuplotCommandLine(o, positions))))
  const mediaArr = types.map(o => ({media: { source: `${DATA_PLOT_DIR}${o}.png` }, type: 'photo'}))

  ctx.replyWithChatAction('upload_photo')
  await ctx.replyWithMediaGroup(mediaArr)

  const tmpMsg = await tmpMsgPromise
  return ctx.telegram.deleteMessage(ctx.chat.id, tmpMsg.message_id)
})

// console.log('gnuplot commandline:', createGnuplotCommandLine('temp', ['bude', 'bed', 'books', 'rt', 'wt']))
function createGnuplotCommandLine(type, positions) {
  const typeInformation = format.information[type]

  const gnuplotParams = []
  gnuplotParams.push(`files='${positions.join(' ')}'`)
  gnuplotParams.push(`set ylabel '${typeInformation.label}'`)
  const unit = typeInformation.unit.replace('%', '%%')
  gnuplotParams.push(`unit='${unit}'`)
  gnuplotParams.push(`type='${type}'`)

  const xmin = Math.floor(Date.now() / 1000 / DAY_IN_SECONDS - (DAYS_IN_GRAPH - 1)) * DAY_IN_SECONDS
  gnuplotParams.push(`set xrange [${xmin}:*]`)

  // TODO: set DATA_PLOT_DIR in options in order to have always a seperate tmp dir for each plot
  if (!fs.existsSync(DATA_PLOT_DIR)) {
    fs.mkdirSync(DATA_PLOT_DIR)
  }

  return `gnuplot -e "${gnuplotParams.join(';')}" graph.gnuplot`
}
