/**
 * Atomic: Trend Indicator
 * Up/down/flat arrow with optional delta text.
 */
import { trendColor } from '../designTokens.js';
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface TrendIndicatorProps {
  trend: 'up' | 'down' | 'flat';
  delta?: number | string;
  position: ElementPosition;
}

const ARROWS: Record<string, string> = {
  up: '\u25B2', // ▲
  down: '\u25BC', // ▼
  flat: '\u25C6', // ◆
};

export function TrendIndicator(props: TrendIndicatorProps, tokens: DesignTokens): RenderedElement {
  const color = trendColor(props.trend, tokens);
  const symbol = ARROWS[props.trend];

  // A delta of zero ("0", "0.0", "+0 pp") carries no information — showing
  // "◆ 0" reads as broken. Treat it as "no change": render an em dash instead of
  // the arrow+zero. A real, non-zero delta renders "▲ +38%" as before.
  const deltaStr = props.delta != null ? String(props.delta).trim() : '';
  const isZeroDelta =
    deltaStr !== '' && /^[+-]?0(?:[.,]0+)?\s*(?:p\.?\s*p\.?|%|pts?)?$/i.test(deltaStr);
  let label: string;
  if (deltaStr !== '' && !isZeroDelta) {
    label = `${symbol} ${deltaStr}`;
  } else if (props.trend === 'flat') {
    label = '—'; // em dash — no change
  } else {
    label = symbol;
  }

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
