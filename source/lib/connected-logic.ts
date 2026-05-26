import {getLastValue} from './mqtt-history.ts';

export const CONNECTED_SUBSCRIPTION_TOPICS = [
	'+/online',
	'+/connected',
	'+/status',
] as const;

const GENERIC_ONLINE_END = '/online';
const MQTT_SMARTHOME_END = '/connected';
const ESP_HOME_END = '/status';

const UNKNOWN = '❓';
const OFFLINE = '😴';
const FAULTY = '😨';
const CONNECTED = '✅';

function mqttSmarthomePart(value: number | undefined) {
	if (value === 0) {
		return OFFLINE;
	}

	if (value === 1) {
		return FAULTY;
	}

	if (value === 2) {
		return CONNECTED;
	}

	return undefined;
}

function espHomePart(value: number | undefined) {
	if (value === 0) {
		return OFFLINE;
	}

	if (value === 1) {
		return CONNECTED;
	}

	return undefined;
}

export function isRelevantTopic(topic: string): boolean {
	return topic.endsWith(GENERIC_ONLINE_END)
		|| topic.endsWith(MQTT_SMARTHOME_END)
		|| topic.endsWith(ESP_HOME_END);
}

export function fromTopic(topic: string, value: number | undefined) {
	if (topic.endsWith(MQTT_SMARTHOME_END)) {
		return mqttSmarthomePart(value) ?? UNKNOWN;
	}

	if (topic.endsWith(GENERIC_ONLINE_END) || topic.endsWith(ESP_HOME_END)) {
		return espHomePart(value) ?? UNKNOWN;
	}

	return UNKNOWN;
}

export function getRelatedConnectionStatus(topic: string | undefined) {
	if (!topic) {
		return UNKNOWN;
	}

	const data = getLastValue(topic);
	return fromTopic(topic, data?.value);
}
