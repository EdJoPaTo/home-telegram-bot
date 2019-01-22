const AGE_HINT = 1.5
const AGE_WARNING = 5.5

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
    defaultAge: 1000 * 60 * 5,
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
    defaultAge: 1000 * 60 * 15,
    label: 'RSSI',
    unit: ' dBm'
  },
  sat: {
    label: 'Saturation',
    unit: '%'
  },
  temp: {
    defaultAge: 1000 * 60 * 2,
    label: 'Temperature',
    unit: '°C'
  }
}

function basedOnAge(oldDate, currentDate, type, value) {
  const msAgo = currentDate - oldDate
  if (!information[type]) {
    return value
  }

  const {defaultAge} = information[type]
  if (!defaultAge) {
    return value
  }

  if (msAgo > AGE_WARNING * defaultAge) {
    return '⚠️ _' + value + '_'
  }

  if (msAgo > AGE_HINT * defaultAge) {
    return '_' + value + '_'
  }

  return value
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

function connectionStatus(sensorValues, {withText = true, withTime = false, hideOk = false}) {
  let connected = sensorValues && sensorValues.connected && sensorValues.connected.value
  if (!connected && connected !== 0) {
    connected = -1
  }

  if (connected === 2 && hideOk) {
    return ''
  }

  let text = ''
  text += connectionStatusParts[connected].emoji
  if (withText) {
    text += ' ' + connectionStatusParts[connected].text
  }

  if (connected >= 0 && withTime) {
    const age = Date.now() - sensorValues.connected.time
    text += ' ' + timespan(age)
  }

  return text
}

function typeValue(type, value) {
  let text = value
  text += information[type] ? information[type].unit : ` (${type})`
  return text
}

module.exports = {
  information,
  basedOnAge,
  enabledEmoji,
  timespan,
  connectionStatusParts,
  connectionStatus,
  typeValue
}
