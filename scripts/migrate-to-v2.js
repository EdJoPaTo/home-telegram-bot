const {mkdirSync, readdirSync, readFileSync, writeFileSync} = require('fs')

function newFilenameOf(position, type, time) {
  const date = new Date(time)
  const dir = `history/${position}/${type}/${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`
  const filename = `${dir}/${date.getUTCDate()}.log`

  return {
    dir,
    filename
  }
}

function getAllLogFilesSync(folder) {
  const content = readdirSync(folder)
  const folders = content.filter(o => !o.includes('.'))
  const files = content.filter(o => o.endsWith('.log'))

  return [
    ...folders.flatMap(o => getAllLogFilesSync(`${folder}/${o}`)),
    ...files.map(o => `${folder}/${o}`)
  ]
}

function getInfoFromFilepath(filepath) {
  const splitted = filepath.split('/')

  const position = splitted
    .slice(0, -1)
    .join('/')

  const filename = splitted.slice(-1)[0]
  const type = filename.slice(0, -4)

  return {
    position,
    type
  }
}

function getOldEntries() {
  const files = getAllLogFilesSync('data')

  const entries = files
    .map(o => o.slice(5))
    .map(o => getInfoFromFilepath(o))

  return entries
}

function migrateEntry({position, type}) {
  const oldContent = readFileSync(`data/${position}/${type}.log`, 'utf8').trim()
  const fileContents = oldContent.split('\n')
    .map((o, i) => {
      const [timestamp, value] = o
        .replace(/\u0000/gu, '')
        .split(',')

      if (!isFinite(timestamp) || !isFinite(value)) {
        console.log(position, type, 'will ignore line', i, o)
      }

      return {
        timestamp: Number(timestamp),
        value: Number(value)
      }
    })
    .sort((a, b) => a.timestamp - b.timestamp)
    .reduce((coll, add) => {
      const key = newFilenameOf(position, type, add.timestamp * 1000).filename
      if (!coll[key]) {
        coll[key] = []
      }

      coll[key].push(add)
      return coll
    }, {})

  for (const filename of Object.keys(fileContents)) {
    createFileContent(filename, fileContents[filename])
  }
}

function createFileContent(filename, contents) {
  const dir = filename.split('/').slice(0, -1).join('/')
  mkdirSync(dir, {recursive: true})
  const content = contents
    .map(o => `${o.timestamp},${o.value}`)
    .join('\n') + '\n'
  writeFileSync(filename, content, 'utf8')
}

function migrate() {
  for (const entry of getOldEntries()) {
    console.log('migrate', entry)
    migrateEntry(entry)
  }
}

migrate()
