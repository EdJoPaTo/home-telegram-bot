import {Composer} from 'telegraf';
import {html as format} from 'telegram-format';
import {MenuTemplate, Body, replyMenuToContext} from 'telegraf-inline-menu';
import TelegrafStatelessQuestion from 'telegraf-stateless-question';

import {toggleKeyInArray} from '../lib/array-helper';
import {getPositions, getTypesOfPosition} from '../lib/data';
import {information as informationFormat, typeValue} from '../lib/format';
import * as notifyRules from '../lib/notify-rules';

import {MyContext} from './context';

const {DEFAULT_RULE, CHANGE_TYPES} = notifyRules;

export const bot = new Composer<MyContext>();

function myRuleList(context: MyContext) {
	const rules = notifyRules.getByChat(context.chat!.id);
	if (rules.length === 0) {
		return;
	}

	let text = '';
	text += format.bold('Deine Regeln');
	text += '\n';
	text += rules
		.map(o => notifyRules.asString(o, format.parse_mode === 'HTML' ? 'HTML' : undefined))
		.sort()
		.join('\n');

	return text;
}

function notifyOverviewText(context: MyContext): Body {
	let text = format.bold('Benachrichtigungen');
	text += '\n';

	text += 'Du kannst benachrichtigt werden, wenn Geräte bestimmte Bedinungen erfüllen.';

	const ruleList = myRuleList(context);
	if (ruleList) {
		text += '\n\n';
		text += ruleList;
	}

	return {text, parse_mode: format.parse_mode};
}

export const menu = new MenuTemplate(notifyOverviewText);

const addMenu = new MenuTemplate<MyContext>('Spezifiziere die Regel…');

menu.submenu('Regel hinzufügen…', 'add', addMenu);

function positionButtonText(position: string | undefined) {
	const exists = Boolean(position && getPositions().includes(position));
	const prefix = '📡 ';
	if (!position || !exists) {
		return prefix + 'Position';
	}

	return prefix + position;
}

