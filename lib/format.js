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
  const defaultAge = information[type].defaultAge

  if (msAgo > AGE_WARNING * defaultAge) {
    return '⚠️ _' + value + '_'
  } else if (msAgo > AGE_HINT * defaultAge) {
    return '_' + value + '_'
  } else {
    return value
  }
}

function enabledEmoji(truthy) {
  return truthy ? '✅' : '❎'
}


function timespan(totalMs) {
  const ms = pad(totalMs % 1000, 3)
  const s = pad(Math.floor(totalMs / 1000) % 60, 2)
  const m = pad(Math.floor(totalMs / 1000 / 60) % 60, 2)
  const h = Math.floor(totalMs / 1000 / 60 / 60)

  return `${h}:${m}:${s}.${ms}`
}

function pad(num, size) {
  let s = num + ''
  while (s.length < size) {
    s = '0' + s
  }
  return s
}

function typeValue(type, value) {
  if (information[type]) {
    return `${value}${information[type].unit}`
  } else {
    return `${value} (${type})`
  }
}


module.exports = {
  information: information,
  basedOnAge: basedOnAge,
  enabledEmoji: enabledEmoji,
  timespan: timespan,
  typeValue: typeValue
}