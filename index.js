const MQTT = require('async-mqtt')
const Telegraf = require('telegraf')
const LocalSession = require('telegraf-session-local')

const data = require('./lib/data.js')
const notify = require('./lib/notify')
const {loadConfig} = require('./lib/config')

const partConnected = require('./parts/connected')
const partGraph = require('./parts/graph.js')
const partNotify = require('./parts/notify.js')
const partStatus = require('./parts/status.js')

const config = loadConfig()

const bot = new Telegraf(config.telegramBotToken)
bot.use(new LocalSession({
  getSessionKey: ctx => ctx.from.id,
  database: './persistent/sessions.json'
}))

notify.init(bot.telegram)

const mqttRetain = process.env.NODE_ENV === 'production'
const mqttOptions = {
  will: {
    topic: `${config.name}/connected`,
    payload: '0',
    retain: mqttRetain
  }
}
console.log('MQTT connecting to', config.mqttServer, mqttOptions)
const client = MQTT.connect(config.mqttServer, mqttOptions)

client.on('connect', async () => {
  console.log('connected to mqtt server')
  await client.publish(`${config.name}/connected`, '2', {retain: mqttRetain})
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

  if (packet.retain && topic === `${config.name}/connected`) {
    // Thats my own, old/retained connectionStatus. Ignore it.
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
    notify.check(position, type, value)
    // Not retained -> new value
    data.logValue(position, type, time, value)
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
