const fs = require('fs')
const MQTT = require('async-mqtt')
const Telegraf = require('telegraf')

const { Extra, Markup } = Telegraf

let chats = []
let temp = {}
let hum = {}

const token = fs.readFileSync(process.env.npm_package_config_tokenpath, 'utf8')
const bot = new Telegraf(token)

const client = MQTT.connect('tcp://etoPiServer:1883')

// WHen passing async functions as event listeners, make sure to have a try catch block
client.on('connect', async () => {
  console.log('start mqtt connection')
  try {
    await client.subscribe('+/status/temp/#')
  } catch (e) {
    // Do something about it!
    console.error(e)
    process.exit()
  }
})


bot.command('start', ctx => {
  const id = ctx.chat.id
  if (chats.indexOf(id) >= 0) {
    return ctx.reply('Du bist bereits aktiv')
  } else {
    chats.push(id)
    console.log('chats add', chats)
    return ctx.reply(`Hi ${ctx.from.first_name}!`)
  }
})

bot.command('stop', ctx => {
  chats = chats.filter(i => i !== ctx.chat.id)
  console.log('chats remove', chats)
  return ctx.reply('Du wirst nicht mehr benachrichtigt')
})

bot.command('status', ctx => {


  return ctx.reply('TODO', Extra.markdown())
})

client.on('message', (topic, message) => {
  const msgStr = message.toString()
  console.log('incoming message', topic, msgStr)
  return Promise.all(
    chats.map(chat => {
      bot.telegram.sendMessage(chat, `*${topic}*\n${msgStr}`, Extra.markdown())
    })
  )
})

bot.catch(err => {
  if (err.description === 'Bad Request: message is not modified') return
  console.error(err)
})

// bot.startPolling()
