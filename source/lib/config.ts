import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {exit} from 'node:process';

const CONFIG_FILE = 'persist/config.json';

type Config = {
	readonly mqttServer: string;
	readonly mqttTopics: readonly string[];
	readonly telegramBotToken: string;
	readonly telegramUserAllowlist: readonly number[];
};

const DEFAULT_CONFIG: Config = {
	mqttServer: 'tcp://localhost:1883',
	mqttTopics: [
		// MQTT Smarthome
		'+/connected',
		'+/status/#',

		// ESPHome
		'+/status',
		'+/+/+/state',

		'shellies/+/input/+',
		'shellies/+/online',
		'shellies/+/relay/#',
		'shellies/+/temperature',
		'shellies/+/voltage',
	],
	telegramBotToken: '123:abc',
	telegramUserAllowlist: [],
};

export function loadConfig(): Config {
	if (!existsSync(CONFIG_FILE)) {
		saveConfig(DEFAULT_CONFIG);
		console.error(
			'No config file found. Created one. Edit',
			CONFIG_FILE,
			'to your needs and restart the bot.',
		);

		exit(1);
	}

	const content = readFileSync(CONFIG_FILE, 'utf8');
	const config = JSON.parse(content) as Config;
	const withDefaults = {
		...DEFAULT_CONFIG,
		...config,
	};

	// Save again to fix possible formatting issues
	saveConfig(withDefaults);

	return withDefaults;
}

function saveConfig(config: Config): void {
	const content = JSON.stringify(config, null, '  ') + '\n';
	writeFileSync(CONFIG_FILE, content, 'utf8');
}
