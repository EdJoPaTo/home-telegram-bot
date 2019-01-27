const MQTT = require('async-mqtt')
const Telegraf = require('telegraf')
const LocalSession = require('telegraf-session-local')

const lastData = require('./lib/last-data.js')
const {loadConfig} = require('./lib/config')

const partCheckSensors = require('./parts/check-sensors.js')
const partGraph = require('./parts/graph.js')
const partLog = require('./parts/log.js')
const partNotify = require('./parts/notify.js')
const partStatus = require('./parts/status.js')

const TEMP_SENSOR_OUTDOOR = process.env.npm_package_config_temp_sensor_outdoor

const config = loadConfig()

const bot = new Telegraf(config.telegramBotToken)
bot.use(new LocalSession({
  getSessionKey: ctx => ctx.from.id,
  database: './tmp/sessions.json'
}))

console.log(`MQTT connecting to ${config.mqttServer}`)
const client = MQTT.connect(config.mqttServer)

client.on('connect', async () => {
  console.log('connected to mqtt server')
  await Promise.all(
    config.mqttTopics.map(topic => client.subscribe(topic))
  )
})

client.on('message', (topic, message, packet) => {
  const time = Date.now()
  const msgStr = message.toString()
  // Debug
  // console.log('incoming message', topic, msgStr, packet)
  const value = Number(msgStr)

  if (!msgStr || !isFinite(value)) {
    console.log('dropping non finite number', topic, msgStr)
    return
  }

  const topicSplitted = topic.split('/')
  const type = topicSplitted.slice(-1)[0]
  const position = topicSplitted
    .slice(0, topicSplitted.length - 1)
    .filter((o, i) => i !== 1 || o !== 'status')
    .join('/')

  if (!packet.retain) {
    // Do not log when the value is a retained one
    partLog.logValue(position, type, time, value)
  }

  lastData.setSensorValue(position, type, time, value)

  if (type === 'temp' && position === TEMP_SENSOR_OUTDOOR) {
    partNotify.notifyTempWhenNeeded(bot.telegram)
  }

  if (type === 'connected') {
    partNotify.notifyConnectedWhenNeeded(bot.telegram, position, value)
  }
})

bot.use(partCheckSensors)
bot.use(partGraph.bot)
bot.use(partNotify.bot)
bot.use(partStatus)

bot.command('start', ctx => {
  ctx.reply(`Hi ${ctx.from.first_name}!\n\nWenn du den Status der aktuellen Sensoren sehen willst, nutze /status oder /graph.\nWenn du eine Benachrichtigung haben möchtest, wenn es draußen wärmer wird als drinnen, nutze /notify.`)
})

bot.catch(error => {
  if (error.description === 'Bad Request: message is not modified') {
    return
  }

  console.error(error)
})

bot.startPolling()
