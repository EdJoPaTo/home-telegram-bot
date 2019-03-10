const fsPromises = require('fs').promises

const arrayFilterUnique = require('array-filter-unique')
const d3 = require('d3')

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

function filenameOf(position, type) {
  const dir = `data/${position}`
  const filename = `${dir}/${type}.log`

  return {
    dir,
    filename
  }
}

async function logValue(position, type, time, value) {
  setLastValue(position, type, time, value)
  const unixTime = Math.round(time / 1000)

  const {filename, dir} = filenameOf(position, type)
  await fsPromises.mkdir(dir, {recursive: true})

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
  const {filename} = filenameOf(position, type)
  const content = await fsPromises.readFile(filename, 'utf8')
  const entries = parseCsv(content, filename)

  const filteredEntries = entries
    .filter(o => o.timestamp >= minTimestamp)

  return filteredEntries
}

function parseCsv(content, identifier) {
  const entries = d3.csvParseRows(content, (o, i) => {
    const [timestamp, value] = o
    if (!isFinite(timestamp) || !isFinite(value)) {
      console.log(identifier, 'will ignore line', i, o)
    }

    return {
      timestamp: Number(timestamp),
      value: Number(value)
    }
  })
    .filter(({timestamp, value}) => !isNaN(timestamp) && !isNaN(value))

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
