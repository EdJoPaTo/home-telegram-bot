import {MenuTemplate} from 'grammy-inline-menu';
import {html as format} from 'telegram-format';
import type {MyContext} from './context.ts';
import {getRelatedConnectionStatus} from './lib/connected-logic.ts';
import {timespan} from './lib/format.ts';
import * as hass from './lib/home-assistant-topics.ts';
import * as history from './lib/mqtt-history.ts';

const MIN_AGE_MILLISECONDS = 1000 * 60 * 60 * 48;

function getLines(configs: readonly hass.HomeassistantConfig[]) {
	return configs
		.map(config =>
			[config, history.getLastValue(config.state_topic)!] as const)
		.filter(([_config, data]) => Boolean(data))
		.filter(([_config, data]) => {
			if (!data.time) {
				// Retained
				return true;
			}

			const age = Date.now() - data.time.getTime();
			return age < MIN_AGE_MILLISECONDS;
		})
		.sort(([aConfig, _aData], [bConfig, _bData]) =>
			hass.prettyName(aConfig).localeCompare(hass.prettyName(bConfig)))
		.map(([config, data]) => {
			const unit = config.unit_of_measurement
				? '\u00A0' + config.unit_of_measurement
				: '';
			const parts: string[] = [
				getRelatedConnectionStatus(config.availability_topic),
				hass.prettyName(config),
				format.bold(String(data.value)) + unit,
			];

			if (data.time) {
				parts.push(format.italic(timespan(Date.now() - data.time.getTime())));
			}

			return parts.join(' ');
		});
}

export const menu = new MenuTemplate<MyContext>(async ctx => {
	const deviceClass = ctx.session.deviceClass ?? 'temperature';

	const areas = hass.getAreas();
	let text = '';

	for (const area of areas) {
		const configs = hass
			.getConfigs()
			.filter(config => config.device_class === deviceClass)
			.filter(config => config.device.suggested_area === area);
		const lines = getLines(configs);
		if (lines.length === 0) {
			continue;
		}

		text += '\n\n' + area + '\n' + lines.join('\n');
	}

	if (!text) {
		return 'no devices with this device class 😔';
	}

	return {text, parse_mode: format.parse_mode};
});

menu.select('deviceClass', {
	columns: 3,
	choices: () => hass.getDeviceClasses(),
	isSet: (ctx, key) => ctx.session.deviceClass === key,
	set(ctx, key) {
		ctx.session.deviceClass = key;
		return true;
	},
});
