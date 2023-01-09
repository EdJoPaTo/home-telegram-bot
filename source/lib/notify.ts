import {html as format} from 'telegram-format';
import debounce from 'debounce-promise';
import stringify from 'json-stable-stringify';
import type {Api as Telegram} from 'grammy';
import {CHANGE_TYPES, getByCompareTo, getByTopic} from './notify-rules.js';
import {isFalling, isRising, isUnequal} from './notify-math.js';
import * as history from './mqtt-history.js';
import type {Change, Rule} from './notify-rules.js';

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

export function check(topic: string, value: number) {
	const last = history.getLastValue(topic);
	if (!last) {
		// There is nothing to compare yet
		return;
	}

	const rulesByTopic = getByTopic(topic);
	for (const rule of rulesByTopic) {
		checkRuleTopic(rule, value, last.value);
	}

	const rulesByCompareTo = getByCompareTo(topic);
	for (const rule of rulesByCompareTo) {
		checkRuleCompareTo(rule, value, last.value);
	}
}

function checkRuleTopic(rule: Rule, currentValue: number, lastValue: number) {
	const compareTo = rule.compare === 'value'
		? rule.compareTo
		: history.getLastValue(rule.compareTo)?.value;

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

function checkRuleCompareTo(
	rule: Rule,
	currentValue: number,
	lastValue: number,
) {
	const topicLastValue = history.getLastValue(rule.topic)?.value;
	if (topicLastValue === undefined) {
		return;
	}

	for (const change of rule.change) {
		const checkFunction = getChangeCheckFunction(change);
		const isLast = checkFunction(topicLastValue, lastValue);
		const isNow = checkFunction(topicLastValue, currentValue);
		if (isLast !== isNow) {
			// eslint-disable-next-line @typescript-eslint/no-floating-promises
			initiateNotification(rule, change, topicLastValue, currentValue);
		}
	}
}

type Arguments = {
	readonly currentValue: number;
	readonly compareTo: number;
};

type ArgumentArrayArray = ReadonlyArray<readonly Arguments[]>;
const debouncers: Record<string, (a: Arguments) => Promise<unknown[]>> = {};
async function initiateNotification(
	rule: Rule,
	change: Change,
	currentValue: number,
	compareTo: number,
) {
	const identifier = `${stringify(rule)}${change}`;
	if (!debouncers[identifier]) {
		debouncers[identifier] = debounce(
			async (argsArray: ArgumentArrayArray) => {
				await initiateNotificationDebounced(rule, change, argsArray);

				// Fix required. See https://github.com/bjoerge/debounce-promise/pull/19
				return argsArray.map(() => null);
			},
			rule.stableSeconds * 1000,
			{accumulate: true},
		);
	}

	return debouncers[identifier]!({
		currentValue,
		compareTo,
	});
}

async function initiateNotificationDebounced(
	rule: Rule,
	change: Change,
	argsArray: ArgumentArrayArray,
) {
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

	if (rule.compare === 'topic') {
		text += format.monospace(rule.compareTo);
		text += ' ';
		text += CHANGE_TYPES[change];
		text += ' ';
	}

	text += format.monospace(rule.topic);
	text += '\n';
	text += String(compareTo);
	text += ' ';
	text += CHANGE_TYPES[change];
	text += ' ';
	text += String(currentValue);

	await telegram.sendMessage(rule.chat, text, {
		parse_mode: format.parse_mode,
		reply_markup: {remove_keyboard: true},
	});
}
