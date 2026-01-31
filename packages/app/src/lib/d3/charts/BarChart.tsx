/**
 * @module BarChart
 * D3-powered horizontal bar chart
 */

'use client';

import { useCallback } from 'react';
import * as d3 from 'd3';
import { useD3 } from '../hooks/useD3';
import { useChartDimensions } from '../hooks/useChartDimensions';
import { getTransitionDuration } from '../utils/transitions';

interface BarChartProps {
  data: Array<{ label: string; value: number; color: string }>;
  showLabels?: boolean;
  formatValue?: (value: number) => string;
  className?: string;
}

export function BarChart({
  data,
  showLabels = true,
  formatValue = (d) => `${d}%`,
  className = '',
}: BarChartProps) {
  const [containerRef, dimensions] = useChartDimensions({
    top: 10,
    right: 60,
    bottom: 10,
    left: 100,
  });

  const renderChart = useCallback(
    (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => {
      const { boundedWidth, boundedHeight, margin } = dimensions;
      if (boundedWidth <= 0 || boundedHeight <= 0 || !data.length) return;

      const duration = getTransitionDuration();

      const chart = svg
        .attr('width', dimensions.width)
        .attr('height', dimensions.height)
        .attr('role', 'img')
        .attr('aria-label', 'Bar chart')
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      // Scales for horizontal bars
      const xScale = d3
        .scaleLinear()
        .domain([0, d3.max(data, (d) => d.value) || 100])
        .range([0, boundedWidth]);

      const yScale = d3
        .scaleBand()
        .domain(data.map((d) => d.label))
        .range([0, boundedHeight])
        .padding(0.3);

      // Labels
      chart
        .selectAll('.label')
        .data(data)
        .join('text')
        .attr('x', -8)
        .attr('y', (d) => (yScale(d.label) || 0) + yScale.bandwidth() / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'end')
        .style('font-size', '14px')
        .style('fill', '#374151')
        .text((d) => d.label);

      // Bars
      chart
        .selectAll('.bar')
        .data(data)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', 0)
        .attr('y', (d) => yScale(d.label) || 0)
        .attr('height', yScale.bandwidth())
        .attr('fill', (d) => d.color)
        .attr('rx', 4)
        .attr('width', 0)
        .transition()
        .duration(duration)
        .ease(d3.easeCubicOut)
        .attr('width', (d) => xScale(d.value));

      // Value labels
      if (showLabels) {
        chart
          .selectAll('.value')
          .data(data)
          .join('text')
          .attr('x', (d) => xScale(d.value) + 8)
          .attr('y', (d) => (yScale(d.label) || 0) + yScale.bandwidth() / 2)
          .attr('dy', '0.35em')
          .style('font-size', '14px')
          .style('font-weight', '500')
          .style('fill', '#111827')
          .style('opacity', 0)
          .text((d) => formatValue(d.value))
          .transition()
          .delay(duration * 0.6)
          .duration(200)
          .style('opacity', 1);
      }
    },
    [data, dimensions, showLabels, formatValue]
  );

  const svgRef = useD3(renderChart, { dependencies: [data, dimensions] });

  return (
    <div ref={containerRef} className={`w-full h-full min-h-[150px] ${className}`}>
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
