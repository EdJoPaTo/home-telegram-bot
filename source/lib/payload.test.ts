import {strictEqual} from 'node:assert';
import {test} from 'node:test';
import {payloadToNumber} from './payload.ts';

await test('payloadToNumber', async t => {
	const macro = async (payload: string, expected: number | undefined) =>
		t.test(payload, () => {
			strictEqual(payloadToNumber(payload), expected);
		});
	await macro('off', 0);
});
