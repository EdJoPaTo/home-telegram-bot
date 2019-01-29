function setKeyInArray(arr, key, newState) {
  if (newState) {
    arr.push(key)
  } else {
    arr = arr.filter(o => o !== key)
  }

  return arr
}

function toggleKeyInArray(arr, key) {
  const currentState = arr.indexOf(key) >= 0
  const newState = !currentState
  return setKeyInArray(arr, key, newState)
}

module.exports = {
  setKeyInArray,
  toggleKeyInArray
}
