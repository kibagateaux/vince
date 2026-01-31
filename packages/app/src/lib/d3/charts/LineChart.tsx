/**
 * @module LineChart
 * D3-powered line chart with optional moving average
 */

'use client';

import { useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { useD3 } from '../hooks/useD3';
import { useChartDimensions } from '../hooks/useChartDimensions';
import { getTransitionDuration } from '../utils/transitions';

interface LineChartProps {
  data: Array<{ date: Date; value: number }>;
  movingAverageWindow?: number;
  showMovingAverage?: boolean;
  formatY?: (value: number) => string;
  color?: string;
  movingAvgColor?: string;
  className?: string;
}

export function LineChart({
  data,
  movingAverageWindow = 7,
  showMovingAverage = true,
  formatY = d3.format('$,.0s'),
  color = '#2563eb',
  movingAvgColor = '#9ca3af',
  className = '',
}: LineChartProps) {
  const [containerRef, dimensions] = useChartDimensions();

  const movingAvgData = useMemo(() => {
    if (!showMovingAverage || !data.length) return [];
    return data.map((d, i) => {
      const start = Math.max(0, i - movingAverageWindow + 1);
      const window = data.slice(start, i + 1);
      const avg = d3.mean(window, (w) => w.value) || 0;
      return { date: d.date, value: avg };
    });
  }, [data, movingAverageWindow, showMovingAverage]);

  const renderChart = useCallback(
    (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => {
      const { boundedWidth, boundedHeight, margin } = dimensions;
      if (boundedWidth <= 0 || boundedHeight <= 0 || !data.length) return;

      const duration = getTransitionDuration();

      const chart = svg
        .attr('width', dimensions.width)
        .attr('height', dimensions.height)
        .attr('role', 'img')
        .attr('aria-label', 'Line chart')
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      // Scales
      const xScale = d3
        .scaleTime()
        .domain(d3.extent(data, (d) => d.date) as [Date, Date])
        .range([0, boundedWidth]);

      const yScale = d3
        .scaleLinear()
        .domain([0, d3.max(data, (d) => d.value) || 0])
        .nice()
        .range([boundedHeight, 0]);

      // Line generator
      const line = d3
        .line<(typeof data)[0]>()
        .x((d) => xScale(d.date))
        .y((d) => yScale(d.value))
        .curve(d3.curveMonotoneX);

      // Moving average line (dashed)
      if (showMovingAverage && movingAvgData.length) {
        chart
          .append('path')
          .datum(movingAvgData)
          .attr('fill', 'none')
          .attr('stroke', movingAvgColor)
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '5,5')
          .attr('d', line);
      }

      // Main line
      const path = chart
        .append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2.5)
        .attr('d', line);

      // Animate line drawing
      const totalLength = path.node()?.getTotalLength() || 0;
      path
        .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(duration * 2)
        .ease(d3.easeLinear)
        .attr('stroke-dashoffset', 0);

      // X Axis
      chart
        .append('g')
        .attr('transform', `translate(0,${boundedHeight})`)
        .call(d3.axisBottom(xScale).ticks(6))
        .selectAll('text')
        .style('font-size', '12px')
        .style('fill', '#6b7280');

      // Y Axis
      chart
        .append('g')
        .call(
          d3
            .axisLeft(yScale)
            .ticks(5)
            .tickFormat((d) => formatY(d as number))
        )
        .selectAll('text')
        .style('font-size', '12px')
        .style('fill', '#6b7280');
    },
    [data, movingAvgData, dimensions, color, movingAvgColor, showMovingAverage, formatY]
  );

  const svgRef = useD3(renderChart, { dependencies: [data, dimensions] });

  return (
    <div ref={containerRef} className={`w-full h-full min-h-[250px] ${className}`}>
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
