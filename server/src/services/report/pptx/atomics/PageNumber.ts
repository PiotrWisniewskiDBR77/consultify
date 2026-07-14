/**
 * Atomic: Page Number
 * Slide number indicator in the footer area.
 */
import type { DesignTokens, RenderedElement } from '../types.js';

export interface PageNumberProps {
  color?: string;
}

export function PageNumber(props: PageNumberProps, tokens: DesignTokens): RenderedElement {
  return {
    kind: 'text',
    apply(slide) {
      // Right-aligned in an explicit box that ends at 98% of the slide width, so
      // the number never overflows the right edge. Without an explicit `w` the
      // default slide-number box started at 92% and ran ~0.07" past the slide.
      slide.slideNumber = {
        x: '88%',
        y: '94%',
        w: '10%',
        h: '4%',
        align: 'right',
        fontFace: tokens.fonts.body,
        fontSize: tokens.fontSizes.footnote,
        color: props.color ?? tokens.colors.muted,
      };
    },
  };
}
