import test from 'ava';
import {payloadToNumber} from './payload.js';

test('off', t => {
	t.is(payloadToNumber('off'), 0);
});
