import {Body, MenuTemplate} from 'telegraf-inline-menu';
import {html as format} from 'telegram-format';

import {connectionStatus, information as informationFormat, typeValue} from '../lib/format';
import {getCommonPrefix} from '../lib/mqtt-topic';
import {getLastValue, getPositions, getTypes, getTypesOfPosition} from '../lib/data';
import {toggleKeyInArray} from '../lib/array-helper';

import {MyContext} from './context';

export const menu = new MenuTemplate(getStatusText);

function getSelectedTypes(context: MyContext) {
	return (context.session.status?.types ?? getTypes())
		.filter(o => o !== 'connected');
}

function getStatusText(context: MyContext): Body {
	const typesOfInterest = getSelectedTypes(context);
	if (typesOfInterest.length === 0) {
		return 'no type selected 😔';
	}

	const positions = getPositions(o =>
		Object.keys(o).some(type => typesOfInterest.includes(type)),
	);
	const commonPrefix = getCommonPrefix(positions);

	const lines = positions.map(position => {
		const types = getTypesOfPosition(position)
			.filter(o => typesOfInterest.includes(o));

		let parts = '';
		const connected = getLastValue(position, 'connected');
		parts += connectionStatus(connected?.value).emoji;
		parts += ' ';

		parts += format.monospace(position.slice(commonPrefix.length));
		parts += ' ';
		parts += types.map(type =>
			typeValue(type, getLastValue(position, type)!.value),
		).join(', ');

		return parts;
	});

	let text = '';
	text += format.bold(format.escape(commonPrefix));
	text += '\n';
	text += lines.join('\n');
	return {text, parse_mode: format.parse_mode};
}

function typeOptions() {
	const allTypes = getTypes()
		.filter(o => o !== 'connected');
	const result: Record<string, string> = {};
	for (const type of allTypes) {
		result[type] = informationFormat[type]?.label ?? type;
	}

	return result;
}

menu.navigate('Update', '.');

menu.select('type', typeOptions, {
	columns: 2,
	showFalseEmoji: true,
	isSet: (context, key) => getSelectedTypes(context).includes(key),
	set: (context, key) => {
		if (!context.session.status) {
			context.session.status = {};
		}

		context.session.status.types = toggleKeyInArray(getSelectedTypes(context), key);
		return true;
	},
});
