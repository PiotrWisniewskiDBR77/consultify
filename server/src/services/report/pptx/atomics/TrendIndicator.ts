/**
 * Atomic: Trend Indicator
 * Up/down/flat arrow with optional delta text.
 */
import type { DesignTokens, RenderedElement, ElementPosition } from '../types.js';
import { trendColor } from '../designTokens.js';

export interface TrendIndicatorProps {
  trend: 'up' | 'down' | 'flat';
  delta?: number | string;
  position: ElementPosition;
}

const ARROWS: Record<string, string> = {
  up: '\u25B2',     // ▲
  down: '\u25BC',   // ▼
  flat: '\u25C6',   // ◆
};

export function TrendIndicator(props: TrendIndicatorProps, tokens: DesignTokens): RenderedElement {
  const color = trendColor(props.trend, tokens);
  const symbol = ARROWS[props.trend];
  const label = props.delta != null ? `${symbol} ${props.delta}` : symbol;

  return {
    kind: 'text',
    apply(slide) {
      slide.addText(label, {
        x: props.position.x,
        y: props.position.y,
        w: props.position.w,
        h: props.position.h,
        fontSize: tokens.fontSizes.caption,
        fontFace: tokens.fonts.body,
        color,
        align: 'center',
        valign: 'middle',
      });
    },
  };
}
