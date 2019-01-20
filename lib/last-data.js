const TEMP_SENSOR_OUTDOOR = process.env.npm_package_config_temp_sensor_outdoor

const last = {}

function getSensorValue(position, type) {
  return last[position] && last[position][type]
}

function getAllSensorValues(position) {
  return last[position]
}

function setSensorValue(position, type, time, value) {
  if (!last[position]) {
    last[position] = {}
  }

  last[position][type] = {
    time,
    value
  }
}

function getPositions() {
  const positionsUnsorted = Object.keys(last)
  const positions = positionsUnsorted.filter(o => o !== TEMP_SENSOR_OUTDOOR)
  positions.sort()

  // Outdoor sensor at the beginning
  if (positionsUnsorted.indexOf(TEMP_SENSOR_OUTDOOR) >= 0) {
    positions.unshift(TEMP_SENSOR_OUTDOOR)
  }

  return positions
}

function getAllTypesOfPosition(position) {
  return Object.keys(last[position])
}

module.exports = {
  getSensorValue,
  getAllSensorValues,
  setSensorValue,
  getPositions,
  getAllTypesOfPosition
}
