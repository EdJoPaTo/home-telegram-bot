import * as d3 from 'd3';
import * as sharp from 'sharp';

import {Position, Type} from './notify-rules';
import * as data from './data';
import * as format from './format';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const D3Node = require('d3-node');

// https://projects.susielu.com/viz-palette
const COLORS = ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#a65628', '#f781bf', '#999999'];

type UnixTimestamp = number;
type MsTimestamp = number;

interface Point {
	readonly timestamp: MsTimestamp;
	readonly value: number;
}

interface Series {
	readonly position: string;
	readonly points: readonly Point[];
}

export class Graph {
	private readonly unit: string;
	private readonly seriesPromises: Array<Promise<Series>>;

	constructor(
		private readonly type: Type,
		private readonly minUnixTimestamp: UnixTimestamp
	) {
		this.seriesPromises = [];
		this.unit = format.information[type]?.unit ?? '';
	}

	addSeries(position: Position) {
		this.seriesPromises.push(loadSeries(position, this.type, this.minUnixTimestamp));
	}

	async create() {
		const series = await Promise.all(this.seriesPromises);
		const seriesWithPoints = series
			.filter(o => o.points.length > 0);

		const svgString = createSvgString(this.minUnixTimestamp, this.unit, ...seriesWithPoints);
		const pngBuffer = await sharp(Buffer.from(svgString)).png().toBuffer();
		return pngBuffer;
	}
}

async function loadSeries(position: Position, type: Type, minUnixTimestamp: UnixTimestamp): Promise<Series> {
	const lastValues = await data.loadLastValues(position, type, minUnixTimestamp);

	const withDateLikeTimestamps = lastValues
		.map(({timestamp, value}) => ({
			timestamp: timestamp * 1000,
			value
		}));

	return {
		position,
		points: withDateLikeTimestamps
	};
}

function createSvgString(minUnixTimestamp: UnixTimestamp, unit: string, ...series: readonly Series[]) {
	const margin = {top: 20, right: 170, bottom: 20, left: 0};
	const height = 450;
	const width = 800;

	const d3n = new D3Node();

	const x = d3.scaleTime()
		.domain([minUnixTimestamp * 1000, Date.now()])
		.range([margin.left, width - margin.right]);

	const relevantValues = series
		.flatMap(s => s.points)
		.map(o => o.value);

	const min = d3.min(relevantValues)!;
	const max = d3.max(relevantValues)!;

	const y = d3.scaleLinear()
		.domain([min, max]).nice()
		.range([height - margin.bottom, margin.top]);

	const line = d3.line()
		.x(d => x((d as any).timestamp))
		.y(d => y((d as any).value));

	const svg = d3n.createSVG(width, height);

	const legend = svg.append('g')
		.attr('font-family', 'sans-serif')
		.attr('font-size', 15);
	for (const [i, element] of series.entries()) {
		const lastValue = element.points.slice(-1)[0]!.value;

		const color = COLORS[i % COLORS.length];
		const yValue = y(lastValue);

		legend.append('g')
			.attr('fill', color)
			.call((g: any) => g.append('text')
				.attr('x', width - margin.right + 65)
				.attr('y', yValue)
				.attr('text-anchor', 'end')
				.attr('font-weight', 'bold')
				.text(lastValue.toFixed(1))
			)
			.call((g: any) => g.append('text')
				.attr('x', width - margin.right + 70)
				.attr('y', yValue)
				.attr('text-anchor', 'begin')
				.text(element.position)
			);
	}

	// X Axis
	svg.append('g')
		.attr('transform', `translate(0,${height - margin.bottom})`)
		.call(d3.axisBottom(x)
			.tickFormat(date => {
				if (date instanceof Date) {
					return multiFormat(date);
				}

				return multiFormat(new Date(
					typeof date === 'number' ? date : date.valueOf()
				));
			})
			.tickSizeOuter(0)
		);

	// Y Axis
	svg.append('g')
		.attr('transform', `translate(${width - margin.right},0)`)
		.call(d3.axisRight(y))
		.call((g: any) => g.select('.domain').remove())
		.call((g: any) => g.select('.tick:last-of-type text').clone()
			.attr('x', -3)
			.attr('y', -8)
			.attr('text-anchor', 'end')
			.attr('font-weight', 'bold')
			.attr('font-size', 15)
			.text(unit)
		);

	// X Grid
	svg.append('g')
		.attr('transform', `translate(0,${margin.top})`)
		.attr('opacity', 0.1)
		.call(d3.axisBottom(x)
			.tickFormat(null)
			.tickSize(height - margin.top - margin.bottom)
		)
		.call((g: any) => g.select('.domain').remove());

	// Y Grid
	svg.append('g')
		.attr('transform', `translate(${margin.left},0)`)
		.attr('opacity', 0.1)
		.call(d3.axisRight(y)
			.tickFormat(null)
			.tickSize(width - margin.left - margin.right)
		)
		.call((g: any) => g.select('.domain').remove());

	// Series
	for (const [i, {points}] of series.entries()) {
		svg.append('path')
			.datum(points)
			.attr('fill', 'none')
			.attr('stroke', COLORS[i % COLORS.length])
			.attr('stroke-width', 1.5)
			.attr('stroke-linejoin', 'round')
			.attr('stroke-linecap', 'round')
			.attr('d', line);
	}

	return d3n.svgString();
}

function multiFormat(date: Date) {
	if (d3.timeSecond(date) < date) {
		return d3.timeFormat('.%L')(date);
	}

	if (d3.timeMinute(date) < date) {
		return d3.timeFormat(':%S')(date);
	}

	if (d3.timeHour(date) < date) {
		return d3.timeFormat('%H:%M')(date);
	}

	if (d3.timeDay(date) < date) {
		return d3.timeFormat('%H')(date);
	}

	if (d3.timeMonth(date) < date) {
		if (d3.timeWeek(date) < date) {
			return d3.timeFormat('%a %d')(date);
		}

		return d3.timeFormat('%b %d')(date);
	}

	if (d3.timeYear(date) < date) {
		return d3.timeFormat('%B')(date);
	}

	return d3.timeFormat('%Y')(date);
}
