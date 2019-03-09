const fs = require('fs')
const util = require('util')
const childProcess = require('child_process')
const {resolve} = require('path')

const d3 = require('d3')
const D3Node = require('d3-node')

const format = require('../lib/format')

const fsPromises = fs.promises
const exec = util.promisify(childProcess.exec)

const DATA_PLOT_DIR = './tmp/'
fs.mkdirSync(DATA_PLOT_DIR, {recursive: true})

// https://projects.susielu.com/viz-palette
const COLORS = ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#a65628', '#f781bf', '#999999']

class Graph {
  constructor(type, timeframeInMs) {
    this.type = type
    this.timeframeInMs = timeframeInMs

    this.seriesPromises = []
    this.unit = (format.information[type] || {}).unit || ''
  }

  addSeries(position) {
    this.seriesPromises.push(loadSeries(position, this.type))
  }

  async create() {
    this.dir = await fsPromises.mkdtemp('./tmp/')
    const series = await Promise.all(this.seriesPromises)
    const svgString = createSvgString(this.timeframeInMs, this.unit, ...series)

    const filename = `${this.dir}/${this.type}`
    await fsPromises.writeFile(`${filename}.svg`, svgString, 'utf8')
    const pngFile = `${filename}.png`
    await inkscape(`${filename}.svg`, pngFile)
    return pngFile
  }

  async cleanup() {
    await Promise.all([
      fsPromises.unlink(`${this.dir}/${this.type}.svg`),
      fsPromises.unlink(`${this.dir}/${this.type}.png`)
    ])
    await fsPromises.rmdir(this.dir)
  }
}

async function loadSeries(position, type) {
  const content = await fsPromises.readFile(`data/${position}/${type}.log`, 'utf8')
  const points = await d3.csvParseRows(content, (d, i) => {
    if (!isFinite(d[0]) || !isFinite(d[1])) {
      console.log(position, type, 'will ignore line', i, d)
    }

    return {
      timestamp: Number(d[0]) * 1000,
      value: Number(d[1])
    }
  })
    .filter(o => !isNaN(o.timestamp) && !isNaN(o.value))

  return {
    position,
    points
  }
}

function createSvgString(timeframe, unit, ...series) {
  const margin = {top: 20, right: 170, bottom: 20, left: 10}
  const height = 450
  const width = 800

  const d3n = new D3Node()

  const timeToShow = Date.now() - timeframe

  const x = d3.scaleTime()
    .domain([timeToShow, Date.now()])
    .range([margin.left, width - margin.right])

  const relevantValues = series
    .map(s => s.points
      .filter(o => o.timestamp > timeToShow)
    )
    .flat()
    .map(o => o.value)

  const min = d3.min(relevantValues)
  const max = d3.max(relevantValues)

  const y = d3.scaleLinear()
    .domain([min, max]).nice()
    .range([height - margin.bottom, margin.top])

  const line = d3.line()
    .x(d => x(d.timestamp))
    .y(d => y(d.value))

  const svg = d3n.createSVG(width, height)

  const legend = svg.append('g')
  for (let i = 0; i < series.length; i++) {
    const lastValue = series[i].points.slice(-1)[0].value

    const color = COLORS[i % COLORS.length]
    const yVal = y(lastValue)

    legend
      .call(g => g.append('text')
        .attr('x', width - margin.right + 65)
        .attr('y', yVal)
        .attr('fill', color)
        .attr('text-anchor', 'end')
        .attr('font-weight', 'bold')
        .text(lastValue.toFixed(1))
      )
      .call(g => g.append('text')
        .attr('x', width - margin.right + 70)
        .attr('y', yVal)
        .attr('fill', color)
        .attr('text-anchor', 'begin')
        .text(series[i].position)
      )
  }

  // X Axis
  svg.append('g')
    .attr('transform', `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x)
      .tickFormat(multiFormat)
      .tickSizeOuter(0)
    )

  // Y Axis
  svg.append('g')
    .attr('transform', `translate(${width - margin.right},0)`)
    .call(d3.axisRight(y))
    .call(g => g.select('.domain').remove())
    .call(g => g.select('.tick:last-of-type text').clone()
      .attr('x', -3)
      .attr('y', -7)
      .attr('text-anchor', 'end')
      .attr('font-weight', 'bold')
      .attr('font-size', '120%')
      .text(unit)
    )

  // X Grid
  svg.append('g')
    .attr('transform', `translate(0,${margin.top})`)
    .attr('opacity', 0.1)
    .call(d3.axisBottom(x)
      .tickFormat('')
      .tickSize(height - margin.top - margin.bottom)
    )
    .call(g => g.select('.domain').remove())

  // Y Grid
  svg.append('g')
    .attr('transform', `translate(${margin.left},0)`)
    .attr('opacity', 0.1)
    .call(d3.axisRight(y)
      .tickFormat('')
      .tickSize(width - margin.left - margin.right)
    )
    .call(g => g.select('.domain').remove())

  // Series
  for (let i = 0; i < series.length; i++) {
    const {points} = series[i]
    const filtered = points
      .filter(o => o.timestamp > timeToShow)

    svg.append('path')
      .datum(filtered)
      .attr('fill', 'none')
      .attr('stroke', COLORS[i % COLORS.length])
      .attr('stroke-width', 1.5)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr('d', line)
  }

  return d3n.svgString()
}

function multiFormat(date) {
  if (d3.timeSecond(date) < date) {
    return d3.timeFormat('.%L')(date)
  }

  if (d3.timeMinute(date) < date) {
    return d3.timeFormat(':%S')(date)
  }

  if (d3.timeHour(date) < date) {
    return d3.timeFormat('%H:%M')(date)
  }

  if (d3.timeDay(date) < date) {
    return d3.timeFormat('%H')(date)
  }

  if (d3.timeMonth(date) < date) {
    if (d3.timeWeek(date) < date) {
      return d3.timeFormat('%a %d')(date)
    }

    return d3.timeFormat('%b %d')(date)
  }

  if (d3.timeYear(date) < date) {
    return d3.timeFormat('%B')(date)
  }

  return d3.timeFormat('%Y')(date)
}

async function inkscape(inputFile, outputFile) {
  return exec(`inkscape -w 1280 -e ${resolve(outputFile)} ${resolve(inputFile)}`)
}

module.exports = Graph
