function isRising(last, now, compareTo) {
  return last <= compareTo && now > compareTo
}

function isFalling(last, now, compareTo) {
  return last >= compareTo && now < compareTo
}

module.exports = {
  isRising,
  isFalling
}
