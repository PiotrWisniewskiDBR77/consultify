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
      slide.slideNumber = {
        x: '92%',
        y: '94%',
        fontFace: tokens.fonts.body,
        fontSize: tokens.fontSizes.footnote,
        color: props.color ?? tokens.colors.muted,
      };
    },
  };
}
