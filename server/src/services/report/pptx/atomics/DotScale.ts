/**
 * Atomic: Dot Scale
 * Horizontal row of filled/empty dots (1–5 scale).
 * Used for impact, effort, confidence indicators.
 */
import type { DesignTokens, RenderedElement, ElementPosition } from '../types.js';

export interface DotScaleProps {
  value: number;        // 1–5
  maxValue?: number;    // default 5
  position: ElementPosition;
  label?: string;
  fillColor?: string;
  emptyColor?: string;
}

export function DotScale(props: DotScaleProps, tokens: DesignTokens): RenderedElement {
  const max = props.maxValue ?? 5;
  const val = Math.min(Math.max(Math.round(props.value), 0), max);
  const dotSize = Math.min(props.position.h, 0.14);
  const gap = 0.05;
  const totalDotsW = max * dotSize + (max - 1) * gap;

  return {
    kind: 'shape',
    apply(slide) {
      // Optional label
      let dotsStartX = props.position.x;
      if (props.label) {
        const labelW = Math.min(props.position.w * 0.45, 0.8);
        slide.addText(props.label, {
          x: props.position.x,
          y: props.position.y,
          w: labelW,
          h: props.position.h,
          fontSize: 8,
          fontFace: tokens.fonts.body,
          color: tokens.colors.textSecondary,
          valign: 'middle',
        });
        dotsStartX = props.position.x + labelW + 0.05;
      }

      // Dots
      const dotY = props.position.y + (props.position.h - dotSize) / 2;
      for (let i = 0; i < max; i++) {
        const filled = i < val;
        slide.addShape('ellipse', {
          x: dotsStartX + i * (dotSize + gap),
          y: dotY,
          w: dotSize,
          h: dotSize,
          fill: { color: filled ? (props.fillColor ?? tokens.colors.primary) : (props.emptyColor ?? tokens.colors.border) },
        });
      }
    },
  };
}
