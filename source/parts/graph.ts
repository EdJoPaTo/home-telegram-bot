import {html as format} from 'telegram-format';
import {InputFile} from 'grammy';
import {MenuTemplate, Body} from 'grammy-inline-menu';

import {getCommonPrefix, getWithoutCommonPrefix} from '../lib/mqtt-topic';
import {getTypes, getPositions} from '../lib/data';
import {Graph} from '../lib/graph';
import {information as informationFormat} from '../lib/format';
import {toggleKeyInArray} from '../lib/array-helper';

import {MyContext} from './context';

const MINUTES_IN_SECONDS = 60;
const HOUR_IN_SECONDS = 60 * MINUTES_IN_SECONDS;
const DAY_IN_SECONDS = 24 * HOUR_IN_SECONDS;

const POSITIONS_PER_MENU_PAGE = 10;

function calculateSecondsFromTimeframeString(timeframe: string) {
	const match = /(\d+) ?(\w+)/.exec(timeframe);

	if (match?.[2] === 'min') {
		return Number(match[1]) * MINUTES_IN_SECONDS;
	}

	if (match?.[2] === 'h') {
		return Number(match[1]) * HOUR_IN_SECONDS;
	}

	if (match?.[2] === 'd') {
		return Number(match[1]) * DAY_IN_SECONDS;
	}

	return 7 * DAY_IN_SECONDS;
}

const DEFAULT_TYPE = 'temp';
const DEFAULT_TIMEFRAME = '48h';

export const menu = new MenuTemplate<MyContext>(menuBody);

menu.select('type', typeOptions, {
	columns: 2,
	isSet: (context, key) => key === context.session.graph.type,
	set(context, key) {
		context.session.graph.type = key;
		return true;
	},
});

function typeOptions() {
	const allTypes = getTypes();
	const result: Record<string, string> = {};
	for (const type of allTypes) {
		result[type] = informationFormat[type]?.label ?? type;
	}

	return result;
}

menu.select('t', ['40min', '4h', '12h', '48h', '7d', '28d', '90d'], {
	columns: 4,
	isSet: (context, key) => key === context.session.graph?.timeframe,
	set(context, key) {
		context.session.graph.timeframe = key;
		return true;
	},
});

function getRelevantPositions(context: MyContext) {
	const selectedType = context.session.graph.type ?? DEFAULT_TYPE;

	return getPositions(pos => {
		const typesOfPos = Object.keys(pos);
		const posHasRequiredType = typesOfPos.includes(selectedType);
		return posHasRequiredType;
	});
}

function positionsOptions(context: MyContext) {
	const positions = getRelevantPositions(context);
	const displayNames = getWithoutCommonPrefix(positions);

	const result: Record<string, string> = {};
	for (const [i, position] of positions.entries()) {
		result[position] = displayNames[i]!;
	}

	return result;
}

function positionsButtonText(context: MyContext) {
	const relevantPositions = getRelevantPositions(context);
	const selectedPositions = context.session.graph.positions
		.filter(o => relevantPositions.includes(o));

	let text = '';
	text += selectedPositions.length === 0 && relevantPositions.length > 0 ? '⚠️' : '📡';

	text += ' ';
	text += `${selectedPositions.length} / ${relevantPositions.length}`;
	return text;
}

function positionsBody(context: MyContext): Body {
	let text = 'Welche Daten soll der Graph zeigen?';
	text += '\n\n';

	const relevantPositions = getRelevantPositions(context);
	const commonPrefix = getCommonPrefix(relevantPositions);
	const selectedPositions = context.session.graph.positions
		.filter(o => relevantPositions.includes(o))
		.map(o => o.slice(commonPrefix.length))
		.sort();

	if (selectedPositions.length > 0) {
		text += format.bold('Datenquellen');
		text += '\n';
		text += selectedPositions
			.map(o => format.monospace(o))
			.join('\n');
	}

	return {text, parse_mode: format.parse_mode};
}

const positionsMenu = new MenuTemplate(positionsBody);

positionsMenu.select('p', positionsOptions, {
	columns: 1,
	maxRows: POSITIONS_PER_MENU_PAGE,
	showFalseEmoji: true,
	isSet: (context, key) => context.session.graph.positions.includes(key),
	set(context, key) {
		context.session.graph.positions = toggleKeyInArray(context.session.graph.positions, key);
		return true;
	},
	getCurrentPage: context => context.session.graph.positionsPage,
	setPage(context, page) {
		context.session.graph.positionsPage = page;
	},
});

positionsMenu.navigate('🔙 zurück…', '..');

menu.submenu(positionsButtonText, 'pos', positionsMenu);

async function menuBody(context: MyContext): Promise<Body> {
	if (!context.session.graph) {
		context.session.graph = {positions: []};
		return 'Ich hab den Faden verloren 🎈. Stimmt alles?';
	}

	const availablePositions = getRelevantPositions(context);
	const selectedPositions = (context.session.graph.positions || [])
		.filter(o => availablePositions.includes(o));

	if (selectedPositions.length === 0) {
		return 'Ohne gewählte Sensoren kann ich das nicht! 😨';
	}

	const {type, timeframe} = context.session.graph;

	const timeframeInSeconds = calculateSecondsFromTimeframeString(timeframe ?? DEFAULT_TIMEFRAME);
	const minDate = Date.now() - (timeframeInSeconds * 1000);
	const minUnixTimestamp = minDate / 1000;

	const graph = new Graph(type ?? DEFAULT_TYPE, minUnixTimestamp);
	for (const p of selectedPositions) {
		graph.addSeries(p);
	}

	const pngBuffer = await graph.create();
	return {type: 'photo', media: new InputFile(pngBuffer)};
}
