const AGE_HINT = 90 * 1000 // 90 s
const AGE_WARNING = 6 * 60 * 1000 // 6 min
const AGE_HIDE = 3 * 60 * 60 * 1000 // 3h

const information = {
  temp: {
    label: 'Temperature',
    unit: '°C'
  },
  hum: {
    label: 'Humidity',
    unit: '%'
  },
  rssi: {
    label: 'RSSI',
    unit: ' dBm'
  }
}


function basedOnAge(oldDate, currentDate, value) {
  const msAgo = currentDate - oldDate

  if (msAgo > AGE_WARNING) {
    return '⚠️ _' + value + '_'
  } else if (msAgo > AGE_HINT) {
    return '_' + value + '_'
  } else {
    return value
  }
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
  AGE_HINT: AGE_HINT,
  AGE_WARNING: AGE_WARNING,
  AGE_HIDE: AGE_HIDE,
  information: information,
  basedOnAge: basedOnAge,
  timespan: timespan,
  typeValue: typeValue
}
