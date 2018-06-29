const fs = require('fs')
const Telegraf = require('telegraf')

const lastData = require('../lib/lastData.js')

const { Extra } = Telegraf

const MILLISECONDS_NEEDED_CONSTANT_FOR_CHANGE = 1000 * 60 // one Minute constantly on right temp in order to notify
const TEMP_SENSOR_INDOOR = process.env.npm_package_config_temp_sensor_indoor
const TEMP_SENSOR_OUTDOOR = process.env.npm_package_config_temp_sensor_outdoor

let chats = JSON.parse(fs.readFileSync('chats.json', 'utf8'))
let nextNotifyIsCloseWindows = true // assume windows are open -> its more important after a restart to close windows than open them
let attemptToChange = Date.now()

const bot = new Telegraf.Composer()

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

async function notifyWhenNeeded(telegram) {
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
          telegram.sendMessage(chat, text, Extra.markdown())
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
          telegram.sendMessage(chat, text, Extra.markdown())
        })
      }
    } else {
      attemptToChange = Date.now()
    }
  }
}

module.exports = {
  bot: bot,
  notifyWhenNeeded: notifyWhenNeeded
}
