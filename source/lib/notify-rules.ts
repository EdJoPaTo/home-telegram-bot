import {readFileSync, writeFileSync} from 'node:fs';
import stringify from 'json-stable-stringify';
import {html} from 'telegram-format';

export type Change = 'unequal' | 'rising' | 'falling';
type Topic = string;

type BaseRule = {
	readonly topic: Topic;
	readonly change: readonly Change[];
	readonly chat: number;
	readonly stableSeconds: number;
};

type TopicRule = BaseRule & {
	readonly compare: 'topic';
	readonly compareTo: Topic;
};

type ValueRule = BaseRule & {
	readonly compare: 'value';
	readonly compareTo: number;
};

export type Rule = ValueRule | TopicRule;

const RULE_FILE = 'persist/rules.json';
const rules = loadRules();

export const DEFAULT_RULE = {
	compare: 'value',
	stableSeconds: 60,
	change: ['rising', 'falling'],
	compareTo: 42,
} as const satisfies Partial<Rule>;

export const CHANGE_TYPES = {
	unequal: '≠',
	rising: '📈',
	falling: '📉',
} as const;

function loadRules(): Record<Topic, Rule[]> {
	try {
		const content = readFileSync(RULE_FILE, 'utf8');
		return JSON.parse(content) as Record<Topic, Rule[]>;
	} catch {
		return {};
	}
}

function saveRules() {
	const content = stringify(rules, {space: '\t'})! + '\n';
	writeFileSync(RULE_FILE, content, 'utf8');
}

export function getByTopic(topic: Topic) {
	return rules[topic] ?? [];
}

export function getByCompareTo(topic: Topic) {
	return Object.values(rules)
		.flat()
		.filter(o => o.compare === 'topic')
		.filter(o => o.compareTo === topic);
}

export function getByChat(chat: number) {
	return Object.values(rules)
		.flat()
		.filter(o => o.chat === chat);
}

export function add(rule: Rule): void {
	const {topic} = rule;
	rules[topic] ??= [];
	rules[topic].push(rule);
	saveRules();
}

export function remove(rule: Rule): void {
	const {topic} = rule;
	if (!rules[topic]) {
		return;
	}

	const stringifiedRule = stringify(rule);
	rules[topic] = rules[topic]
		.filter(o => stringify(o) !== stringifiedRule);

	if (rules[topic].length === 0) {
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete rules[topic];
	}

	saveRules();
}

function getChangeSymbols(change: readonly Change[]): string {
	return [...change].sort().map(o => CHANGE_TYPES[o]).join('');
}

function getHumanreadableStableSeconds(seconds: number): string {
	const minutes = Math.round(seconds / 6) / 10;
	return `>${minutes} min`;
}

export function asString(rule: Rule): string {
	const {topic, compareTo} = rule;
	const changeSymbols = getChangeSymbols(rule.change);
	const stable = getHumanreadableStableSeconds(rule.stableSeconds);
	return `${topic} ${changeSymbols} ${compareTo} ${stable}`;
}

export function asHTML(rule: Rule): string {
	const topic = html.monospace(rule.topic);
	const changeSymbols = getChangeSymbols(rule.change);
	const compareTo = rule.compare === 'topic'
		? html.monospace(rule.compareTo)
		: String(rule.compareTo);
	const stable = getHumanreadableStableSeconds(rule.stableSeconds);
	return `${topic} ${changeSymbols} ${compareTo} ${stable}`;
}
