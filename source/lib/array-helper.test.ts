import {deepStrictEqual} from 'node:assert';
import {test} from 'node:test';
import {setKeyInArray, toggleKeyInArray} from './array-helper.js';

await test('setKeyInArray true', () => {
	const result = setKeyInArray(['a', 'b'], 'c', true);
	deepStrictEqual(result, ['a', 'b', 'c']);
});

await test('setKeyInArray false without key in arr', () => {
	const result = setKeyInArray(['a', 'b'], 'c', false);
	deepStrictEqual(result, ['a', 'b']);
});

await test('setKeyInArray false existing', () => {
	const result = setKeyInArray(['a', 'b'], 'b', false);
	deepStrictEqual(result, ['a']);
});

await test('toggleKeyInArray toggle in', () => {
	const result = toggleKeyInArray(['a', 'b'], 'c');
	deepStrictEqual(result, ['a', 'b', 'c']);
});

await test('toggleKeyInArray toggle out', () => {
	const result = toggleKeyInArray(['a', 'b', 'c'], 'c');
	deepStrictEqual(result, ['a', 'b']);
});
