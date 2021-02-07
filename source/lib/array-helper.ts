export function setKeyInArray<T>(array: readonly T[], key: T, newState: boolean): T[] {
	if (newState) {
		return [...array, key];
	}

	return array.filter(o => o !== key);
}

export function toggleKeyInArray<T>(array: readonly T[], key: T): T[] {
	const currentState = array.includes(key);
	const newState = !currentState;
	return setKeyInArray(array, key, newState);
}
