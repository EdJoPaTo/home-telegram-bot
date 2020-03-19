function setKeyInArray(arr, key, newState) {
  if (newState) {
    arr.push(key)
  } else {
    arr = arr.filter(o => o !== key)
  }

  return arr
}

function toggleKeyInArray(arr, key) {
  const currentState = arr.includes(key)
  const newState = !currentState
  return setKeyInArray(arr, key, newState)
}

module.exports = {
  setKeyInArray,
  toggleKeyInArray
}
