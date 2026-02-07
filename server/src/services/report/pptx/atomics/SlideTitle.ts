/**
 * Atomic: Slide Title
 * Renders the main title text of a slide inside the header bar.
 */
import type { DesignTokens, RenderedElement, ElementPosition } from '../types.js';

export interface SlideTitleProps {
  text: string;
  position?: Partial<ElementPosition>;
}

export function SlideTitle(props: SlideTitleProps, tokens: DesignTokens): RenderedElement {
  const pos: ElementPosition = {
    x: props.position?.x ?? tokens.grid.contentX,
    y: props.position?.y ?? 0.15,
    w: props.position?.w ?? tokens.grid.contentW,
    h: props.position?.h ?? 0.5,
  };

  return {
    kind: 'text',
    apply(slide) {
      slide.addText(props.text, {
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
        fontSize: tokens.fontSizes.slideTitle,
        fontFace: tokens.fonts.title,
        color: tokens.colors.textInverse,
        bold: true,
      });
    },
  };
}
