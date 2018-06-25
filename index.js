const fs = require('fs')
const MQTT = require('async-mqtt')
const Telegraf = require('telegraf')
const util = require('util')

const appendFile = util.promisify(fs.appendFile)
const exec = util.promisify(require('child_process').exec)

const { Extra } = Telegraf

const TEMP_SENSOR_INDOOR = process.env.npm_package_config_temp_sensor_indoor
const TEMP_SENSOR_OUTDOOR = process.env.npm_package_config_temp_sensor_outdoor

const DATA_AGE_HINT = 10 * 1000 // 10 s
const DATA_AGE_WARNING = 2 * 60 * 1000 // 2 min
const DATA_AGE_HIDE = 3 * 60 * 60 * 1000 // 3h
const DATA_LOG_DIR = './data/'
const DATA_PLOT_DIR = './tmp/'

const folders = [DATA_LOG_DIR, DATA_PLOT_DIR]
for (const folder of folders) {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder)
  }
}

let chats = JSON.parse(fs.readFileSync('chats.json', 'utf8'))
const last = {}

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
  const time = Date.now()
  const msgStr = message.toString()
  // console.log('incoming message', topic, msgStr)
  const position = topic.split('/')[3]
  const type = topic.split('/')[4]
  const value = Number(msgStr)

  logNewValue(position, type, time, value)

  const newVal = {
    time: time,
    value: value
  }

  if (!last[position]) {
    last[position] = {}
  }

  last[position][type] = newVal

  if (type === 'temp' && position === TEMP_SENSOR_OUTDOOR) {
    notifyWhenNeeded()
  }
})

async function logNewValue(position, type, time, value) {
  const unixTime = Math.round(time / 1000)

  const filename = DATA_LOG_DIR + `${position}-${type}.log`
  const content = `${unixTime},${value}\n`
  await appendFile(filename, content, 'utf8')
}

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

  setInterval(doStatusUpdates, 5000, msgSend.chat.id, msgSend.message_id, msgSend.date * 1000)
})

function doStatusUpdates(chatID, messageID, initialMessageDate) {
  const secondsSinceInitialMessage = Math.round((Date.now() - initialMessageDate) / 1000)
  if (secondsSinceInitialMessage > 30) { // stop updating after 30 seconds
    clearInterval(this)
    return
  }

  const newStatus = generateStatusText()
  bot.telegram.editMessageText(chatID, messageID, undefined, newStatus, Extra.markdown())
}

function getSortedPositions() {
  const positionsUnsorted = Object.keys(last)
  const positions = positionsUnsorted.filter(o => o !== TEMP_SENSOR_OUTDOOR && o !== TEMP_SENSOR_INDOOR)
  positions.sort()
  if (positionsUnsorted.indexOf(TEMP_SENSOR_INDOOR) >= 0) {
    positions.unshift(TEMP_SENSOR_INDOOR)
  }
  if (positionsUnsorted.indexOf(TEMP_SENSOR_OUTDOOR) >= 0) {
    positions.unshift(TEMP_SENSOR_OUTDOOR)
  }
  return positions
}

function generateStatusText() {
  // console.log(last)

  const positions = getSortedPositions()

  const lines = positions.map(position => {
    const types = Object.keys(last[position])

    const timestamps = types.map(type => last[position][type].time)
    const minTimestamp = Date.now() - Math.min(...timestamps)
    const maxTimestamp = Date.now() - Math.max(...timestamps)

    if (minTimestamp > DATA_AGE_HIDE) {
      return '' // will be filtered out
    }

    let parts = ''

    if (maxTimestamp < DATA_AGE_HINT) {
      parts += `*${position}*`
    } else {
      parts += `${position}`
    }
    parts += ' '
    parts += types.map(type =>
      formatBasedOnAge(last[position][type].time, Date.now(),
        formatTypeValue(type, last[position][type].value)
      )
    ).join(', ')

    return parts
  })
    .filter(o => o !== '')

  return lines.join('\n')
}

function formatBasedOnAge(oldDate, currentDate, value) {
  const msAgo = currentDate - oldDate

  if (msAgo > DATA_AGE_WARNING) {
    return '⚠️ _' + value + '_'
  } else if (msAgo > DATA_AGE_HINT) {
    return '_' + value + '_'
  } else {
    return value
  }
}

function formatTypeValue(type, value) {
  if (type === 'temp') {
    return `${value} °C`
  } else if (type === 'hum') {
    return `${value}%`
  } else if (type === 'rssi') {
    return `${value} dBm`
  } else {
    return `${value} (${type})`
  }
}

bot.command('graph', async ctx => {
  await ctx.replyWithChatAction('upload_photo')

  const positions = getSortedPositions()
  const positionsString = positions.join(' ')

  const gnuplotPrefix = `gnuplot -e "files='${positionsString}'"`
  const types = ['temp', 'hum', 'rssi']

  await Promise.all(types.map(o => exec(`${gnuplotPrefix} ${o}.gnuplot`)))

  const mediaArr = types.map(o => ({caption: 'test', media: { source: `${DATA_PLOT_DIR}${o}.png` }, type: 'photo'}))

  // return ctx.replyWithPhoto({source: `${DATA_PLOT_DIR}temp.png`})
  return ctx.replyWithMediaGroup(mediaArr)
})

bot.catch(err => {
  if (err.description === 'Bad Request: message is not modified') return
  console.error(err)
})

bot.startPolling()
