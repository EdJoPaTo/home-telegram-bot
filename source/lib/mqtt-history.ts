type Topic = string;

type Datapoint = {
	readonly time: Date | undefined;
	readonly value: number;
};

const last: Record<Topic, Datapoint> = {};

export function setLastValue(
	topic: Topic,
	time: Date | undefined,
	value: number,
): void {
	last[topic] = {time, value};
}

export function removeLastValue(topic: Topic): void {
	// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
	delete last[topic];
}

export function getTopics(): Topic[] {
	return Object.keys(last).sort();
}

export function getLastValue(topic: Topic): Datapoint | undefined {
	return last[topic];
}

export function getAll(): Array<[Topic, Datapoint]> {
	return Object.entries(last).sort((a, b) => a[0].localeCompare(b[0]));
}
