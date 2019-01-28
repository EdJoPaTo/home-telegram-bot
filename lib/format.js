const information = {
  bri: {
    label: 'Brightness',
    unit: '%'
  },
  connected: {
    label: 'Connected'
  },
  hue: {
    label: 'Hue',
    unit: '°'
  },
  hum: {
    label: 'Humidity',
    unit: '%'
  },
  lux: {
    label: 'Lux',
    unit: ' lux'
  },
  on: {
    label: 'On (enabled)'
  },
  rssi: {
    label: 'RSSI',
    unit: ' dBm'
  },
  sat: {
    label: 'Saturation',
    unit: '%'
  },
  temp: {
    label: 'Temperature',
    unit: '°C'
  }
}

function enabledEmoji(truthy) {
  // ✅ ❎ ✔️ ❌
  return truthy ? '✅' : '❌'
}

function timespan(totalMs) {
  const ms = pad(totalMs % 1000, 3)
  const s = pad(Math.floor(totalMs / 1000) % 60, 2)
  const m = pad(Math.floor(totalMs / 1000 / 60) % 60, 2)
  const h = Math.floor(totalMs / 1000 / 60 / 60)

  return `${h}:${m}:${s}.${ms}`
}

function pad(num, size) {
  let s = String(num)
  while (s.length < size) {
    s = '0' + s
  }

  return s
}

const connectionStatusParts = {
  '-1': {
    emoji: '❓',
    text: 'unknown'
  },
  0: {
    emoji: '‼️',
    text: 'offline'
  },
  1: {
    emoji: '⚠️',
    text: 'sensor faulty'
  },
  2: {
    emoji: '✅',
    text: 'connected'
  }
}

function connectionStatusEmoji(connected) {
  if (!connected && connected !== 0) {
    connected = -1
  }

  return connectionStatusParts[connected].emoji
}

function typeValue(type, value) {
  let text = value
  text += information[type] ? (information[type].unit || '') : ` (${type})`
  return text
}

module.exports = {
  information,
  enabledEmoji,
  timespan,
  connectionStatusParts,
  connectionStatusEmoji,
  typeValue
}
