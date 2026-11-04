import { StatelessQuestion } from "@grammyjs/stateless-question";
import { Composer } from "grammy";
import { getMenuOfPath, MenuTemplate, replyMenuToContext } from "grammy-inline-menu";
import { html as format } from "telegram-format";

import type { MyContext } from "./context.ts";
import type { PublishConfig } from "./lib/config.ts";

type PublishFn = (topic: string, payload: string, retain: boolean) => Promise<void>;

let presets: ReadonlyArray<Readonly<PublishConfig>> = [];
let publish: PublishFn | undefined;

export function init(publishPresets: ReadonlyArray<Readonly<PublishConfig>>, publishFn: PublishFn) {
	presets = publishPresets;
	publish = publishFn;
}

export const bot = new Composer<MyContext>();

export const menu = new MenuTemplate<MyContext>((ctx) => {
	let text = format.bold("Publish");
	text += "\n";
	text += "Versende Nachrichten auf Topics. Wähle eines der Presets oder gib ein Topic an.";
	text += "\n\n";

	if (ctx.session.publish?.topic) {
		text += "Topic: ";
		text += format.monospace(ctx.session.publish.topic);
		text += "\n";
	}

	if (ctx.session.publish?.payload) {
		text += "Payload:\n";
		text += format.monospaceBlock(ctx.session.publish.payload);
		text += "\n";
	}

	return { text, parse_mode: format.parse_mode };
});

menu.choose("preset", {
	columns: 1,
	hide: (ctx) => Boolean(ctx.session.publish?.topic),
	choices: () =>
		Object.fromEntries(presets.map((o, index) => [index, o.label || o.topic] as const)),
	do(ctx, key) {
		const index = Number(key);
		const preset = presets[index];
		if (!preset) {
			throw new Error("preset with the given index does not exist");
		}

		ctx.session.publish = { ...preset };
		return true;
	},
});

const topicQuestion = new StatelessQuestion<MyContext>("publishTopic", async (ctx, path) => {
	const { text } = ctx.msg ?? {};
	if (!text) {
		throw new Error("there has to be text for a topic");
	}

	ctx.session.publish = { topic: text };
	await replyMenuToContext(menu, ctx, path);
});
bot.use(topicQuestion);

menu.interact("topic", {
	text: "Topic eingeben…",
	hide: (ctx) => Boolean(ctx.session.publish?.topic),
	async do(ctx, path) {
		await topicQuestion.replyWithHTML(
			ctx,
			"Auf welches Topic möchtest du versenden?",
			getMenuOfPath(path),
		);
		await ctx.answerCallbackQuery();
		try {
			await ctx.deleteMessage();
		} catch {}
		return false;
	},
});

menu.toggle("retain", {
	text: "Retain",
	hide: (ctx) => !ctx.session.publish?.topic,
	isSet: (ctx) => Boolean(ctx.session.publish?.retain),
	set(ctx, value) {
		ctx.session.publish = {
			...ctx.session.publish,
			retain: value,
		};
		return true;
	},
});

const payloadQuestion = new StatelessQuestion<MyContext>("publishPayload", async (ctx, path) => {
	const { text } = ctx.msg ?? {};
	if (!text) {
		throw new Error("there has to be text for a payload");
	}

	ctx.session.publish = {
		payload: text,
		...ctx.session.publish,
	};
	await replyMenuToContext(menu, ctx, path);
});
bot.use(payloadQuestion);

menu.interact("payload", {
	text: "Payload eingeben…",
	hide: (ctx) => !ctx.session.publish?.topic,
	async do(ctx, path) {
		await payloadQuestion.replyWithHTML(
			ctx,
			"Welches Payload möchtest du versenden?",
			getMenuOfPath(path),
		);
		await ctx.answerCallbackQuery();
		try {
			await ctx.deleteMessage();
		} catch {}
		return false;
	},
});

menu.interact("cancel", {
	text: "Abbrechen & Zurücksetzen",
	hide: (ctx) => !ctx.session.publish,
	do(ctx) {
		delete ctx.session.publish;
		return true;
	},
});

menu.interact("send", {
	joinLastRow: true,
	text: "Senden",
	hide: (ctx) => !ctx.session.publish?.topic || !ctx.session.publish.payload,
	async do(ctx) {
		const { topic, payload } = ctx.session.publish ?? {};
		const retain = Boolean(ctx.session.publish?.retain);
		if (!topic || !payload) {
			throw new Error("there has to be a topic & payload for publishing");
		}

		if (!publish) {
			throw new Error("not yet connected to MQTT");
		}

		await publish(topic, payload, retain);

		let text = format.monospace(topic);
		text += `\nRetain: ${retain}\nPayload:\n`;
		text += format.monospaceBlock(payload);
		await ctx.reply(text, {
			parse_mode: format.parse_mode,
			reply_markup: { remove_keyboard: true },
		});

		delete ctx.session.publish;
		try {
			await ctx.deleteMessage();
		} catch {}
		return false;
	},
});
