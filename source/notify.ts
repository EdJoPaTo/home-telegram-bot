import {StatelessQuestion} from '@grammyjs/stateless-question';
import {Composer} from 'grammy';
import {
	getMenuOfPath,
	MenuTemplate,
	replyMenuToContext,
} from 'grammy-inline-menu';
import {html as format} from 'telegram-format';
import type {MyContext} from './context.ts';
import {toggleKeyInArray} from './lib/array-helper.ts';
import * as hass from './lib/home-assistant-topics.ts';
import * as history from './lib/mqtt-history.ts';
import * as notifyRules from './lib/notify-rules.ts';

const {DEFAULT_RULE, CHANGE_TYPES} = notifyRules;

export const bot = new Composer<MyContext>();

export const menu = new MenuTemplate<MyContext>(ctx => {
	let text = format.bold('Benachrichtigungen');
	text += '\n';
	text
		+= 'Du kannst benachrichtigt werden, wenn Geräte bestimmte Bedinungen erfüllen.';

	const rules = notifyRules.getByChat(ctx.chat!.id);
	if (rules.length > 0) {
		text += '\n\n';
		text += format.bold('Deine Regeln');
		text += '\n';
		text += rules
			.map(rule => '- ' + notifyRules.asHTML(rule))
			.sort()
			.join('\n');
	}

	return {text, parse_mode: format.parse_mode};
});

const addMenu = new MenuTemplate<MyContext>('Spezifiziere die Regel…');

menu.submenu('a', addMenu, {text: 'Regel hinzufügen…'});

const deviceClassMenu = new MenuTemplate<MyContext>('Wähle die device_class');
deviceClassMenu.select('', {
	columns: 2,
	choices: () => hass.getDeviceClasses(),
	isSet: (ctx, key) => ctx.session.deviceClass === key,
	set(ctx, key) {
		ctx.session.deviceClass = key;
		return '..';
	},
});
deviceClassMenu.navigate('..', {text: '🔙 zurück…'});
addMenu.submenu('device_class', deviceClassMenu, {
	text: ctx => '📟 ' + (ctx.session.deviceClass ?? 'device_class'),
});

function topicButtonText(topic: string | undefined) {
	const prefix = '📡 ';
	const exists = Boolean(topic && history.getLastValue(topic));
	if (!topic || !exists) {
		return prefix + 'Topic';
	}

	return prefix + topic;
}

const topicMenu = new MenuTemplate<MyContext>('Wähle das Topic…');

topicMenu.select('p', {
	columns: 1,
	hide: ctx => !ctx.session.deviceClass,
	choices(ctx) {
		return Object.fromEntries(hass
			.getConfigs()
			.filter(config => config.device_class === ctx.session.deviceClass)
			.toSorted((a, b) =>
				hass.prettyName(a).localeCompare(hass.prettyName(b)))
			.map(config => [
				config.state_topic.replaceAll('/', '#'),
				hass.prettyName(config),
			]));
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
		(ctx.session.notify?.change ?? []).includes(key as notifyRules.Change),
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
	async (ctx, path) => {
		if (ctx.message.text) {
			const justDigits = Number(ctx.message.text.replaceAll(/[^\d,.-]/g, '').replace(',', '.'));
			ctx.session.notify = {
				...ctx.session.notify,
				compare: 'value',
				compareTo: Number.isFinite(justDigits) ? justDigits : 42,
			};
		}

		await replyMenuToContext(addMenu, ctx, path);
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
	async do(ctx, path) {
		await compareToValueQuestion.replyWithHTML(
			ctx,
			'Mit welchem Wert soll verglichen werden?',
			getMenuOfPath(path),
		);
		await ctx.answerCallbackQuery();
		return false;
	},
});

const compareTopicMenu = new MenuTemplate<MyContext>('Mit welchem Sensor willst du den Wert vergleichen?');

addMenu.submenu('cp', compareTopicMenu, {
	text: ctx =>
		String(ctx.session.notify?.compare === 'topic'
			&& topicButtonText(ctx.session.notify.compareTo)),
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

		return Object.fromEntries(hass
			.getConfigs()
			.filter(config => config.device_class === ctx.session.deviceClass)
			.filter(config => config.state_topic !== topic)
			.toSorted((a, b) =>
				hass.prettyName(a).localeCompare(hass.prettyName(b)))
			.map(config => [
				config.state_topic.replaceAll('/', '#'),
				hass.prettyName(config),
			]));
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

const removeMenu = new MenuTemplate<MyContext>('Welche Regel möchtest du entfernen?');

menu.submenu('r', removeMenu, {
	text: 'Regel entfernen…',
	hide: ctx => notifyRules.getByChat(ctx.chat!.id).length === 0,
});

removeMenu.choose('r', {
	columns: 1,
	choices(ctx) {
		const rules = notifyRules.getByChat(ctx.chat!.id);
		return Object.fromEntries(rules.map((rule, i) => [i, notifyRules.asString(rule)]));
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
