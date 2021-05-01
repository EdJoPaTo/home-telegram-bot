import {readFile, mkdir, appendFile} from 'fs/promises';

import arrayFilterUnique from 'array-filter-unique';
import * as d3 from 'd3';

const SECONDS_PER_DAY = 60 * 60 * 24;

interface Datapoint {
	readonly time: MsTimestamp | undefined;
	readonly value: number;
}

type Position = string;
type Type = string;
type MsTimestamp = number;
type UnixTimestamp = number;

const last: Record<Position, Record<Type, Datapoint>> = {};

export function setLastValue(position: Position, type: Type, time: MsTimestamp | undefined, value: number): void {
	if (!last[position]) {
		last[position] = {};
	}

	last[position]![type] = {
		time,
		value
	};
}

function filenameOf(position: Position, type: Type, time: MsTimestamp) {
	const date = new Date(time);
	const dir = `history/${position}/${type}/${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`;
	const filename = `${dir}/${date.getUTCDate()}.log`;

	return {
		dir,
		filename
	};
}

export async function logValue(position: Position, type: Type, time: MsTimestamp, value: number) {
	setLastValue(position, type, time, value);
	const unixTime = Math.round(time / 1000);

	const {filename, dir} = filenameOf(position, type, time);
	await mkdir(dir, {recursive: true});

	const content = `${unixTime},${value}\n`;
	await appendFile(filename, content, 'utf8');
}

export function getPositions(filter: (datapoints: Readonly<Record<Type, Datapoint>>) => boolean = () => true): Position[] {
	return Object.entries(last)
		.filter(([_key, value]) => filter(value))
		.map(([key]) => key)
		.sort();
}

export function getTypes() {
	const positions = Object.keys(last);
	const types = positions
		.flatMap(o => Object.keys(last[o] ?? {}))
		.filter(arrayFilterUnique())
		.sort();

	return types;
}

export function getTypesOfPosition(position: Position): Type[] {
	return Object.keys(last[position] ?? {})
		.sort();
}

export function getLastValue(position: Position, type: Type) {
	return last[position]?.[type];
}

export async function loadLastValues(position: Position, type: Type, minTimestamp: UnixTimestamp) {
	const contentPromises = [];
	const minTimestampDay = Math.floor(minTimestamp / SECONDS_PER_DAY) * SECONDS_PER_DAY;
	for (let cur = minTimestampDay * 1000; cur <= Date.now(); cur += 1000 * SECONDS_PER_DAY) {
		const {filename} = filenameOf(position, type, cur);
		try {
			// eslint-disable-next-line no-await-in-loop
			contentPromises.push(await readFile(filename, 'utf8'));
		} catch {
			// If there is no value in that timeframe just ignore it
		}
	}

	const contents = await Promise.all(contentPromises);
	const entries = contents
		.filter((o): o is string => Boolean(o))
		.flatMap(o => parseCsv(o))
		.filter(o => o.timestamp >= minTimestamp)
		.sort((a, b) => a.timestamp - b.timestamp);

	return entries;
}

function parseCsv(content: string) {
	const entries = d3.csvParseRows(content, (o, i) => {
		const timestamp = Number(o[0]);
		const value = Number(o[1]);

		if (!Number.isFinite(timestamp) || !Number.isFinite(value)) {
			console.log('will ignore line', i, o);
		}

		return {
			timestamp,
			value
		};
	})
		.filter(({timestamp, value}) => !Number.isNaN(timestamp) && !Number.isNaN(value));

	return entries;
}
