import {Bot, session} from 'grammy';
import {FileAdapter} from '@grammyjs/storage-file';
import {generateUpdateMiddleware} from 'telegraf-middleware-console-time';
import {html as format} from 'telegram-format';
import {MenuMiddleware} from 'grammy-inline-menu';
import * as MQTT from 'async-mqtt';

import * as data from './lib/data';
import * as notify from './lib/notify';
import {loadConfig} from './lib/config';

import {MyContext, Session} from './parts/context';

import {menu as connectedMenu} from './parts/connected';
import {menu as graphMenu} from './parts/graph';
import {menu as notifyMenu, bot as notifyBot} from './parts/notify';
import {menu as statusMenu} from './parts/status';

const config = loadConfig();

process.title = config.name;

const bot = new Bot<MyContext>(config.telegramBotToken);
bot.use(session({
	getSessionKey: context => String(context.from?.id),
	initial: (): Session => ({graph: {positions: []}}),
	storage: new FileAdapter({
		dirName: 'tmp/sessions',
	}),
}));

bot.use(generateUpdateMiddleware());

notify.init(bot.api);

const mqttRetain = process.env['NODE_ENV'] === 'production';
const mqttOptions: MQTT.IClientOptions = {
	will: {
		topic: `${config.name}/connected`,
		payload: '0',
		qos: 1,
		retain: mqttRetain,
	},
};
console.log('MQTT connecting to', config.mqttServer, mqttOptions);
const client = MQTT.connect(config.mqttServer, mqttOptions);

client.on('connect', async () => {
	console.log('connected to mqtt server');
	await client.publish(`${config.name}/connected`, '2', {retain: mqttRetain});
	await Promise.all(
		config.mqttTopics.map(async topic => client.subscribe(topic)),
	);
	console.log('subscribed to topics', config.mqttTopics);
});

client.on('message', async (topic, message, packet) => {
	if (packet.cmd !== 'publish') {
		// Only handle publish packages
		return;
	}

	const time = Date.now();
	const messageString = message.toString();
	// Debug
	// console.log('incoming message', topic, messageString, packet)
	const value = Number(messageString);

	if (!messageString || !Number.isFinite(value)) {
		console.log('dropping non finite number', topic, messageString);
		return;
	}

	if (packet.retain && topic === `${config.name}/connected`) {
		// Thats my own, old/retained connectionStatus. Ignore it.
		return;
	}

	const topicSplitted = topic.split('/');
	const type = topicSplitted.slice(-1)[0]!;
	const position = topicSplitted
		.slice(0, -1)
		.filter((o, i) => i !== 1 || o !== 'status')
		.join('/');

	if (packet.retain) {
		// The retained value is an old one the MQTT broker still knows about
		data.setLastValue(position, type, undefined, value);
	} else {
		notify.check(position, type, value);
		// Not retained -> new value
		await data.logValue(position, type, time, value);
	}
});

if (config.telegramUserWhitelist.length > 0) {
	bot.use(async (context, next) => {
		if (!context.from) {
			// Whatever it is, its nothing useful for this bot
			return;
		}

		const isWhitelisted = config.telegramUserWhitelist.includes(context.from.id);
		if (isWhitelisted) {
			await next();
			return;
		}

		let text = `Hey ${format.escape(context.from.first_name)}!`;
		text += '\n';
		text += 'Looks like you are not approved to use this bot.';

		text += '\n\n';
		text += 'Forward this message to the owner of the bot if you think you should be approved.';
		text += '\n';
		text += 'Your Telegram user id: ';
		text += format.monospace(String(context.from.id));

		await context.reply(text, {parse_mode: format.parse_mode});
	});
}

const statusMiddleware = new MenuMiddleware('status/', statusMenu);
bot.command('status', async context => statusMiddleware.replyToContext(context));
bot.use(statusMiddleware);

const connectedMiddleware = new MenuMiddleware('connected/', connectedMenu);
bot.command('connected', async context => connectedMiddleware.replyToContext(context));
bot.use(connectedMiddleware);

const graphMiddleware = new MenuMiddleware('graph/', graphMenu);
bot.command('graph', async context => graphMiddleware.replyToContext(context));
bot.use(graphMiddleware);

const notifyMiddleware = new MenuMiddleware('notify/', notifyMenu);
bot.command('notify', async context => notifyMiddleware.replyToContext(context));
bot.use(notifyMiddleware);
bot.use(notifyBot);

bot.command('start', async context =>
	context.reply(`Hey ${context.from?.first_name ?? 'du'}!\n\nWenn du den Status der aktuellen Sensoren sehen willst, nutze /status oder /graph.\nWenn du eine Benachrichtigung haben möchtest, wenn es draußen wärmer wird als drinnen, nutze /notify.`),
);

bot.catch(error => {
	if (error instanceof Error && error.message.includes('message is not modified')) {
		return;
	}

	console.error(error);
});

async function startup() {
	await bot.api.setMyCommands([
		{command: 'status', description: 'betrachte den aktuellen Status der Temperatur Sensoren'},
		{command: 'connected', description: 'zeige den Verbindungsstatus'},
		{command: 'graph', description: 'sende Graphen der Sensordaten'},
		{command: 'notify', description: 'ändere zu welchen Sensoren du benachrichtigt werden willst'},
	]);

	await bot.start({
		onStart(botInfo) {
			console.log(new Date(), 'Bot starts as', botInfo.username);
		},
	});
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
startup();
