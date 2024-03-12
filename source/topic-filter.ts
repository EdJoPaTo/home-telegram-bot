import {StatelessQuestion} from '@grammyjs/stateless-question';
import {Composer} from 'grammy';
import {
	getMenuOfPath,
	type MenuTemplate,
	replyMenuToContext,
} from 'grammy-inline-menu';
import type {MyContext} from './context.js';

export const bot = new Composer<MyContext>();

export function addFilterButtons(
	menu: MenuTemplate<MyContext>,
	uniqueIdentifier: string,
): void {
	const question = new StatelessQuestion<MyContext>(
		uniqueIdentifier,
		async (ctx, path) => {
			try {
				const {text} = ctx.message;
				if (text) {
					const regex = new RegExp(text, 'i');
					ctx.session.topicFilter = regex.source;
				}
			} catch (error: unknown) {
				await ctx.reply(error instanceof Error ? error.message : String(error));
			}

			await replyMenuToContext(menu, ctx, path);
		},
	);

	bot.use(question.middleware());

	menu.interact('filter', {
		text: ctx => '🔎 ' + (ctx.session.topicFilter ?? 'Set Filter'),
		async do(ctx, path) {
			await question.replyWithHTML(
				ctx,
				'Wonach sollen die Topics gefiltert werden? (regulärer Ausdruck / RegEx)',
				getMenuOfPath(path),
			);
			await ctx.answerCallbackQuery();
			return false;
		},
	});

	menu.interact('clear-filter', {
		joinLastRow: true,
		text: 'Clear Filter',
		hide: ctx => !ctx.session.topicFilter,
		async do(ctx) {
			delete ctx.session.topicFilter;
			return true;
		},
	});
}
