/**
 * @module useChartDimensions
 * Responsive chart dimensions hook with margin handling
 */

import { useRef, useState, useEffect } from 'react';

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ChartDimensions {
  width: number;
  height: number;
  boundedWidth: number;
  boundedHeight: number;
  margin: Margin;
}

const defaultMargin: Margin = { top: 20, right: 30, bottom: 40, left: 60 };

export function useChartDimensions(
  margin: Margin = defaultMargin
): [React.RefObject<HTMLDivElement>, ChartDimensions] {
  const ref = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<ChartDimensions>({
    width: 0,
    height: 0,
    boundedWidth: 0,
    boundedHeight: 0,
    margin,
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({
        width,
        height,
        boundedWidth: Math.max(width - margin.left - margin.right, 0),
        boundedHeight: Math.max(height - margin.top - margin.bottom, 0),
        margin,
      });
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [margin.top, margin.right, margin.bottom, margin.left]);

  return [ref, dimensions];
}
