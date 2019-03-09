const fsPromises = require('fs').promises

const arrayFilterUnique = require('array-filter-unique')

const DATA_LOG_DIR = './data/'

const last = {}

function setLastValue(position, type, time, value) {
  if (!last[position]) {
    last[position] = {}
  }

  last[position][type] = {
    time,
    value
  }
}

async function logValue(position, type, time, value) {
  setLastValue(position, type, time, value)
  const unixTime = Math.round(time / 1000)

  const dir = DATA_LOG_DIR + position
  await fsPromises.mkdir(dir, {recursive: true})
  const filename = `${dir}/${type}.log`
  const content = `${unixTime},${value}\n`
  await fsPromises.appendFile(filename, content, 'utf8')
}

function getPositions(filter = () => true) {
  return Object.keys(last)
    .filter(o => filter(last[o]))
    .sort()
}

function getTypes() {
  const positions = Object.keys(last)
  const types = positions
    .flatMap(o => Object.keys(last[o]))
    .filter(arrayFilterUnique())
    .sort()

  return types
}

function getTypesOfPosition(position) {
  return Object.keys(last[position])
    .sort()
}

function getLastValue(position, type) {
  return last[position] && last[position][type]
}

async function loadLastValues(position, type, minTimestamp) {
  const dir = DATA_LOG_DIR + position
  const filename = `${dir}/${type}.log`
  const content = await fsPromises.readFile(filename, 'utf8')
  const entries = content.split('\n')
    .map((o, i) => {
      const [timestamp, value] = o.split(',')
      if (!isFinite(timestamp) || !isFinite(value)) {
        console.log(position, type, 'will ignore line', i, o)
      }

      return {
        timestamp: Number(timestamp),
        value: Number(value)
      }
    })
    .filter(({timestamp, value}) => !isNaN(timestamp) && !isNaN(value))
    .filter(o => o.timestamp >= minTimestamp)

  return entries
}

module.exports = {
  getLastValue,
  getPositions,
  getTypes,
  getTypesOfPosition,
  loadLastValues,
  logValue,
  setLastValue
}
