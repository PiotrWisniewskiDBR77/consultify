/**
 * Composite: Effort Profile Bar
 * Three stacked mini-bars showing analytical/operational/change effort.
 */
import { MiniBar } from '../atomics/MiniBar.js';
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface EffortProfileBarProps {
  analytical: number; // 1–5
  operational: number; // 1–5
  change: number; // 1–5
  position: ElementPosition;
}

export function EffortProfileBar(
  props: EffortProfileBarProps,
  tokens: DesignTokens
): RenderedElement[] {
  const { position: p } = props;
  const barH = p.h / 3;

  return [
    MiniBar(
      {
        value: props.analytical,
        label: 'Analytical',
        position: { x: p.x, y: p.y, w: p.w, h: barH },
        fillColor: '3B82F6', // blue
      },
      tokens
    ),
    MiniBar(
      {
        value: props.operational,
        label: 'Operational',
        position: { x: p.x, y: p.y + barH, w: p.w, h: barH },
        fillColor: 'F59E0B', // amber
      },
      tokens
    ),
    MiniBar(
      {
        value: props.change,
        label: 'Change',
        position: { x: p.x, y: p.y + barH * 2, w: p.w, h: barH },
        fillColor: '8B5CF6', // purple
      },
      tokens
    ),
  ];
}
