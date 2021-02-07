interface InformationSet {
	readonly label: string;
	readonly unit?: string;
}

export const information: Readonly<Record<string, InformationSet>> = {
	bri: {
		label: 'Brightness',
		unit: '%'
	},
	connected: {
		label: 'Connected'
	},
	current: {
		label: 'Current',
		unit: 'A'
	},
	hue: {
		label: 'Hue',
		unit: '°'
	},
	hum: {
		label: 'Humidity',
		unit: '%'
	},
	lux: {
		label: 'Lux',
		unit: ' lux'
	},
	on: {
		label: 'On (enabled)'
	},
	rssi: {
		label: 'RSSI',
		unit: ' dBm'
	},
	sat: {
		label: 'Saturation',
		unit: '%'
	},
	temp: {
		label: 'Temperature',
		unit: '°C'
	},
	voltage: {
		label: 'Voltage',
		unit: 'V'
	}
};

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

export const connectionStatusParts = {
	'-1': {
		emoji: '❓',
		text: 'unknown'
	},
	0: {
		emoji: '😴',
		text: 'offline'
	},
	1: {
		emoji: '😨',
		text: 'faulty'
	},
	2: {
		emoji: '✅',
		text: 'connected'
	}
};

export function connectionStatus(value: number | undefined) {
	if (value === 0 || value === 1 || value === 2) {
		return connectionStatusParts[value];
	}

	return connectionStatusParts[-1];
}

export function typeValue(type: string, value: number) {
	let text = String(value);
	text += information[type] ? (information[type]?.unit ?? '') : ` (${type})`;
	return text;
}
