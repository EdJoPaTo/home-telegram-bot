const MQTT = require('async-mqtt')
const Telegraf = require('telegraf')
const LocalSession = require('telegraf-session-local')

const data = require('./lib/data.js')
const {loadConfig} = require('./lib/config')

const partConnected = require('./parts/connected')
const partGraph = require('./parts/graph.js')
const partNotify = require('./parts/notify.js')
const partStatus = require('./parts/status.js')

const TEMP_SENSOR_OUTDOOR = process.env.npm_package_config_temp_sensor_outdoor

const config = loadConfig()

const bot = new Telegraf(config.telegramBotToken)
bot.use(new LocalSession({
  getSessionKey: ctx => ctx.from.id,
  database: './persistent/sessions.json'
}))

console.log(`MQTT connecting to ${config.mqttServer}`)
const client = MQTT.connect(config.mqttServer)

client.on('connect', async () => {
  console.log('connected to mqtt server')
  await Promise.all(
    config.mqttTopics.map(topic => client.subscribe(topic))
  )
  console.log('subscribed to topics', config.mqttTopics)
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

  if (packet.retain) {
    // The retained value is an old one the MQTT broker still knows about
    data.setLastValue(position, type, undefined, value)
  } else {
    // Not retained -> new value
    data.logValue(position, type, time, value)
  }

  if (type === 'temp' && position === TEMP_SENSOR_OUTDOOR) {
    partNotify.notifyTempWhenNeeded(bot.telegram)
  }

  if (type === 'connected') {
    partNotify.notifyConnectedWhenNeeded(bot.telegram, position, value)
  }
})

if (config.telegramUserWhitelist.length > 0) {
  bot.use((ctx, next) => {
    const isWhitelisted = config.telegramUserWhitelist.indexOf(ctx.from.id) >= 0
    if (isWhitelisted) {
      return next()
    }

    let text = `Hey ${ctx.from.first_name}!`
    text += '\n'
    text += 'Looks like you are not approved to use this bot.'

    text += '\n\n'
    text += 'Forward this message to the owner of the bot if you think you should be approved.'
    text += '\n'
    text += 'Your Telegram user id: '
    text += '`'
    text += ctx.from.id
    text += '`'

    ctx.replyWithMarkdown(text)
  })
}

bot.use(partConnected.bot)
bot.use(partGraph.bot)
bot.use(partNotify.bot)
bot.use(partStatus.bot)

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
