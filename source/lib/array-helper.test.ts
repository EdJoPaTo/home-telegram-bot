import test from 'ava';
import {setKeyInArray, toggleKeyInArray} from './array-helper.js';

test('setKeyInArray true', t => {
	const result = setKeyInArray(['a', 'b'], 'c', true);
	t.deepEqual(result, ['a', 'b', 'c']);
});

test('setKeyInArray false without key in arr', t => {
	const result = setKeyInArray(['a', 'b'], 'c', false);
	t.deepEqual(result, ['a', 'b']);
});

test('setKeyInArray false existing', t => {
	const result = setKeyInArray(['a', 'b'], 'b', false);
	t.deepEqual(result, ['a']);
});

test('toggleKeyInArray toggle in', t => {
	const result = toggleKeyInArray(['a', 'b'], 'c');
	t.deepEqual(result, ['a', 'b', 'c']);
});

test('toggleKeyInArray toggle out', t => {
	const result = toggleKeyInArray(['a', 'b', 'c'], 'c');
	t.deepEqual(result, ['a', 'b']);
});
