export function enabledEmoji(truthy: boolean): string {
	// ✅ ❎ ✔️ ❌
	return truthy ? '✅' : '❌';
}

export function timespan(totalMs: number): string {
	const ms = pad(totalMs % 1000, 3);
	const s = pad(Math.floor(totalMs / 1000) % 60, 2);
	const m = pad(Math.floor(totalMs / 1000 / 60) % 60, 2);
	const h = Math.floor(totalMs / 1000 / 60 / 60);

	return `${h}:${m}:${s}.${ms}`;
}

function pad(number: number, size: number): string {
	let s = String(number);
	while (s.length < size) {
		s = '0' + s;
	}

	return s;
}
