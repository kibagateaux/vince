/**
 * @module useD3
 * Core D3 + React integration hook
 */

import { useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';

type D3Selection = d3.Selection<SVGSVGElement, unknown, null, undefined>;

interface UseD3Options {
  dependencies?: unknown[];
  onResize?: boolean;
}

export function useD3(
  renderFn: (svg: D3Selection) => void | (() => void),
  options: UseD3Options = {}
): React.RefObject<SVGSVGElement> {
  const ref = useRef<SVGSVGElement>(null);
  const { dependencies = [], onResize = true } = options;

  const render = useCallback(() => {
    if (!ref.current) return;
    const svg = d3.select(ref.current);
    svg.selectAll('*').remove();
    return renderFn(svg);
  }, [renderFn]);

  useEffect(() => {
    const cleanup = render();
    return () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, render]);

  useEffect(() => {
    if (!onResize) return;

    const observer = new ResizeObserver(() => {
      render();
    });

    if (ref.current?.parentElement) {
      observer.observe(ref.current.parentElement);
    }

    return () => observer.disconnect();
  }, [render, onResize]);

  return ref;
}
