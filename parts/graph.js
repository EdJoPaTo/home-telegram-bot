const fs = require('fs')
const Telegraf = require('telegraf')
const util = require('util')

const exec = util.promisify(require('child_process').exec)

const lastData = require('../lib/lastData.js')

const DATA_PLOT_DIR = './tmp/'


const bot = new Telegraf.Composer()
module.exports = bot

const gnuplotSettings = {
  temp: {
    label: 'Temperature',
    unit: '°C'
  },
  hum: {
    label: 'Humidity',
    unit: '%%'
  },
  rssi: {
    label: 'RSSI',
    unit: ' dBm'
  }
}

bot.command('graph', async ctx => {
  ctx.replyWithChatAction('upload_photo')

  const positions = lastData.getPositions()
  const types = Object.keys(gnuplotSettings)

  await Promise.all(types.map(o => exec(createGnuplotCommandLine(o, positions))))
  const mediaArr = types.map(o => ({media: { source: `${DATA_PLOT_DIR}${o}.png` }, type: 'photo'}))
  return ctx.replyWithMediaGroup(mediaArr)
})

function createGnuplotCommandLine(type, positions) {
  const settings = gnuplotSettings[type]

  const gnuplotParams = []
  gnuplotParams.push(`files='${positions.join(' ')}'`)
  gnuplotParams.push(`set ylabel '${settings.label}'`)
  gnuplotParams.push(`unit='${settings.unit}'`)
  gnuplotParams.push(`type='${type}'`)

  // TODO: set DATA_PLOT_DIR in options in order to have always a seperate tmp dir for each plot
  if (!fs.existsSync(DATA_PLOT_DIR)) {
    fs.mkdirSync(DATA_PLOT_DIR)
  }

  return `gnuplot -e "${gnuplotParams.join(';')}" graph.gnuplot`
}
