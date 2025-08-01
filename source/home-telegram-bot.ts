import {env} from 'node:process';
import {FileAdapter} from '@grammyjs/storage-file';
import * as MQTT from 'async-mqtt';
import {Bot, session} from 'grammy';
import {MenuMiddleware} from 'grammy-inline-menu';
import {generateUpdateMiddleware} from 'telegraf-middleware-console-time';
import {html as format} from 'telegram-format';
import {menu as connectedMenu} from './connected.ts';
import type {MyContext, Session} from './context.ts';
import {loadConfig} from './lib/config.ts';
import * as history from './lib/mqtt-history.ts';
import * as notify from './lib/notify.ts';
import {payloadToNumber} from './lib/payload.ts';
import {bot as notifyBot, menu as notifyMenu} from './notify.ts';
import {menu as statusMenu} from './status.ts';
import {bot as topicFilterMiddleware} from './topic-filter.ts';

const config = loadConfig();

const retain = env['NODE_ENV'] === 'production';
const mqttOptions: MQTT.IClientOptions = {
	will: {
		topic: 'home-telegram-bot/connected',
		payload: '0',
		qos: 1,
		retain,
	},
};
console.log('MQTT connecting to', config.mqttServer, mqttOptions);
const client = MQTT.connect(config.mqttServer, mqttOptions);

client.on('connect', async () => {
	console.log('connected to mqtt server');
	await Promise.all(config.mqttTopics.map(async topic => client.subscribe(topic)));
	await client.publish('home-telegram-bot/connected', '2', {retain});
	console.log('subscribed to topics', config.mqttTopics);
});
client.on('error', error => {
	console.error('Error MQTT', error);
});

client.on('message', async (topic, payload, packet) => {
	if (packet.cmd !== 'publish') {
		// Only handle publish packages
		return;
	}

	const time = new Date();

	if (payload.byteLength === 0) {
		// Cleanup message -> remove the history entry
		history.removeLastValue(topic);
		return;
	}

	if (payload.byteLength > 40) {
		// Debug
		// console.log('dropping large payload', payload.byteLength, topic);
		return;
	}

	if (topic === 'home-telegram-bot/connected') {
		// Thats my own connection status. Ignore it.
		return;
	}

	const messageString = payload.toString();
	const value = payloadToNumber(messageString);
	if (value === undefined) {
		console.log('dropping unknown payload', topic, messageString);
		return;
	}

	if (!packet.retain) {
		notify.check(topic, value);
	}

	history.setLastValue(topic, packet.retain ? undefined : time, value);
});

const bot = new Bot<MyContext>(config.telegramBotToken);

bot.use(generateUpdateMiddleware());

notify.init(bot.api);

if (config.telegramUserAllowlist.length > 0) {
	bot.use(async (ctx, next) => {
		if (!ctx.from) {
			// Whatever it is, its nothing useful for this bot
			return;
		}

		const isAllowed = config.telegramUserAllowlist.includes(ctx.from.id);
		if (isAllowed) {
			return next();
		}

		let text = `Hey ${format.escape(ctx.from.first_name)}!`;
		text += '\n';
		text += 'Looks like you are not approved to use this bot.';

		text += '\n\n';
		text
			+= 'Forward this message to the owner of the bot if you think you should be approved. This is neither logged nor any data stored about you until you are added manually by the admin via config.json.';
		text += '\n';
		text += 'Your Telegram user id: ';
		text += format.monospace(String(ctx.from.id));

		await ctx.reply(text, {parse_mode: format.parse_mode});
	});
}

bot.use(session({
	getSessionKey: ctx => String(ctx.from?.id),
	initial: (): Session => ({}),
	storage: new FileAdapter({
		dirName: 'persist/sessions',
	}),
}));

bot.use(topicFilterMiddleware);

const statusMiddleware = new MenuMiddleware('status/', statusMenu);
bot.command('status', async ctx => statusMiddleware.replyToContext(ctx));
bot.use(statusMiddleware);

const connectedMiddleware = new MenuMiddleware('connected/', connectedMenu);
bot.command(
	'connected',
	async ctx => connectedMiddleware.replyToContext(ctx),
);
bot.use(connectedMiddleware);

const notifyMiddleware = new MenuMiddleware('n/', notifyMenu);
bot.command('notify', async ctx => notifyMiddleware.replyToContext(ctx));
bot.use(notifyMiddleware);
bot.use(notifyBot);

bot.command('start', async ctx =>
	ctx.reply(
		`Hey ${
			ctx.from?.first_name ?? 'du'
		}!\n\nWenn du den Status der aktuellen Sensoren sehen willst, nutze /status.\nWenn du eine Benachrichtigung haben möchtest, wenn es draußen wärmer wird als drinnen, nutze /notify.`,
		{reply_markup: {remove_keyboard: true}},
	));

// eslint-disable-next-line unicorn/prefer-top-level-await
bot.catch(error => {
	if (
		error instanceof Error
		&& error.message.includes('message is not modified')
	) {
		return;
	}

	console.error(error);
});

await bot.api.setMyCommands([
	{
		command: 'status',
		description: 'betrachte die aktuellen Werte von MQTT Topics',
	},
	{command: 'connected', description: 'zeige den Verbindungsstatus'},
	{
		command: 'notify',
		description: 'ändere zu welchen Sensoren du benachrichtigt werden willst',
	},
]);

await bot.start({
	onStart(botInfo) {
		console.log(new Date(), 'Bot starts as', botInfo.username);
	},
});
