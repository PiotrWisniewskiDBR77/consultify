/**
 * Atomic: Progress Bar
 * Horizontal bar showing percentage completion.
 */
import type { DesignTokens, RenderedElement, ElementPosition } from '../types.js';

export interface ProgressBarProps {
  value: number;       // 0–100
  position: ElementPosition;
  fillColor?: string;
  bgColor?: string;
}

export function ProgressBar(props: ProgressBarProps, tokens: DesignTokens): RenderedElement {
  const pct = Math.min(Math.max(props.value, 0), 100) / 100;

  return {
    kind: 'shape',
    apply(slide) {
      // Background track
      slide.addShape('rect', {
        x: props.position.x,
        y: props.position.y,
        w: props.position.w,
        h: props.position.h,
        fill: { color: props.bgColor ?? tokens.colors.border },
        rectRadius: 0.04,
      });

      // Filled portion
      if (pct > 0) {
        slide.addShape('rect', {
          x: props.position.x,
          y: props.position.y,
          w: props.position.w * pct,
          h: props.position.h,
          fill: { color: props.fillColor ?? tokens.colors.primary },
          rectRadius: 0.04,
        });
      }
    },
  };
}
