function isRising(last, now, compareTo) {
  return last <= compareTo && now > compareTo
}

function isFalling(last, now, compareTo) {
  return last >= compareTo && now < compareTo
}

function equalityChanged(last, now, compareTo) {
  const lastUnequal = last !== compareTo
  const nowUnequal = now !== compareTo

  return lastUnequal !== nowUnequal
}

module.exports = {
  isRising,
  isFalling,
  equalityChanged
}
