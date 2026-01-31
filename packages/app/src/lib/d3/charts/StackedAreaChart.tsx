/**
 * @module StackedAreaChart
 * D3-powered stacked area chart for treasury holdings
 */

'use client';

import { useMemo, useCallback, useId } from 'react';
import * as d3 from 'd3';
import { useD3 } from '../hooks/useD3';
import { useChartDimensions } from '../hooks/useChartDimensions';
import { getTransitionDuration } from '../utils/transitions';

interface DataPoint {
  date: Date;
  [key: string]: number | Date;
}

interface StackedAreaChartProps {
  data: DataPoint[];
  keys: string[];
  colors: Record<string, string>;
  xAccessor?: (d: DataPoint) => Date;
  formatTooltip?: (key: string, value: number) => string;
  formatYAxis?: (value: number) => string;
  className?: string;
}

export function StackedAreaChart({
  data,
  keys,
  colors,
  xAccessor = (d) => d.date,
  formatTooltip,
  formatYAxis = d3.format('$,.0s'),
  className = '',
}: StackedAreaChartProps) {
  const chartId = useId();
  const [containerRef, dimensions] = useChartDimensions();
  const { boundedWidth, boundedHeight, margin } = dimensions;

  const stackedData = useMemo(() => {
    if (!data.length) return [];
    const stack = d3
      .stack<DataPoint>()
      .keys(keys)
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);
    return stack(data);
  }, [data, keys]);

  const renderChart = useCallback(
    (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => {
      if (boundedWidth <= 0 || boundedHeight <= 0 || !data.length) return;

      const duration = getTransitionDuration();

      // Scales
      const xScale = d3
        .scaleTime()
        .domain(d3.extent(data, xAccessor) as [Date, Date])
        .range([0, boundedWidth]);

      const yScale = d3
        .scaleLinear()
        .domain([0, d3.max(stackedData, (layer) => d3.max(layer, (d) => d[1])) || 0])
        .nice()
        .range([boundedHeight, 0]);

      // Create chart group
      const chart = svg
        .attr('width', dimensions.width)
        .attr('height', dimensions.height)
        .attr('role', 'img')
        .attr('aria-label', 'Treasury holdings over time')
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      // Area generator
      const area = d3
        .area<d3.SeriesPoint<DataPoint>>()
        .x((d) => xScale(xAccessor(d.data)))
        .y0((d) => yScale(d[0]))
        .y1((d) => yScale(d[1]))
        .curve(d3.curveMonotoneX);

      // Render areas
      chart
        .selectAll('.area')
        .data(stackedData)
        .join('path')
        .attr('class', 'area')
        .attr('fill', (d) => colors[d.key] || '#ccc')
        .attr('fill-opacity', 0.8)
        .attr('stroke', (d) => colors[d.key] || '#ccc')
        .attr('stroke-width', 1)
        .attr('d', area)
        .style('opacity', 0)
        .transition()
        .duration(duration)
        .ease(d3.easeCubicOut)
        .style('opacity', 1);

      // X Axis
      const xAxis = d3
        .axisBottom(xScale)
        .ticks(6)
        .tickFormat((d) => d3.timeFormat('%b %d')(d as Date));

      chart
        .append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${boundedHeight})`)
        .call(xAxis)
        .selectAll('text')
        .style('font-size', '12px')
        .style('fill', '#6b7280');

      // Y Axis
      const yAxis = d3
        .axisLeft(yScale)
        .ticks(5)
        .tickFormat((d) => formatYAxis(d as number));

      chart
        .append('g')
        .attr('class', 'y-axis')
        .call(yAxis)
        .selectAll('text')
        .style('font-size', '12px')
        .style('fill', '#6b7280');

      // Tooltip
      const tooltipId = `tooltip-${chartId.replace(/:/g, '')}`;
      let tooltip = d3.select<HTMLDivElement, unknown>(`#${tooltipId}`);
      if (tooltip.empty()) {
        tooltip = d3
          .select('body')
          .append<HTMLDivElement>('div')
          .attr('id', tooltipId)
          .attr('class', 'fixed bg-white rounded-xl border border-gray-200 shadow-lg p-3 pointer-events-none opacity-0 z-50')
          .style('transition', 'opacity 150ms');
      }

      // Invisible overlay for mouse tracking
      chart
        .append('rect')
        .attr('width', boundedWidth)
        .attr('height', boundedHeight)
        .attr('fill', 'transparent')
        .on('mousemove', function (event) {
          const [mouseX] = d3.pointer(event);
          const date = xScale.invert(mouseX);
          const bisect = d3.bisector((d: DataPoint) => xAccessor(d)).left;
          const index = Math.min(bisect(data, date, 1), data.length - 1);
          const d = data[index];

          if (d) {
            tooltip
              .style('opacity', '1')
              .style('left', `${event.pageX + 10}px`)
              .style('top', `${event.pageY - 10}px`)
              .html(
                `<div class="text-sm font-medium text-gray-900 mb-2">
                  ${d3.timeFormat('%b %d, %Y')(xAccessor(d))}
                </div>
                ${keys
                  .map(
                    (key) => `
                  <div class="flex items-center gap-2 text-sm">
                    <span class="w-3 h-3 rounded" style="background: ${colors[key]}"></span>
                    <span class="text-gray-600">${key}:</span>
                    <span class="font-medium">${formatTooltip ? formatTooltip(key, d[key] as number) : d3.format('$,.0f')(d[key] as number)}</span>
                  </div>
                `
                  )
                  .join('')}`
              );
          }
        })
        .on('mouseleave', () => {
          tooltip.style('opacity', '0');
        });

      return () => {
        tooltip.remove();
      };
    },
    [data, stackedData, keys, colors, dimensions, boundedWidth, boundedHeight, margin, formatYAxis, formatTooltip, chartId, xAccessor]
  );

  const svgRef = useD3(renderChart, {
    dependencies: [data, keys, colors, dimensions],
  });

  return (
    <div ref={containerRef} className={`w-full h-full min-h-[300px] ${className}`}>
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
