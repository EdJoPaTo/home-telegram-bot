import {MenuTemplate} from 'grammy-inline-menu';
import {html as format} from 'telegram-format';
import * as connectedLogic from './lib/connected-logic.ts';
import {timespan} from './lib/format.ts';
import {getAll} from './lib/mqtt-history.ts';

export const menu = new MenuTemplate(() => {
	const lines = getAll()
		.filter(([topic]) => connectedLogic.isRelevantTopic(topic))
		.map(([topic, data]) => {
			const emoji = connectedLogic.fromTopic(topic, data.value)
				?? connectedLogic.UNKNOWN;

			const parts = [emoji, format.monospace(topic)];

			if (data.time) {
				parts.push(timespan(Date.now() - data.time.getTime()));
			}

			return parts.join(' ');
		});

	const text = lines.join('\n');
	return {text, parse_mode: format.parse_mode};
});

menu.navigate('.', {text: 'Update'});
