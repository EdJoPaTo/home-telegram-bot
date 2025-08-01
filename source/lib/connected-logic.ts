import {getLastValue} from './mqtt-history.ts';
import {getTopicParts} from './mqtt-topic.ts';

const MQTT_SMARTHOME_END = '/connected';
const ESP_HOME_END = '/status';

export const UNKNOWN = '❓';
export const OFFLINE = '😴';
export const FAULTY = '😨';
export const CONNECTED = '✅';

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
	return topic.endsWith(MQTT_SMARTHOME_END) || topic.endsWith(ESP_HOME_END);
}

export function fromTopic(topic: string, value: number | undefined) {
	if (topic.endsWith(MQTT_SMARTHOME_END)) {
		return mqttSmarthomePart(value);
	}

	if (topic.endsWith(ESP_HOME_END)) {
		return espHomePart(value);
	}

	return undefined;
}

export function getRelatedConnectionStatus(topic: string) {
	const base = getTopicParts(topic)[0];

	{
		const data = getLastValue(base + MQTT_SMARTHOME_END);
		const status = mqttSmarthomePart(data?.value);
		if (status) {
			return status;
		}
	}

	{
		const data = getLastValue(base + ESP_HOME_END);
		const status = espHomePart(data?.value);
		if (status) {
			return status;
		}
	}

	return UNKNOWN;
}
