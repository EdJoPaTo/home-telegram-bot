import {Body, MenuTemplate} from 'telegraf-inline-menu';
import {html as format} from 'telegram-format';

import {connectionStatus, timespan} from '../lib/format';
import {getPositions, getLastValue} from '../lib/data';

export const menu = new MenuTemplate(menuBody);

function menuBody(): Body {
	const positions = getPositions(o => Object.keys(o).includes('connected'));

	const lines = positions.map(position => {
		const connected = getLastValue(position, 'connected')!;

		const parts = [
			connectionStatus(connected.value).emoji,
			format.monospace(position),
		];

		if (connected.value !== 2) {
			parts.push(connectionStatus(connected.value).text);
		}

		if (connected.time) {
			parts.push(timespan(Date.now() - connected.time));
		}

		return parts.join(' ');
	});

	const text = lines.join('\n');
	return {text, parse_mode: format.parse_mode};
}

menu.navigate('Update', '.');
