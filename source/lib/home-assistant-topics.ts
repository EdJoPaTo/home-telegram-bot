import {arrayFilterUnique} from 'array-filter-unique';

const SUBSCRIBE_TOPICS = [
	'homeassistant/sensor/+/+/config',
	'homeassistant/sensor/+/config',
] as const;

type Topic = string;

export type HomeassistantConfig = {
	readonly availability_topic?: string;
	readonly device: {
		readonly name: string;
		readonly suggested_area?: string;
	};
	readonly device_class: string;
	readonly name?: string;
	readonly state_topic: string;
	readonly unit_of_measurement?: string;
};

const configs: Record<Topic, HomeassistantConfig> = {};

function isNonEmptyString(input: unknown): input is string {
	return typeof input === 'string' && input.length > 0;
}

function isHomeassistantConfig(config: unknown): config is HomeassistantConfig {
	if (typeof config !== 'object' || config === null) {
		return false;
	}

	const assumed = config as HomeassistantConfig;
	return typeof assumed.device === 'object'
		&& assumed.device !== null
		&& isNonEmptyString(assumed.device.name)
		&& isNonEmptyString(assumed.device_class)
		&& isNonEmptyString(assumed.state_topic);
}

export function isHomeassistantConfigTopic(topic: string): boolean {
	return topic.startsWith('homeassistant/') && topic.endsWith('/config');
}

/** Update the config and returns topics to subscribe to */
export function updateConfig(topic: string, payload: string): string[] {
	if (!payload) {
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete configs[topic];
		return [];
	}

	try {
		const config = JSON.parse(payload) as unknown;
		if (!isHomeassistantConfig(config)) {
			console.log(
				'does not seem like a homeassistant mqtt sensor config',
				topic,
				config,
			);
			return [];
		}

		const allExisting = new Set(getAllSubscribeTopics());

		configs[topic] = config;

		const subscribeList: string[] = [];

		if (
			config.availability_topic
			&& !allExisting.has(config.availability_topic)
		) {
			subscribeList.push(config.availability_topic);
		}

		if (!allExisting.has(config.state_topic)) {
			subscribeList.push(config.state_topic);
		}

		return subscribeList;
	} catch (error: unknown) {
		console.error(
			'homeassistant sensor config is not valid JSON',
			topic,
			payload,
			error,
		);
		return [];
	}
}

export function getAllSubscribeTopics(): string[] {
	const list = Object.values(configs)
		.flatMap(entry => [entry.availability_topic, entry.state_topic])
		.filter(topic => isNonEmptyString(topic))
		.filter(arrayFilterUnique());
	return [...SUBSCRIBE_TOPICS, ...list];
}

export function getConfigs(): readonly HomeassistantConfig[] {
	return Object.values(configs);
}

export function getConfigByStateTopic(topic: string): HomeassistantConfig | undefined {
	return getConfigs().find(config => config.state_topic === topic);
}

export function getDeviceClasses(): readonly string[] {
	return Object.values(configs)
		.map(config => config.device_class)
		.filter(arrayFilterUnique())
		.sort((a, b) => (a ?? '').localeCompare(b ?? ''));
}

export function getAreas(): ReadonlyArray<string | undefined> {
	return Object.values(configs)
		.map(config => config.device.suggested_area)
		.filter(arrayFilterUnique())
		.sort((a, b) => (a ?? '').localeCompare(b ?? ''));
}

export function prettyName(config: HomeassistantConfig): string {
	let pretty = '';

	pretty += config.device.name;

	if (config.name && !config.device_class.includes(config.name.toLowerCase())) {
		pretty += ' ' + config.name;
	}

	return pretty;
}
