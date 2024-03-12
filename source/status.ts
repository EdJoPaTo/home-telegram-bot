import {MenuTemplate} from 'grammy-inline-menu';
import {html as format} from 'telegram-format';
import type {MyContext} from './context.js';
import {getRelatedConnectionStatus} from './lib/connected-logic.js';
import {timespan} from './lib/format.js';
import {getAll} from './lib/mqtt-history.js';
import {addFilterButtons} from './topic-filter.js';

const MIN_AGE_MILLISECONDS = 1000 * 60 * 60 * 48;
const PER_PAGE = 50;

function getAllContent(ctx: MyContext) {
	const filter = new RegExp(ctx.session.topicFilter ?? '.+', 'i');
	const relevantData = getAll()
		.filter(([topic, _data]) => filter.test(topic))
		.filter(([_topic, data]) => {
			if (!data.time) {
				// Retained
				return true;
			}

			const age = Date.now() - data.time.getTime();
			return age < MIN_AGE_MILLISECONDS;
		});

	return relevantData;
}

export const menu = new MenuTemplate<MyContext>(async ctx => {
	const all = getAllContent(ctx);
	if (all.length === 0) {
		return 'no topics match your filter 😔';
	}

	const totalPages = Math.ceil(all.length / PER_PAGE);
	const pageIndex = Math.max(
		0,
		Math.min(totalPages, ctx.session.page ?? 1) - 1,
	);

	const lines = all
		.slice(pageIndex * PER_PAGE, (pageIndex + 1) * PER_PAGE)
		.map(([topic, data]) => {
			const parts: string[] = [
				getRelatedConnectionStatus(topic),
				format.monospace(topic),
				String(data.value),
			];

			if (data.time) {
				parts.push(timespan(Date.now() - data.time.getTime()));
			}

			return parts.join(' ');
		});

	const text = lines.join('\n');
	return {text, parse_mode: format.parse_mode};
});

menu.navigate('.', {text: 'Update'});

addFilterButtons(menu, 'status-filter');

menu.pagination('page', {
	getCurrentPage: ctx => ctx.session.page,
	getTotalPages: ctx => getAllContent(ctx).length / PER_PAGE,
	setPage(ctx, page) {
		ctx.session.page = page;
	},
});
