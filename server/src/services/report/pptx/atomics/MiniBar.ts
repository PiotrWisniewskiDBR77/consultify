/**
 * Atomic: Mini Bar
 * Thin horizontal bar with optional label.
 * Used for effort profiles, skill levels, small metrics.
 */
import type { DesignTokens, RenderedElement, ElementPosition } from '../types.js';

export interface MiniBarProps {
  value: number;        // 0–maxValue
  maxValue?: number;    // default 5
  position: ElementPosition;
  label?: string;
  fillColor?: string;
  bgColor?: string;
  showValueText?: boolean;
}

export function MiniBar(props: MiniBarProps, tokens: DesignTokens): RenderedElement {
  const max = props.maxValue ?? 5;
  const pct = Math.min(Math.max(props.value / max, 0), 1);

  return {
    kind: 'shape',
    apply(slide) {
      let barX = props.position.x;
      let barW = props.position.w;

      // Optional label on the left
      if (props.label) {
        const labelW = Math.min(props.position.w * 0.35, 0.65);
        slide.addText(props.label, {
          x: props.position.x,
          y: props.position.y,
          w: labelW,
          h: props.position.h,
          fontSize: 7,
          fontFace: tokens.fonts.body,
          color: tokens.colors.textSecondary,
          valign: 'middle',
        });
        barX = props.position.x + labelW + 0.03;
        barW = props.position.w - labelW - 0.03;
      }

      const barH = Math.min(props.position.h * 0.5, 0.08);
      const barY = props.position.y + (props.position.h - barH) / 2;

      // Background track
      slide.addShape('rect', {
        x: barX,
        y: barY,
        w: barW,
        h: barH,
        fill: { color: props.bgColor ?? tokens.colors.border },
        rectRadius: 0.03,
      });

      // Fill
      if (pct > 0) {
        slide.addShape('rect', {
          x: barX,
          y: barY,
          w: barW * pct,
          h: barH,
          fill: { color: props.fillColor ?? tokens.colors.primary },
          rectRadius: 0.03,
        });
      }

      // Value text on the right
      if (props.showValueText) {
        slide.addText(`${props.value}/${max}`, {
          x: barX + barW + 0.03,
          y: props.position.y,
          w: 0.35,
          h: props.position.h,
          fontSize: 7,
          fontFace: tokens.fonts.body,
          color: tokens.colors.textSecondary,
          valign: 'middle',
        });
      }
    },
  };
}
