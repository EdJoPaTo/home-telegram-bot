function isRising(now, compareTo) {
  return now > compareTo
}

function isFalling(now, compareTo) {
  return now < compareTo
}

function isUnequal(now, compareTo) {
  return now !== compareTo
}

module.exports = {
  isRising,
  isFalling,
  isUnequal
}
