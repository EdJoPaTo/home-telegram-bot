function getWithoutCommonPrefix(topicArr) {
  if (topicArr.length <= 1) {
    return topicArr
  }

  const splitted = topicArr.map(o => o.split('/'))
  const first = splitted[0]
  const commonFields = splitted
    .slice(1)
    .map(fields => {
      let inCommon = 0
      while (fields[inCommon] === first[inCommon]) {
        inCommon++
      }

      return inCommon
    })
  const maxCommon = Math.min(...commonFields)

  const result = splitted
    .map(o => o.slice(maxCommon).join('/'))

  return result
}

module.exports = {
  getWithoutCommonPrefix
}
