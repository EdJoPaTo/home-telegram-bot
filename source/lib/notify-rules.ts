import {readFileSync, writeFileSync} from 'node:fs';
import {html} from 'telegram-format';
import stringify from 'json-stable-stringify';

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

export const DEFAULT_RULE: Partial<Rule> = {
	compare: 'value',
	stableSeconds: 60,
	change: ['rising', 'falling'],
	compareTo: 42,
};

export const CHANGE_TYPES: Readonly<Record<Change, string>> = {
	unequal: '≠',
	rising: '📈',
	falling: '📉',
};

function loadRules(): Record<Topic, Rule[]> {
	try {
		const content = readFileSync(RULE_FILE, 'utf8');
		return JSON.parse(content) as Record<Topic, Rule[]>;
	} catch {
		return {};
	}
}

function saveRules() {
	const content = stringify(rules, {space: 2});
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
	if (!rules[topic]) {
		rules[topic] = [];
	}

	rules[topic]!.push(rule);
	saveRules();
}

export function remove(rule: Rule): void {
	const {topic} = rule;
	if (!rules[topic]) {
		return;
	}

	const stringifiedRule = stringify(rule);
	rules[topic] = rules[topic]!
		.filter(o => stringify(o) !== stringifiedRule);

	if (rules[topic]!.length === 0) {
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete rules[topic];
	}

	saveRules();
}

export function asString(rule: Rule, parse_mode: 'HTML' | undefined): string {
	const {topic, change, stableSeconds} = rule;

	let text = '';
	text += parse_mode === 'HTML' ? html.monospace(topic) : topic;

	text += ' ';

	const changeSymbols = [...change]
		.sort()
		.map(o => CHANGE_TYPES[o]);
	text += changeSymbols.join('') + ' ';

	text += (parse_mode === 'HTML' && rule.compare === 'topic')
		? html.monospace(rule.compareTo)
		: String(rule.compareTo);

	text += ' ';
	const stableMinutes = Math.round(stableSeconds / 6) / 10;
	text += `>${stableMinutes} min`;

	return text;
}
