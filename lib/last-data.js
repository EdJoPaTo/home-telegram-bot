const arrayFilterUnique = require('array-filter-unique')

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

function getPositions(filter = () => true) {
  const positions = Object.keys(last)
  const filteredPositions = positions
    .filter(o => filter(last[o]))
    .sort()

  return filteredPositions
}

function getAllTypes() {
  const positions = Object.keys(last)
  const types = positions
    .flatMap(o => Object.keys(last[o]))
    .filter(arrayFilterUnique())
    .sort()

  return types
}

function getAllTypesOfPosition(position) {
  return Object.keys(last[position])
}

module.exports = {
  getSensorValue,
  getAllSensorValues,
  setSensorValue,
  getPositions,
  getAllTypes,
  getAllTypesOfPosition
}
