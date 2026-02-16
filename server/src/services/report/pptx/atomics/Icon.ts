/**
 * Atomic: Icon
 * Unicode icon/emoji rendered as text — lightweight, no image dependency.
 */
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface IconProps {
  icon: string; // Unicode char, e.g. '✓', '⚠', '●'
  position: ElementPosition;
  color?: string;
  fontSize?: number;
}

/** Common icon set for consulting slides */
export const ICONS = {
  check: '\u2713', // ✓
  cross: '\u2717', // ✗
  warning: '\u26A0', // ⚠
  arrow_right: '\u2192', // →
  arrow_up: '\u2191', // ↑
  arrow_down: '\u2193', // ↓
  bullet: '\u25CF', // ●
  diamond: '\u25C6', // ◆
  star: '\u2605', // ★
  clock: '\u23F0', // ⏰
  target: '\u25CE', // ◎
  lock: '\u{1F512}', // 🔒
} as const;

export function Icon(props: IconProps, tokens: DesignTokens): RenderedElement {
  return {
    kind: 'text',
    apply(slide) {
      slide.addText(props.icon, {
        x: props.position.x,
        y: props.position.y,
        w: props.position.w,
        h: props.position.h,
        fontSize: props.fontSize ?? tokens.fontSizes.heading,
        fontFace: tokens.fonts.body,
        color: props.color ?? tokens.colors.primary,
        align: 'center',
        valign: 'middle',
      });
    },
  };
}
