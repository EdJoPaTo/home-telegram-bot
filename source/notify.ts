import {StatelessQuestion} from '@grammyjs/stateless-question';
import {Composer} from 'grammy';
import {MenuTemplate, replyMenuToContext} from 'grammy-inline-menu';
import {html as format} from 'telegram-format';
import type {MyContext} from './context.js';
import {toggleKeyInArray} from './lib/array-helper.js';
import * as history from './lib/mqtt-history.js';
import * as notifyRules from './lib/notify-rules.js';
import {addFilterButtons} from './topic-filter.js';

const {DEFAULT_RULE, CHANGE_TYPES} = notifyRules;

export const bot = new Composer<MyContext>();

function myRuleList(ctx: MyContext) {
	const rules = notifyRules.getByChat(ctx.chat!.id);
	if (rules.length === 0) {
		return;
	}

	let text = '';
	text += format.bold('Deine Regeln');
	text += '\n';
	text += rules
		.map(rule => notifyRules.asString(rule, format.parse_mode))
		.sort()
		.join('\n');

	return text;
}

export const menu = new MenuTemplate<MyContext>(ctx => {
	let text = format.bold('Benachrichtigungen');
	text += '\n';
	text += 'Du kannst benachrichtigt werden, wenn Geräte bestimmte Bedinungen erfüllen.';

	const ruleList = myRuleList(ctx);
	if (ruleList) {
		text += '\n\n';
		text += ruleList;
	}

	return {text, parse_mode: format.parse_mode};
});

const addMenu = new MenuTemplate<MyContext>('Spezifiziere die Regel…');

menu.submenu('add', addMenu, {text: 'Regel hinzufügen…'});

function topicButtonText(topic: string | undefined) {
	const prefix = '📡 ';
	const exists = Boolean(topic && history.getLastValue(topic));
	if (!topic || !exists) {
		return prefix + 'Topic';
	}

	return prefix + topic;
}

const topicMenu = new MenuTemplate<MyContext>('Wähle das Topic…');

addFilterButtons(topicMenu, 'notify-topic');

topicMenu.select('p', {
	columns: 1,
	choices(ctx) {
		const filter = new RegExp(ctx.session.topicFilter ?? '.+', 'i');
		const relevantTopics = history.getTopics().filter(o => filter.test(o));
		return Object.fromEntries(
			relevantTopics.map(topic => [topic.replaceAll('/', '#'), topic]),
		);
	},
	isSet: (ctx, key) => ctx.session.notify?.topic === key.replaceAll('#', '/'),
	set(ctx, key) {
		const topic = key.replaceAll('#', '/');
		ctx.session.notify = {
			...DEFAULT_RULE,
			change: [...(DEFAULT_RULE.change ?? [])],
			topic,
		};
		return '..';
	},
	getCurrentPage: ctx => ctx.session.page,
	setPage(ctx, page) {
		ctx.session.page = page;
	},
});

topicMenu.navigate('..', {text: '🔙 zurück…'});

addMenu.submenu('t', topicMenu, {
	text: ctx => topicButtonText(ctx.session.notify?.topic),
});

addMenu.select('change', {
	showFalseEmoji: true,
	choices: CHANGE_TYPES,
	hide: ctx => !ctx.session.notify?.topic,
	isSet: (ctx, key) =>
		(ctx.session.notify?.change ?? [])
			.includes(key as notifyRules.Change),
	set(ctx, key) {
		ctx.session.notify = {
			...ctx.session.notify,
			change: toggleKeyInArray(
				ctx.session.notify?.change ?? [],
				key as notifyRules.Change,
			),
		};

		if (ctx.session.notify.change!.length === 0) {
			ctx.session.notify = {
				...ctx.session.notify,
				change: key === 'unequal' ? ['rising', 'falling'] : ['unequal'],
			};
		}

		return true;
	},
});

addMenu.select('compare', {
	choices: {value: '🔢 Wert', topic: '📡 Topic'},
	hide: ctx => !ctx.session.notify?.topic,
	isSet: (ctx, key) => ctx.session.notify?.compare === key,
	set(ctx, key) {
		ctx.session.notify = {
			...ctx.session.notify,
			compare: key as notifyRules.Rule['compare'],
			compareTo: undefined,
		};

		return true;
	},
});

const compareToValueQuestion = new StatelessQuestion<MyContext>(
	'notify-cv',
	async ctx => {
		if (ctx.message.text) {
			const justDigits = Number(
				ctx.message.text.replaceAll(/[^\d,.-]/g, '').replace(',', '.'),
			);
			ctx.session.notify = {
				...ctx.session.notify,
				compare: 'value',
				compareTo: Number.isFinite(justDigits) ? justDigits : 42,
			};
		}

		await replyMenuToContext(addMenu, ctx, 'notify/add/');
	},
);