function positionOptions() {
	const result: Record<string, string> = {};
	for (const position of getPositions()) {
		result[position.replace(/\//g, '#')] = position;
	}

	return result;
}

const positionMenu = new MenuTemplate<MyContext>('Wähle das Gerät…');

positionMenu.select('p', positionOptions, {
	columns: 1,
	isSet: (context, key) => context.session.notify?.position === key.replace(/#/g, '/'),
	set: (context, key) => {
		const position = key.replace(/#/g, '/');
		context.session.notify = {
			...DEFAULT_RULE,
			change: [...(DEFAULT_RULE.change ?? [])],
			position,
		};
		return '..';
	},
	getCurrentPage: context => context.session.page,
	setPage: (context, page) => {
		context.session.page = page;
	},
});

positionMenu.navigate('🔙 zurück…', '..');

addMenu.submenu(context => positionButtonText(context.session.notify?.position), 'p', positionMenu);

function selectTypeButtonText(context: MyContext) {
	const type = context.session.notify?.type;
	const prefix = '📐 ';
	if (!type) {
		return prefix + 'Typ';
	}

	return prefix + (informationFormat[type]?.label ?? type);
}

function typeOptions(position: string | undefined) {
	const allTypes = position ? getTypesOfPosition(position) : [];
	const result: Record<string, string> = {};
	for (const type of allTypes) {
		result[type] = informationFormat[type]?.label ?? type;
	}

	return result;
}

const typeMenu = new MenuTemplate<MyContext>('Wähle den Typ…');

addMenu.submenu(selectTypeButtonText, 't', typeMenu, {
	hide: context => {
		const position = context.session.notify?.position;
		return !position || !getPositions().includes(position);
	},
});
typeMenu.select('t', context => typeOptions(context.session.notify?.position), {
	columns: 2,
	isSet: (context, key) => context.session.notify?.type === key,
	set: (context, key) => {
		if (!context.session.notify) {
			context.session.notify = {};
		}

		context.session.notify = {
			...context.session.notify,
			type: key,
		};

		if (key === 'connected') {
			context.session.notify = {
				...context.session.notify,
				change: ['unequal'],
				compare: 'value',
				compareTo: 2,
			};
		}

		return '..';
	},
});

typeMenu.navigate('🔙 zurück…', '..');

addMenu.select('change', CHANGE_TYPES, {
	showFalseEmoji: true,
	hide: context => !context.session.notify?.type,
	isSet: (context, key) => (context.session.notify?.change ?? []).includes(key as notifyRules.Change),
	set: (context, key) => {
		context.session.notify = {
			...context.session.notify,
			change: toggleKeyInArray(context.session.notify?.change ?? [], key as notifyRules.Change),
		};

		if (context.session.notify.change!.length === 0) {
			context.session.notify = {
				...context.session.notify,
				change: key === 'unequal' ? ['rising', 'falling'] : ['unequal'],
			};
		}

		return true;
	},
});

addMenu.select('compare', {value: '🔢 Wert', position: '📡 Position'}, {
	hide: context => !context.session.notify?.type,
	isSet: (context, key) => context.session.notify?.compare === key,
	set: (context, key) => {
		context.session.notify = {
			...context.session.notify,
			compare: key as any,
			compareTo: undefined,
		};

		return true;
	},
});

function possibleCompareToSensors(context: MyContext) {
	const {position, type} = context.session.notify ?? {};
	if (!type) {
		return {};
	}

	const positions = getPositions(o => Object.keys(o).includes(type))
		.filter(o => o !== position);

	const result: Record<string, string> = {};
	for (const p of positions) {
		result[p.replace(/\//g, '#')] = p;
	}

	return result;
}

function compareToValueButtonText(context: MyContext) {
	const prefix = '🔢 ';
	const {type, compareTo} = context.session.notify ?? {};
	const number = Number.isFinite(compareTo) ? Number(compareTo) : 42;
	const formatted = typeValue(type, number);
	return prefix + formatted;
}

const compareToValueQuestion = new TelegrafStatelessQuestion<MyContext>('notify-cv', async context => {
	if ('text' in context.message) {
		const justDigits = Number(context.message.text.replace(/[^\d,.-]/g, '').replace(',', '.'));
		context.session.notify = {
			...context.session.notify,
			compare: 'value',
			compareTo: Number.isFinite(justDigits) ? justDigits : 42,
		};
	}

	await replyMenuToContext(menu, context, 'notify/');
});

bot.use(compareToValueQuestion);

addMenu.interact(compareToValueButtonText, 'cv', {
	hide: context => {
		const {type, compare} = context.session.notify ?? {};
		return !type || compare !== 'value';
	},
	do: async context => {
		await compareToValueQuestion.replyWithHTML(context, 'Mit welchem Wert soll verglichen werden?');
		return false;
	},
});

const comparePositionMenu = new MenuTemplate<MyContext>('Mit welchem Sensor willst du den Wert vergleichen?');

addMenu.submenu(context => String(context.session.notify?.compare === 'position' && positionButtonText(context.session.notify.compareTo)), 'cp', comparePositionMenu, {
	hide: context => {
		const {type, compare} = context.session.notify ?? {};
		return !type || compare !== 'position';
	},
});

comparePositionMenu.select('p', possibleCompareToSensors, {
	columns: 1,
	isSet: (context, key) => context.session.notify?.compareTo === key.replace(/#/g, '/'),
	set: (context, key) => {
		const compareTo = key.replace(/#/g, '/');
		context.session.notify = {
			...context.session.notify,
			compare: 'position',
			compareTo,
		};
		return '..';
	},
	getCurrentPage: context => context.session.page,
	setPage: (context, page) => {
		context.session.page = page;
	},
});

comparePositionMenu.navigate('🔙 zurück…', '..');

const stableSecondsOptions = {
	0: 'instant',
	60: '1 min',
	300: '5 min',
};

addMenu.select('stableSeconds', stableSecondsOptions, {
	hide: context => !context.session.notify?.type,
	isSet: (context, key) => context.session.notify?.stableSeconds === Number(key),
	set: (context, key) => {
		context.session.notify = {
			...context.session.notify,
			stableSeconds: Number(key),
		};
		return true;
	},
});

addMenu.interact('Erstellen', 'addRule', {
	hide: context => {
		const {notify} = context.session;

		if (!notify || !notify.type || !notify.compare || notify.compareTo === undefined) {
			return true;
		}

		if (notify.compare === 'value') {
			return !Number.isFinite(notify.compareTo);
		}

		if (notify.compare === 'position') {
			const exists = getPositions().includes(notify.compareTo);
			return !exists;
		}

		throw new TypeError('how did you end up here?');
	},
	do: async context => {
		notifyRules.add({
			...context.session.notify,
			chat: context.chat!.id,
		} as any);
		delete context.session.notify;
		await context.answerCbQuery('👍');
		return '..';
	},
});

addMenu.navigate('🔙 zurück…', '..');

const removeMenu = new MenuTemplate<MyContext>('Welche Regel möchtest du entfernen?');

menu.submenu('Regel entfernen…', 'r', removeMenu, {
	hide: context => notifyRules.getByChat(context.chat!.id).length === 0,
});

function removeOptions(context: MyContext) {
	const rules = notifyRules.getByChat(context.chat!.id);
	const result: Record<number, string> = {};
	for (const [i, rule] of rules.entries()) {
		result[i] = notifyRules.asString(rule, undefined);
	}

	return result;
}

removeMenu.choose('r', removeOptions, {
	columns: 1,
	do: (context, key) => {
		const rules = notifyRules.getByChat(context.chat!.id);
		const ruleToRemove = rules[Number(key)];
		if (ruleToRemove) {
			notifyRules.remove(ruleToRemove);
		}

		return true;
	},
	getCurrentPage: context => context.session.page,
	setPage: (context, page) => {
		context.session.page = page;
	},
});

removeMenu.navigate('🔙 zurück…', '..');
