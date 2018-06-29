const fs = require('fs')
const MQTT = require('async-mqtt')
const Telegraf = require('telegraf')
const util = require('util')

const appendFile = util.promisify(fs.appendFile)

const lastData = require('./lib/lastData.js')

const partGraph = require('./parts/graph.js')
const partNotify = require('./parts/notify.js')
const partStatus = require('./parts/status.js')

const TEMP_SENSOR_OUTDOOR = process.env.npm_package_config_temp_sensor_outdoor

const DATA_LOG_DIR = './data/'

if (!fs.existsSync(DATA_LOG_DIR)) {
  fs.mkdirSync(DATA_LOG_DIR)
}

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
    partNotify.notifyWhenNeeded(bot.telegram)
  }
})

async function logNewValue(position, type, time, value) {
  const unixTime = Math.round(time / 1000)

  const filename = DATA_LOG_DIR + `${position}-${type}.log`
  const content = `${unixTime},${value}\n`
  await appendFile(filename, content, 'utf8')
}

bot.use(partGraph)
bot.use(partNotify.bot)
bot.use(partStatus)

bot.catch(err => {
  if (err.description === 'Bad Request: message is not modified') return
  console.error(err)
})

bot.startPolling()
