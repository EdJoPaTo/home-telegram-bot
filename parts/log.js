const fs = require('fs')
const util = require('util')

const appendFile = util.promisify(fs.appendFile)

const DATA_LOG_DIR = './data/'

if (!fs.existsSync(DATA_LOG_DIR)) {
  fs.mkdirSync(DATA_LOG_DIR)
}

async function logValue(position, type, time, value) {
  const unixTime = Math.round(time / 1000)

  const filename = DATA_LOG_DIR + `${position}-${type}.log`
  const content = `${unixTime},${value}\n`
  await appendFile(filename, content, 'utf8')
}

module.exports = {
  logValue: logValue
}
