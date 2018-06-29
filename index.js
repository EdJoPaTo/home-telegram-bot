const fs = require('fs')
const MQTT = require('async-mqtt')
const Telegraf = require('telegraf')
const util = require('util')

const appendFile = util.promisify(fs.appendFile)

const { Extra } = Telegraf

const lastData = require('./lib/lastData.js')

const partGraph = require('./parts/graph.js')
const partStatus = require('./parts/status.js')

const TEMP_SENSOR_INDOOR = process.env.npm_package_config_temp_sensor_indoor
const TEMP_SENSOR_OUTDOOR = process.env.npm_package_config_temp_sensor_outdoor

const DATA_LOG_DIR = './data/'

if (!fs.existsSync(DATA_LOG_DIR)) {
  fs.mkdirSync(DATA_LOG_DIR)
}

let chats = JSON.parse(fs.readFileSync('chats.json', 'utf8'))

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

  lastData.setSensorValue(position, type, newVal)

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
let attemptToChange = Date.now()
const MILLISECONDS_NEEDED_CONSTANT_FOR_CHANGE = 1000 * 60 // one Minute constantly on right temp in order to notify

async function notifyWhenNeeded() {
  const outdoor = lastData.getSensorValue(TEMP_SENSOR_OUTDOOR, 'temp')
  const indoor = lastData.getSensorValue(TEMP_SENSOR_INDOOR, 'temp')

  if (!outdoor || !indoor) {
    console.log('notifyWhenNeeded is still waiting for init')
    return
  }

  const diff = outdoor.value - indoor.value
  // console.log('notifyWhenNeeded diff', outdoor.value, indoor.value, Math.round(diff * 10) / 10, nextNotifyIsCloseWindows ? 'next close' : 'next open', Date.now() - attemptToChange, '>', MILLISECONDS_NEEDED_CONSTANT_FOR_CHANGE)

  if (!nextNotifyIsCloseWindows) {
    // next open
    if (diff < -2) {
      if (attemptToChange + MILLISECONDS_NEEDED_CONSTANT_FOR_CHANGE <= Date.now()) {
        nextNotifyIsCloseWindows = true
        attemptToChange = Date.now()
        const text = `Es ist draußen *kälter* als drinnen. Man könnte die Fenster aufmachen.\n\nBenutzte /status oder /graph für weitere Infos.`

        await chats.map(chat => {
          bot.telegram.sendMessage(chat, text, Extra.markdown())
        })
      }
    } else {
      attemptToChange = Date.now()
    }
  } else {
    // next close
    if (diff > -1) {
      if (attemptToChange + MILLISECONDS_NEEDED_CONSTANT_FOR_CHANGE <= Date.now()) {
        nextNotifyIsCloseWindows = false
        attemptToChange = Date.now()
        const text = `Es wird draußen *wärmer* als drinnen. Sind alle Fenster zu?\n\nBenutzte /status oder /graph für weitere Infos.`

        await chats.map(chat => {
          bot.telegram.sendMessage(chat, text, Extra.markdown())
        })
      }
    } else {
      attemptToChange = Date.now()
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

bot.use(partGraph)
bot.use(partStatus)

bot.catch(err => {
  if (err.description === 'Bad Request: message is not modified') return
  console.error(err)
})

bot.startPolling()
