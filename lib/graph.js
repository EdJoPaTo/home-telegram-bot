const fs = require('fs')
const util = require('util')
const childProcess = require('child_process')
const {resolve} = require('path')

const d3 = require('d3')
const D3Node = require('d3-node')

const data = require('./data')
const format = require('./format')

const fsPromises = fs.promises
const exec = util.promisify(childProcess.exec)

const DATA_PLOT_DIR = './tmp/'
fs.mkdirSync(DATA_PLOT_DIR, {recursive: true})

// https://projects.susielu.com/viz-palette
const COLORS = ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#a65628', '#f781bf', '#999999']

class Graph {
  constructor(type, minUnixTimestamp) {
    this.type = type
    this.minUnixTimestamp = minUnixTimestamp

    this.seriesPromises = []
    this.unit = (format.information[type] || {}).unit || ''
  }

  addSeries(position) {
    this.seriesPromises.push(loadSeries(position, this.type, this.minUnixTimestamp))
  }

  async create() {
    const series = await Promise.all(this.seriesPromises)
    const svgString = createSvgString(this.minUnixTimestamp, this.unit, ...series)
    const pngBuffer = await inscapeReturnsBuffers(svgString)
    return pngBuffer
  }
}

async function loadSeries(position, type, minUnixTimestamp) {
  const lastValues = await data.loadLastValues(position, type, minUnixTimestamp)

  const withDateLikeTimestamps = lastValues
    .map(({timestamp, value}) => ({
      timestamp: timestamp * 1000,
      value
    }))

  return {
    position,
    points: withDateLikeTimestamps
  }
}

function createSvgString(minUnixTimestamp, unit, ...series) {
  const margin = {top: 20, right: 170, bottom: 20, left: 10}
  const height = 450
  const width = 800

  const d3n = new D3Node()

  const x = d3.scaleTime()
    .domain([minUnixTimestamp * 1000, Date.now()])
    .range([margin.left, width - margin.right])

  const relevantValues = series
    .flatMap(s => s.points)
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
    .attr('font-family', 'sans-serif')
    .attr('font-size', 15)
  for (let i = 0; i < series.length; i++) {
    const lastValue = series[i].points.slice(-1)[0].value

    const color = COLORS[i % COLORS.length]
    const yVal = y(lastValue)

    legend.append('g')
      .attr('fill', color)
      .call(g => g.append('text')
        .attr('x', width - margin.right + 65)
        .attr('y', yVal)
        .attr('text-anchor', 'end')
        .attr('font-weight', 'bold')
        .text(lastValue.toFixed(1))
      )
      .call(g => g.append('text')
        .attr('x', width - margin.right + 70)
        .attr('y', yVal)
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
      .attr('y', -8)
      .attr('text-anchor', 'end')
      .attr('font-weight', 'bold')
      .attr('font-size', 15)
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

    svg.append('path')
      .datum(points)
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

async function inscapeReturnsBuffers(svgString) {
  const dir = await fsPromises.mkdtemp('./tmp/')
  const svgFile = `${dir}/input.svg`
  const pngFile = `${dir}/output.png`

  await fsPromises.writeFile(svgFile, svgString, 'utf8')
  await inkscapeWithFiles(svgFile, pngFile)
  const pngBuffer = await fsPromises.readFile(pngFile)

  await Promise.all([
    fsPromises.unlink(svgFile),
    fsPromises.unlink(pngFile)
  ])
  await fsPromises.rmdir(dir)

  return pngBuffer
}

async function inkscapeWithFiles(inputFile, outputFile) {
  return exec(`inkscape -e ${resolve(outputFile)} ${resolve(inputFile)}`)
}

module.exports = Graph
