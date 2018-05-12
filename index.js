const fs = require('fs')
const MQTT = require('async-mqtt')
const Telegraf = require('telegraf')

const { Extra } = Telegraf

let chats = []
const last = {}

const token = fs.readFileSync(process.env.npm_package_config_tokenpath, 'utf8').trim()
const bot = new Telegraf(token)

const client = MQTT.connect('tcp://etoPiServer:1883')

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

client.on('message', (topic, message) => {
  const msgStr = message.toString()
  // console.log('incoming message', topic, msgStr)
  const position = topic.split('/')[3]
  const type = topic.split('/')[4]
  const value = Number(msgStr)

  const newVal = {
    time: Date.now(),
    value: value
  }

  if (!last[position]) {
    last[position] = {}
  }

  last[position][type] = newVal

  if (type === 'temp') {
    notifyWhenNeeded()
  }
})

let lastNotifyWasOpen = false

async function notifyWhenNeeded() {
  if (!last.bude || !last.bude.temp || !last.bed || !last.bed.temp) {
    console.log('notifyWhenNeeded is still waiting for init')
    return
  }

  const outdoor = last.bude.temp.value
  const indoor = last.bed.temp.value
  const diff = outdoor - indoor
  // console.log('notifyWhenNeeded diff', outdoor, indoor, diff, lastNotifyWasOpen ? 'next close' : 'next open')

  if (lastNotifyWasOpen) {
    if (diff < -2) {
      lastNotifyWasOpen = false
      const text = `Es ist draußen (${outdoor} °C) *kälter* als drinnen (${indoor} °C). Man könnte die Fenster aufmachen.`

      await chats.map(chat => {
        bot.telegram.sendMessage(chat, text, Extra.markdown())
      })
    }
  } else {
    if (diff > -2) {
      lastNotifyWasOpen = true
      const text = `Es wird draußen (${outdoor} °C) *wärmer* als drinnen (${indoor} °C). Sind alle Fenster zu?`

      await chats.map(chat => {
        bot.telegram.sendMessage(chat, text, Extra.markdown())
      })
    }
  }
}

bot.command('start', ctx => {
  const id = ctx.chat.id
  try {
    chats = JSON.parse(fs.readFileSync('chats.json', 'utf8'))
  } catch (err) {}
  if (chats.indexOf(id) < 0) {
    chats.push(id)
    console.log('chats add', chats)
    fs.writeFileSync('chats.json', JSON.stringify(chats, null, 2), 'utf8')
  }
  return ctx.reply(`Hi ${ctx.from.first_name}!\n\nDu wirst von mir benachrichtigt, wenn es draußen wärmer wird als drinnen. Wenn du das nicht mehr willst, nutze /stop.`)
})

bot.command('stop', ctx => {
  try {
    chats = JSON.parse(fs.readFileSync('chats.json', 'utf8'))
  } catch (err) {}
  chats = chats.filter(i => i !== ctx.chat.id)
  console.log('chats remove', chats)
  fs.writeFileSync('chats.json', JSON.stringify(chats, null, 2), 'utf8')
  return ctx.reply('Du wirst nicht mehr benachrichtigt')
})

bot.command('status', ctx => {
  // console.log(last)

  const positions = Object.keys(last)
  const lines = positions.map(position => {
    const types = Object.keys(last[position])

    const timestamps = types.map(type => last[position][type].time)
    const lastInfo = Math.min.apply(null, timestamps)
    const millisecondsAgo = Date.now() - lastInfo
    const secondsAgo = Math.round(millisecondsAgo / 100) / 10

    return `*${position}* ` + types.map(type =>
      `${last[position][type].value} ${type === 'temp' ? '°C' : '%'}`
    ).join(', ') + ` _${secondsAgo} seconds ago_`
  })

  return ctx.reply(lines.join('\n'), Extra.markdown())
})

bot.catch(err => {
  if (err.description === 'Bad Request: message is not modified') return
  console.error(err)
})

bot.startPolling()
