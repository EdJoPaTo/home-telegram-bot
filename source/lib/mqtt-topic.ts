export function getTopicParts(topic: string): [string, ...string[]] {
	return topic.split('/') as [string, ...string[]];
}
