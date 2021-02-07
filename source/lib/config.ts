import {readFileSync, writeFileSync} from 'fs';

const CONFIG_FILE = 'persistent/config.json';

interface Config {
	readonly mqttServer: string;
	readonly mqttTopics: readonly string[];
	readonly name: string;
	readonly telegramBotToken: string;
	readonly telegramUserWhitelist: readonly number[];
}

const DEFAULT_CONFIG: Config = {
	mqttServer: 'tcp://localhost:1883',
	mqttTopics: [
		'+/connected',
		'+/status/#'
	],
	name: 'home-telegram-bot',
	telegramBotToken: '123:abc',
	telegramUserWhitelist: []
};

export function loadConfig(): Config {
	try {
		const content = readFileSync(CONFIG_FILE, 'utf8');
		const config = JSON.parse(content) as Config;
		const withDefaults = {
			...DEFAULT_CONFIG,
			...config
		};

		// Save again to fix possible formatting issues
		saveConfig(withDefaults);

		return withDefaults;
	} catch {
		saveConfig(DEFAULT_CONFIG);
		throw new Error('No config file found. Created one. Edit ' + CONFIG_FILE + ' to your needs and restart the bot.');
	}
}

function saveConfig(config: Config): void {
	const content = JSON.stringify(config, null, '  ') + '\n';
	writeFileSync(CONFIG_FILE, content, 'utf8');
}
