/**
 * Atomic: Badge
 * Small rounded label — priority, status, category tags.
 */
import { isDeckOverflowWarningEnabled } from '../../../../config/FeatureFlags.js';
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface BadgeProps {
  text: string;
  position: ElementPosition;
  bgColor?: string;
  textColor?: string;
}

export function Badge(props: BadgeProps, tokens: DesignTokens): RenderedElement {
  return {
    kind: 'text',
    apply(slide) {
      slide.addShape('roundRect', {
        x: props.position.x,
        y: props.position.y,
        w: props.position.w,
        h: props.position.h,
        fill: { color: props.bgColor ?? tokens.colors.primary },
        rectRadius: 0.08,
      });

      slide.addText(props.text.toUpperCase(), {
        x: props.position.x,
        y: props.position.y,
        w: props.position.w,
        h: props.position.h,
        fontSize: 8,
        fontFace: tokens.fonts.body,
        color: props.textColor ?? tokens.colors.textInverse,
        bold: true,
        align: 'center',
        valign: 'middle',
        // A badge label is a single token ("CRITICAL", "HIGH") — never wrap it
        // onto two lines ("CRITICA/L"). Keep it on one line and shrink to fit if
        // the pill is narrow.
        wrap: false,
        ...(isDeckOverflowWarningEnabled() ? {} : { fit: 'shrink' as const }),
      });
    },
  };
}
