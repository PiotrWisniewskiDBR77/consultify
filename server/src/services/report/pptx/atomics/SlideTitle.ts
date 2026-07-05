/**
 * Atomic: Slide Title
 * Renders the main title text of a slide inside the header bar.
 */
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface SlideTitleProps {
  text: string;
  position?: Partial<ElementPosition>;
}

export function SlideTitle(props: SlideTitleProps, tokens: DesignTokens): RenderedElement {
  // Action-titles (the slide thesis) are frequently 2 lines. The box is sized to
  // hold two lines centred inside the header band, and `fit: 'shrink'` guarantees
  // a long title auto-scales down instead of overflowing/clipping at the slide
  // top edge (the bug long action-titles exposed). Single-line titles render at
  // full size.
  const pos: ElementPosition = {
    x: props.position?.x ?? tokens.grid.contentX,
    y: props.position?.y ?? 0.1,
    w: props.position?.w ?? tokens.grid.contentW,
    h: props.position?.h ?? 0.72,
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
        valign: 'middle',
        wrap: true,
        fit: 'shrink',
        lineSpacingMultiple: 0.9,
      });
    },
  };
}
