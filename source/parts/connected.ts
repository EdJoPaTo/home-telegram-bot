import {Composer} from 'telegraf';

import * as data from '../lib/data';
import * as format from '../lib/format';

export const bot = new Composer();

bot.command('connected', async ctx => {
	const positions = data.getPositions(o => Object.keys(o).includes('connected'));

	const lines = positions.map(position => {
		const connected = data.getLastValue(position, 'connected')!;

		const parts = [];
		parts.push(format.connectionStatus(connected.value).emoji);
		parts.push(`*${position}*`);
		if (connected.value !== 2) {
			parts.push(format.connectionStatus(connected.value).text);
		}

		if (connected.time) {
			parts.push(format.timespan(Date.now() - connected.time));
		}

		return parts.join(' ');
	});

	const text = lines.join('\n');
	return ctx.replyWithMarkdown(text);
});
