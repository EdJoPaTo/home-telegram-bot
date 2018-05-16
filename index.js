const fs = require('fs')
const MQTT = require('async-mqtt')
const Telegraf = require('telegraf')

const { Extra } = Telegraf

const TEMP_SENSOR_INDOOR = 'bed'
const TEMP_SENSOR_OUTDOOR = 'bude'

let chats = JSON.parse(fs.readFileSync('chats.json', 'utf8'))
const last = {}
let statusUpdatesNeeded = []

const token = fs.readFileSync(process.env.npm_package_config_tokenpath, 'utf8').trim()
const bot = new Telegraf(token)

const client = MQTT.connect('tcp://etoPiServer:1883')

client.on('connect', async () => {
  console.log('connected to mqtt server')
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

  if (type === 'temp' && position === TEMP_SENSOR_OUTDOOR) {
    notifyWhenNeeded()
  }
  doStatusUpdates()
})

let nextNotifyIsCloseWindows = true // assume windows are open -> its more important after a restart to close windows than open them
let attemptToChange = 0
const ATTEMPTS_NEEDED_TO_CHANGE = 3

async function notifyWhenNeeded() {
  if (!last[TEMP_SENSOR_OUTDOOR] || !last[TEMP_SENSOR_OUTDOOR].temp || !last[TEMP_SENSOR_INDOOR] || !last[TEMP_SENSOR_INDOOR].temp) {
    console.log('notifyWhenNeeded is still waiting for init')
    return
  }

  const outdoor = last[TEMP_SENSOR_OUTDOOR].temp.value
  const indoor = last[TEMP_SENSOR_INDOOR].temp.value
  const diff = outdoor - indoor
  // console.log('notifyWhenNeeded diff', outdoor, indoor, Math.round(diff * 10) / 10, nextNotifyIsCloseWindows ? 'next close' : 'next open', attemptToChange)

  if (!nextNotifyIsCloseWindows) {
    // next open
    if (diff < -2) {
      attemptToChange++

      if (attemptToChange >= ATTEMPTS_NEEDED_TO_CHANGE) {
        nextNotifyIsCloseWindows = true
        attemptToChange = 0
        const text = `Es ist draußen *kälter* als drinnen. Man könnte die Fenster aufmachen.\n\n${generateStatusText()}`

        await chats.map(chat => {
          bot.telegram.sendMessage(chat, text, Extra.markdown())
        })
      }
    } else {
      attemptToChange = 0
    }
  } else {
    // next close
    if (diff > -1) {
      attemptToChange++

      if (attemptToChange >= ATTEMPTS_NEEDED_TO_CHANGE) {
        nextNotifyIsCloseWindows = false
        attemptToChange = 0
        const text = `Es wird draußen *wärmer* als drinnen. Sind alle Fenster zu?\n\n${generateStatusText()}`

        await chats.map(chat => {
          bot.telegram.sendMessage(chat, text, Extra.markdown())
        })
      }
    } else {
      attemptToChange = 0
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

bot.command('status', async ctx => {
  const msgSend = await ctx.reply(generateStatusText(), Extra.markdown())

  statusUpdatesNeeded.push({
    chat: msgSend.chat.id,
    date: msgSend.date * 1000,
    lastUpdate: msgSend.date * 1000,
    message_id: msgSend.message_id
  })
})

function generateStatusText() {
  // console.log(last)

  const positions = Object.keys(last)
  const lines = positions.map(position => {
    const types = Object.keys(last[position])

    const timestamps = types.map(type => last[position][type].time)
    const age = timestamps.map(t => formatAge(t, Date.now())).join('/')

    return `*${position}* ` + types.map(type =>
      formatTypeValue(type, last[position][type].value)
    ).join(', ') + ` _${age} seconds ago_`
  })

  return lines.join('\n')
}

function formatAge(oldDate, currentDate) {
  const msAgo = currentDate - oldDate

  if (msAgo > 5 * 60 * 1000) { // older than 5 minutes (sensors should at least update every minute)
    return '†'
    // return '✝' // Emoji variant
  }

  return Math.round(msAgo / 100) / 10
}

function formatTypeValue(type, value) {
  if (type === 'temp') {
    return `${value} °C`
  } else if (type === 'hum') {
    return `${value}%`
  } else {
    return `${value} (${type})`
  }
}

function doStatusUpdates() {
  const newStatus = generateStatusText()

  statusUpdatesNeeded.forEach(task => {
    const lastUpdateAgo = (Date.now() - task.lastUpdate) / 1000
    // const dateAgo = (Date.now() - task.date) / 1000
    // console.log('doStatusUpdates', task, Math.round(dateAgo), 'seconds ago', lastUpdateAgo, 'seconds ago')

    if (lastUpdateAgo > 1) { // only update less often than all 1 seconds
      bot.telegram.editMessageText(task.chat, task.message_id, undefined, newStatus, Extra.markdown())
      task.lastUpdate = Date.now()
    }
  })

  statusUpdatesNeeded = statusUpdatesNeeded.filter(o => Date.now() - o.date < 20 * 1000) // update message for 20 seconds
}

bot.catch(err => {
  if (err.description === 'Bad Request: message is not modified') return
  console.error(err)
})

bot.startPolling()
