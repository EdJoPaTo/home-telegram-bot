const fsPromises = require('fs').promises

const DATA_LOG_DIR = './data/'

async function logValue(position, type, time, value) {
  const unixTime = Math.round(time / 1000)

  const dir = DATA_LOG_DIR + position
  await fsPromises.mkdir(DATA_LOG_DIR + position, {recursive: true})
  const filename = `${dir}/${type}.log`
  const content = `${unixTime},${value}\n`
  await fsPromises.appendFile(filename, content, 'utf8')
}

module.exports = {
  logValue
}
