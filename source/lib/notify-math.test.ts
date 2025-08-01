import {strictEqual} from 'node:assert';
import {test} from 'node:test';
import {isFalling, isRising, isUnequal} from './notify-math.ts';

await test('isRising', async t => {
	const macro = async (now: number, compareTo: number, expected: boolean) =>
		t.test(`${now} ${compareTo}`, () => {
			strictEqual(isRising(now, compareTo), expected);
		});
	await macro(1, 2, false);
	await macro(2, 2, false);
	await macro(3, 2, true);
});

await test('isFalling', async t => {
	const macro = async (now: number, compareTo: number, expected: boolean) =>
		t.test(`${now} ${compareTo}`, () => {
			strictEqual(isFalling(now, compareTo), expected);
		});
	await macro(3, 2, false);
	await macro(2, 2, false);
	await macro(1, 2, true);
});

await test('isUnequal', async t => {
	const macro = async (now: number, compareTo: number, expected: boolean) =>
		t.test(`${now} ${compareTo}`, () => {
			strictEqual(isUnequal(now, compareTo), expected);
		});
	await macro(2, 2, false);
	await macro(1, 2, true);
	await macro(2, 1, true);
});
