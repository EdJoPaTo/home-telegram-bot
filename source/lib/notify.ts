import * as stringify from 'json-stable-stringify';
import * as debounce from 'debounce-promise';
import {Telegraf} from 'telegraf';

import * as data from './data';
import {Change, Position, Type, CHANGE_TYPES, Rule, getByPosition, getByCompareTo} from './notify-rules';
import {isRising, isFalling, isUnequal} from './notify-math';
import {typeValue} from './format';

type Telegram = Telegraf['telegram'];

let telegram: Telegram;

export function init(tg: Telegram): void {
	telegram = tg;
}

function getChangeCheckFunction(change: Change) {
	if (change === 'rising') {
		return isRising;
	}

	if (change === 'falling') {
		return isFalling;
	}

	if (change === 'unequal') {
		return isUnequal;
	}

	throw new TypeError('unknown change: ' + String(change));
}

export function check(position: Position, type: Type, value: number) {
	const last = data.getLastValue(position, type);
	if (!last) {
		// There is nothing to compare yet
		return;
	}

	const rulesByPosition = getByPosition(position, type);
	for (const rule of rulesByPosition) {
		checkRulePosition(rule, value, last.value);
	}

	const rulesByCompareTo = getByCompareTo(position, type);
	for (const rule of rulesByCompareTo) {
		checkRuleCompareTo(rule, value, last.value);
	}
}

function checkRulePosition(rule: Rule, currentValue: number, lastValue: number) {
	const compareTo = rule.compare === 'value' ?
		rule.compareTo :
		data.getLastValue(rule.compareTo, rule.type)?.value;

	if (compareTo === undefined) {
		return;
	}

	for (const change of rule.change) {
		const checkFunction = getChangeCheckFunction(change);
		const isLast = checkFunction(lastValue, compareTo);
		const isNow = checkFunction(currentValue, compareTo);
		if (isLast !== isNow) {
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			initiateNotification(rule, change, currentValue, compareTo);
		}
	}
}

function checkRuleCompareTo(rule: Rule, currentValue: number, lastValue: number) {
	const positionLastValue = data.getLastValue(rule.position, rule.type)?.value;
	if (positionLastValue === undefined) {
		return;
	}

	for (const change of rule.change) {
		const checkFunction = getChangeCheckFunction(change);
		const isLast = checkFunction(positionLastValue, lastValue);
		const isNow = checkFunction(positionLastValue, currentValue);
		if (isLast !== isNow) {
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			initiateNotification(rule, change, positionLastValue, currentValue);
		}
	}
}

interface Arguments {
	readonly currentValue: number;
	readonly compareTo: number;
}

const debouncers: Record<string, (a: Arguments) => Promise<void>> = {};
async function initiateNotification(rule: Rule, change: Change, currentValue: number, compareTo: number) {
	const identifier = stringify(rule) + change;
	if (!debouncers[identifier]) {
		debouncers[identifier] = debounce(
			async argsArray => {
				await initiateNotificationDebounced(rule, change, argsArray);

				// Fix required. See https://github.com/bjoerge/debounce-promise/pull/19
				return argsArray.map(() => null);
			},
			rule.stableSeconds * 1000,
			{accumulate: true}
		);
	}

	return debouncers[identifier]!({
		currentValue,
		compareTo
	});
}

async function initiateNotificationDebounced(rule: Rule, change: Change, argsArray: ReadonlyArray<readonly Arguments[]>) {
	// The argsArr contains arrays or arguments per call.
	// As only one argument is used (values) this array of arrays is annoying so simplify it with .flat().
	const values = argsArray.flat();
	const first = values[0]!;
	const last = values.slice(-1)[0]!;
	const {currentValue, compareTo} = last;

	const checkFunction = getChangeCheckFunction(change);
	const isFirst = checkFunction(first.currentValue, first.compareTo);
	const isNow = checkFunction(currentValue, compareTo);
	if (!isFirst || !isNow) {
		// Reason isNow: if its currently not the case, why send notify
		// Reason isFirst: if it did not start with a change its only a bump (below and up again)
		return;
	}

	let text = '';

	if (rule.compare === 'position') {
		text += rule.compareTo;
		text += ' ';
		text += CHANGE_TYPES[change];
		text += ' ';
	}

	text += `*${rule.position}*`;
	text += '\n';
	text += typeValue(rule.type, compareTo);
	text += ' ';
	text += CHANGE_TYPES[change];
	text += ' ';
	text += typeValue(rule.type, currentValue);

	await telegram.sendMessage(rule.chat, text, {parse_mode: 'Markdown'});
}
