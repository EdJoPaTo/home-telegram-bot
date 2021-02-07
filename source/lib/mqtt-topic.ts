export function getCommonPrefix(topicArray: readonly string[]): string {
	if (topicArray.length <= 1) {
		return '';
	}

	const splitted = topicArray.map(o => o.split('/'));
	const first = splitted[0];
	if (!first) {
		return '';
	}

	const commonFields = splitted
		.slice(1)
		.map(fields => {
			let inCommon = 0;
			while (fields[inCommon] === first[inCommon]) {
				inCommon++;
			}

			return inCommon;
		});
	const maxCommon = Math.min(...commonFields);

	if (maxCommon === 0) {
		return '';
	}

	const commonPrefix = first
		.slice(0, maxCommon)
		.join('/') + '/';

	return commonPrefix;
}

export function getWithoutCommonPrefix(topicArray: readonly string[]): string[] {
	const commonPrefix = getCommonPrefix(topicArray);
	return topicArray.map(o => o.slice(commonPrefix.length));
}
