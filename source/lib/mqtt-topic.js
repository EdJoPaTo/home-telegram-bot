function getCommonPrefix(topicArr) {
  if (topicArr.length <= 1) {
    return ''
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

  if (maxCommon === 0) {
    return ''
  }

  const commonPrefix = splitted[0]
    .slice(0, maxCommon)
    .join('/') + '/'

  return commonPrefix
}

function getWithoutCommonPrefix(topicArr) {
  const commonPrefix = getCommonPrefix(topicArr)
  return topicArr
    .map(o => o.slice(commonPrefix.length))
}

module.exports = {
  getCommonPrefix,
  getWithoutCommonPrefix
}
