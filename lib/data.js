const {readFile, mkdir, appendFile} = require('fs/promises')
const {existsSync} = require('fs')

const arrayFilterUnique = require('array-filter-unique')
const d3 = require('d3')

const SECONDS_PER_DAY = 60 * 60 * 24

if (existsSync('data/')) {
  if (existsSync('history/')) {
    console.warn('WARNING: data/ dir still existing. Consider removing it\n')
  } else {
    throw new Error('data/ not migrated to history/! Use `npm run migrate-to-v2`!')
  }
}

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

function filenameOf(position, type, time) {
  const date = new Date(time)
  const dir = `history/${position}/${type}/${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`
  const filename = `${dir}/${date.getUTCDate()}.log`

  return {
    dir,
    filename
  }
}

async function logValue(position, type, time, value) {
  setLastValue(position, type, time, value)
  const unixTime = Math.round(time / 1000)

  const {filename, dir} = filenameOf(position, type, time)
  await mkdir(dir, {recursive: true})

  const content = `${unixTime},${value}\n`
  await appendFile(filename, content, 'utf8')
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
  const contentPromises = []
  const minTimestampDay = Math.floor(minTimestamp / SECONDS_PER_DAY) * SECONDS_PER_DAY
  for (let cur = minTimestampDay * 1000; cur <= Date.now(); cur += 1000 * SECONDS_PER_DAY) {
    const {filename} = filenameOf(position, type, cur)
    contentPromises.push(
      readFile(filename, 'utf8')
        .catch(() => {})
    )
  }

  const contents = await Promise.all(contentPromises)
  const entries = contents
    .filter(o => o)
    .flatMap(o => parseCsv(o))
    .filter(o => o.timestamp >= minTimestamp)
    .sort((a, b) => a.timestamp - b.timestamp)

  return entries
}

function parseCsv(content) {
  const entries = d3.csvParseRows(content, (o, i) => {
    const [timestamp, value] = o
    if (!isFinite(timestamp) || !isFinite(value)) {
      console.log('will ignore line', i, o)
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
