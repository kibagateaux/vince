/**
 * @module transitions
 * D3 transition utilities with reduced motion support
 */

import * as d3 from 'd3';

export function getTransitionDuration(): number {
  if (typeof window === 'undefined') return 0;
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  );
  return prefersReducedMotion.matches ? 0 : 500;
}

export function createTransition<
  GElement extends d3.BaseType,
  Datum,
  PElement extends d3.BaseType,
  PDatum,
>(selection: d3.Selection<GElement, Datum, PElement, PDatum>) {
  const duration = getTransitionDuration();
  return selection.transition().duration(duration).ease(d3.easeCubicOut);
}
