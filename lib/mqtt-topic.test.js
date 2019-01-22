const test = require('ava')

const {
  getWithoutCommonPrefix
} = require('./mqtt-topic')

function getWithoutCommonPrefixMacro(t, input, expected) {
  const result = getWithoutCommonPrefix(input)
  t.deepEqual(result, expected)
}

test('getWithoutCommonPrefix empty array', getWithoutCommonPrefixMacro, [], [])

test('getWithoutCommonPrefix one entry is not modified', getWithoutCommonPrefixMacro, ['l/t/1'], ['l/t/1'])

test('getWithoutCommonPrefix completly different', getWithoutCommonPrefixMacro, ['l/t/1', 'u/v/2'], ['l/t/1', 'u/v/2'])

test('getWithoutCommonPrefix first level same', getWithoutCommonPrefixMacro, ['l/t/1', 'l/u/1'], ['t/1', 'u/1'])

test('getWithoutCommonPrefix first two level same', getWithoutCommonPrefixMacro, ['l/t/1', 'l/t/2'], ['1', '2'])

test('getWithoutCommonPrefix first two level same 3 args', getWithoutCommonPrefixMacro, ['l/t/1', 'l/t/2', 'l/t/3'], ['1', '2', '3'])

test('getWithoutCommonPrefix first two entries are 2 same, third is only 1 level same', getWithoutCommonPrefixMacro, ['l/t/1', 'l/t/2', 'l/u/1'], ['t/1', 't/2', 'u/1'])