bot.use(compareToValueQuestion);

addMenu.interact('cv', {
	text(ctx) {
		const {compareTo} = ctx.session.notify ?? {};
		const number = Number.isFinite(compareTo) ? Number(compareTo) : 42;
		return `🔢 ${number}`;
	},
	hide(ctx) {
		const {topic, compare} = ctx.session.notify ?? {};
		return !topic || compare !== 'value';
	},
	async do(ctx) {
		await compareToValueQuestion.replyWithHTML(
			ctx,
			'Mit welchem Wert soll verglichen werden?',
		);
		await ctx.answerCallbackQuery();
		return false;
	},
});

const compareTopicMenu = new MenuTemplate<MyContext>(
	'Mit welchem Sensor willst du den Wert vergleichen?',
);

addFilterButtons(compareTopicMenu, 'notify-compateTopic');

addMenu.submenu('cp', compareTopicMenu, {
	text: ctx =>
		String(
			ctx.session.notify?.compare === 'topic'
				&& topicButtonText(ctx.session.notify.compareTo),
		),
	hide(ctx) {
		const {topic, compare} = ctx.session.notify ?? {};
		return !topic || compare !== 'topic';
	},
});

compareTopicMenu.select('p', {
	columns: 1,
	choices(ctx) {
		const {topic} = ctx.session.notify ?? {};
		if (!topic) {
			return {};
		}

		const filter = new RegExp(ctx.session.topicFilter ?? '.+', 'i');
		const relevantTopics = history.getTopics()
			.filter(o => o !== ctx.session.notify?.topic)
			.filter(o => filter.test(o));

		return Object.fromEntries(
			relevantTopics.map(topic => [topic.replaceAll('/', '#'), topic]),
		);
	},
	isSet(ctx, key) {
		return ctx.session.notify?.compareTo === key.replaceAll('#', '/');
	},
	set(ctx, key) {
		const compareTo = key.replaceAll('#', '/');
		ctx.session.notify = {
			...ctx.session.notify,
			compare: 'topic',
			compareTo,
		};
		return '..';
	},
	getCurrentPage: ctx => ctx.session.page,
	setPage(ctx, page) {
		ctx.session.page = page;
	},
});

compareTopicMenu.navigate('..', {text: '🔙 zurück…'});

addMenu.select('stableSeconds', {
	hide: ctx => !ctx.session.notify?.topic,
	choices: {
		0: 'instant',
		60: '1 min',
		300: '5 min',
		900: '15 min',
	},
	isSet: (ctx, key) => ctx.session.notify?.stableSeconds === Number(key),
	set(ctx, key) {
		ctx.session.notify = {
			...ctx.session.notify,
			stableSeconds: Number(key),
		};
		return true;
	},
});

addMenu.interact('addRule', {
	text: 'Erstellen',
	hide(ctx) {
		const {notify} = ctx.session;

		if (!notify?.topic || !notify.compare || notify.compareTo === undefined) {
			return true;
		}

		if (notify.compare === 'value') {
			return !Number.isFinite(notify.compareTo);
		}

		if (notify.compare === 'topic') {
			const exists = history.getTopics().includes(notify.compareTo);
			return !exists;
		}

		throw new TypeError('how did you end up here?');
	},
	async do(ctx) {
		// @ts-expect-error type check done in hide function
		notifyRules.add({
			...ctx.session.notify,
			chat: ctx.chat!.id,
		});
		delete ctx.session.notify;
		await ctx.answerCallbackQuery('👍');
		return '..';
	},
});

addMenu.navigate('..', {text: '🔙 zurück…'});

const removeMenu = new MenuTemplate<MyContext>(
	'Welche Regel möchtest du entfernen?',
);

menu.submenu('r', removeMenu, {
	text: 'Regel entfernen…',
	hide: ctx => notifyRules.getByChat(ctx.chat!.id).length === 0,
});

removeMenu.choose('r', {
	columns: 1,
	choices(ctx) {
		const rules = notifyRules.getByChat(ctx.chat!.id);
		return Object.fromEntries(
			rules.map((rule, i) => [i, notifyRules.asString(rule, undefined)]),
		);
	},
	do(ctx, key) {
		const rules = notifyRules.getByChat(ctx.chat!.id);
		const ruleToRemove = rules[Number(key)];
		if (ruleToRemove) {
			notifyRules.remove(ruleToRemove);
		}

		return true;
	},
	getCurrentPage: ctx => ctx.session.page,
	setPage(ctx, page) {
		ctx.session.page = page;
	},
});

removeMenu.navigate('..', {text: '🔙 zurück…'});
