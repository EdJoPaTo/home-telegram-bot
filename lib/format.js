const AGE_HINT = 1.5
const AGE_WARNING = 5.5

const information = {
  temp: {
    defaultAge: 1000 * 15,
    label: 'Temperature',
    unit: '°C'
  },
  hum: {
    defaultAge: 1000 * 60,
    label: 'Humidity',
    unit: '%'
  },
  rssi: {
    defaultAge: 1000 * 60 * 10,
    label: 'RSSI',
    unit: ' dBm'
  }
}

function basedOnAge(oldDate, currentDate, type, value) {
  const msAgo = currentDate - oldDate
  if (!information[type]) {
    return value
  }
  const {defaultAge} = information[type]

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

function connectionStatus(sensorValues, {withText = true, withTime = false, hideOk = false}) {
  let text = ''
  if (!sensorValues || !sensorValues.connected) {
    text += `❓`
    if (withText) {
      text += ` unknown`
    }
  } else if (sensorValues.connected.value === 2 && !hideOk) {
    text += `✅`
    if (withText) {
      text += ` connected`
    }
  } else if (sensorValues.connected.value === 1) {
    text += `⚠️`
    if (withText) {
      text += ` sensor faulty`
    }
  } else if (sensorValues.connected.value === 0) {
    text += `‼️`
    if (withText) {
      text += ` offline`
    }
  }
  if (sensorValues && sensorValues.connected && withTime) {
    const age = Date.now() - sensorValues.connected.time
    text += ` ` + timespan(age)
  }
  return text
}

function typeValue(type, value) {
  if (information[type]) {
    return `${value}${information[type].unit}`
  }
  return `${value} (${type})`
}

module.exports = {
  information,
  basedOnAge,
  enabledEmoji,
  timespan,
  connectionStatus,
  typeValue
}
