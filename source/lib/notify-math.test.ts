import test from 'ava';

import {isRising, isFalling, isUnequal} from './notify-math.js';

test('isRising', t => {
	t.false(isRising(1, 2));
	t.false(isRising(2, 2));
	t.true(isRising(3, 2));
});

test('isFalling', t => {
	t.false(isFalling(3, 2));
	t.false(isFalling(2, 2));
	t.true(isFalling(1, 2));
});

test('isUnequal', t => {
	t.false(isUnequal(2, 2));
	t.true(isUnequal(1, 2));
	t.true(isUnequal(2, 1));
});
