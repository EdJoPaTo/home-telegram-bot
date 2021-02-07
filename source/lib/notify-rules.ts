import {readFileSync, writeFileSync} from 'fs';

import * as stringify from 'json-stable-stringify';

import {typeValue} from './format';

export type Change = 'unequal' | 'rising' | 'falling';

export type Position = string;
export type Type = string;

interface BaseRule {
	readonly position: Position;
	readonly type: Type;
	readonly change: readonly Change[];
	readonly chat: number;
	readonly stableSeconds: number;
}

interface PositionRule extends BaseRule {
	readonly compare: 'position';
	readonly compareTo: string;
}

interface ValueRule extends BaseRule {
	readonly compare: 'value';
	readonly compareTo: number;
}

export type Rule = ValueRule | PositionRule;

const RULE_FILE = 'persistent/rules.json';
const rules = loadRules();

export const DEFAULT_RULE: Partial<Rule> = {
	compare: 'value',
	stableSeconds: 60,
	change: ['rising', 'falling'],
	compareTo: 42
};

export const CHANGE_TYPES: Readonly<Record<Change, string>> = {
	unequal: '≠',
	rising: '📈',
	falling: '📉'
};

function loadRules(): Record<string, Rule[]> {
	try {
		const json = JSON.parse(readFileSync(RULE_FILE, 'utf8'));
		return json;
	} catch {
		return {};
	}
}

function saveRules() {
	const content = stringify(rules, {space: 2});
	writeFileSync(RULE_FILE, content, 'utf8');
}

export function getByPosition(position: Position, type: Type) {
	return rules[position + '/' + type] ?? [];
}

export function getByCompareTo(position: Position, type: Type) {
	return Object.values(rules)
		.flat()
		.filter(o => o.compare === 'position')
		.filter(o => o.type === type)
		.filter(o => o.compareTo === position);
}

export function getByChat(chat: number) {
	return Object.values(rules)
		.flat()
		.filter(o => o.chat === chat);
}

export function add(rule: Rule): void {
	const {position, type} = rule;
	const key = position + '/' + type;
	if (!rules[key]) {
		rules[key] = [];
	}

	rules[key]!.push(rule);
	saveRules();
}

export function remove(rule: Rule): void {
	const {position, type} = rule;
	const key = position + '/' + type;
	if (!rules[key]) {
		return;
	}

	const stringifiedRule = stringify(rule);
	rules[key] = rules[key]!
		.filter(o => stringify(o) !== stringifiedRule);

	if (rules[key]!.length === 0) {
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete rules[key];
	}

	saveRules();
}

export function asString(rule: Rule, markdown = false): string {
	const {position, type, change, stableSeconds} = rule;

	let text = type + ' ';
	text += markdown ? `*${position}*` : position;

	text += ' ';

	const changeSymbols = [...change]
		.sort()
		.map(o => CHANGE_TYPES[o]);
	text += changeSymbols.join('') + ' ';

	text += rule.compare === 'value' ? typeValue(rule.type, rule.compareTo) : rule.compareTo;

	text += ' ';
	const stableMinutes = Math.round(stableSeconds / 6) / 10;
	text += `>${stableMinutes} min`;

	return text;
}
