const fs = require('fs')
const MQTT = require('async-mqtt')
const Telegraf = require('telegraf')
const session = require('telegraf/session')

const lastData = require('./lib/lastData.js')

const partCheckSensors = require('./parts/checkSensors.js')
const partGraph = require('./parts/graph.js')
const partLog = require('./parts/log.js')
const partNotify = require('./parts/notify.js')
const partStatus = require('./parts/status.js')

const TEMP_SENSOR_OUTDOOR = process.env.npm_package_config_temp_sensor_outdoor

const token = fs.readFileSync(process.env.npm_package_config_tokenpath, 'utf8').trim()
const bot = new Telegraf(token)
bot.use(session())

const client = MQTT.connect('tcp://etoPiServer:1883')

client.on('connect', async () => {
  console.log('connected to mqtt server')
  await client.subscribe('+/status/temp/#')
})

client.on('message', (topic, message) => {
  const time = Date.now()
  const msgStr = message.toString()
  // console.log('incoming message', topic, msgStr)
  const position = topic.split('/')[3]
  const type = topic.split('/')[4]
  const value = Number(msgStr)

  partLog.logValue(position, type, time, value)

  const newVal = {
    time,
    value
  }

  lastData.setSensorValue(position, type, newVal)

  if (type === 'temp' && position === TEMP_SENSOR_OUTDOOR) {
    partNotify.notifyWhenNeeded(bot.telegram)
  }
})

bot.use(partCheckSensors)
bot.use(partGraph)
bot.use(partNotify.bot)
bot.use(partStatus)

bot.command('start', ctx => {
  ctx.reply(`Hi ${ctx.from.first_name}!\n\nWenn du den Status der aktuellen Sensoren sehen willst, nutze /status oder /graph.\nWenn du eine Benachrichtigung haben möchtest, wenn es draußen wärmer wird als drinnen, nutze /notify.`)
})

bot.catch(err => {
  if (err.description === 'Bad Request: message is not modified') return
  console.error(err)
})

bot.startPolling()
