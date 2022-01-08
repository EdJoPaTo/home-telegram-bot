import test from 'ava';

import {getCommonPrefix, getWithoutCommonPrefix} from './mqtt-topic';

const getCommonPrefixMacro = test.macro((t, input: readonly string[], expected: string) => {
	t.is(getCommonPrefix(input), expected);
});

test('getCommonPrefix empty array', getCommonPrefixMacro, [], '');
test('getCommonPrefix one entry has no common prefix', getCommonPrefixMacro, ['l/t/1'], '');
test('getCommonPrefix completly different', getCommonPrefixMacro, ['l/t/1', 'u/v/2'], '');
test('getCommonPrefix first level same', getCommonPrefixMacro, ['l/t/1', 'l/u/1'], 'l/');
test('getCommonPrefix first two level same', getCommonPrefixMacro, ['l/t/1', 'l/t/2'], 'l/t/');
test('getCommonPrefix first two level same 3 args', getCommonPrefixMacro, ['l/t/1', 'l/t/2', 'l/t/3'], 'l/t/');
test('getCommonPrefix first two entries are 2 same, third is only 1 level same', getCommonPrefixMacro, ['l/t/1', 'l/t/2', 'l/u/1'], 'l/');

const getWithoutCommonPrefixMacro = test.macro((t, input: readonly string[], expected: readonly string[]) => {
	const result = getWithoutCommonPrefix(input) as readonly string[];
	t.deepEqual(result, expected);
});

test('getWithoutCommonPrefix empty array', getWithoutCommonPrefixMacro, [], []);
test('getWithoutCommonPrefix one entry is not modified', getWithoutCommonPrefixMacro, ['l/t/1'], ['l/t/1']);
test('getWithoutCommonPrefix completly different', getWithoutCommonPrefixMacro, ['l/t/1', 'u/v/2'], ['l/t/1', 'u/v/2']);
test('getWithoutCommonPrefix first level same', getWithoutCommonPrefixMacro, ['l/t/1', 'l/u/1'], ['t/1', 'u/1']);
test('getWithoutCommonPrefix first two level same', getWithoutCommonPrefixMacro, ['l/t/1', 'l/t/2'], ['1', '2']);
test('getWithoutCommonPrefix first two level same 3 args', getWithoutCommonPrefixMacro, ['l/t/1', 'l/t/2', 'l/t/3'], ['1', '2', '3']);
test('getWithoutCommonPrefix first two entries are 2 same, third is only 1 level same', getWithoutCommonPrefixMacro, ['l/t/1', 'l/t/2', 'l/u/1'], ['t/1', 't/2', 'u/1']);
