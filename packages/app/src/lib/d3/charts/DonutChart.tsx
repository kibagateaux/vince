/**
 * @module DonutChart
 * D3-powered donut chart for distribution visualization
 */

'use client';

import { useCallback } from 'react';
import * as d3 from 'd3';
import { useD3 } from '../hooks/useD3';
import { useChartDimensions } from '../hooks/useChartDimensions';
import { getTransitionDuration } from '../utils/transitions';

interface DonutChartProps {
  data: Array<{ label: string; value: number; color: string }>;
  innerRadiusRatio?: number;
  formatValue?: (value: number) => string;
  className?: string;
}

export function DonutChart({
  data,
  innerRadiusRatio = 0.6,
  formatValue = (d) => `${d}%`,
  className = '',
}: DonutChartProps) {
  const [containerRef, dimensions] = useChartDimensions({
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  });

  const renderChart = useCallback(
    (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) => {
      const { boundedWidth, boundedHeight } = dimensions;
      if (boundedWidth <= 0 || boundedHeight <= 0 || !data.length) return;

      const duration = getTransitionDuration();
      const radius = Math.min(boundedWidth, boundedHeight) / 2;
      const innerRadius = radius * innerRadiusRatio;

      const chart = svg
        .attr('width', dimensions.width)
        .attr('height', dimensions.height)
        .attr('role', 'img')
        .attr('aria-label', 'Distribution chart')
        .append('g')
        .attr('transform', `translate(${dimensions.width / 2},${dimensions.height / 2})`);

      const pie = d3
        .pie<(typeof data)[0]>()
        .value((d) => d.value)
        .sort(null)
        .padAngle(0.02);

      const arc = d3
        .arc<d3.PieArcDatum<(typeof data)[0]>>()
        .innerRadius(innerRadius)
        .outerRadius(radius)
        .cornerRadius(4);

      const arcs = chart
        .selectAll('.arc')
        .data(pie(data))
        .join('g')
        .attr('class', 'arc');

      arcs
        .append('path')
        .attr('fill', (d) => d.data.color)
        .attr('stroke', 'white')
        .attr('stroke-width', 2)
        .transition()
        .duration(duration)
        .attrTween('d', function (d) {
          const interpolate = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
          return (t) => arc(interpolate(t)) || '';
        });

      // Center label (largest segment)
      const largest = data.reduce((a, b) => (a.value > b.value ? a : b));
      chart
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '-0.2em')
        .style('font-size', '24px')
        .style('font-weight', 'bold')
        .style('fill', '#111827')
        .text(formatValue(largest.value));

      chart
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '1.2em')
        .style('font-size', '14px')
        .style('fill', '#6b7280')
        .text(largest.label);
    },
    [data, dimensions, innerRadiusRatio, formatValue]
  );

  const svgRef = useD3(renderChart, { dependencies: [data, dimensions] });

  return (
    <div ref={containerRef} className={`w-full h-full min-h-[200px] ${className}`}>
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}
