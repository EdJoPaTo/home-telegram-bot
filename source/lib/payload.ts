export function payloadToNumber(payload: string): number | undefined {
	const value = Number(payload);
	if (Number.isFinite(value)) {
		return value;
	}

	const l = payload.toLowerCase();

	if (l === 'on' || l === 'online' || l === 'true') {
		return 1;
	}

	if (l === 'off' || l === 'offline' || l === 'false') {
		return 0;
	}

	return undefined;
}
