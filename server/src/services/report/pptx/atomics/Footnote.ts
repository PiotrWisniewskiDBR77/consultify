/**
 * Atomic: Footnote
 * Small text at the bottom of a slide — source, disclaimer, note.
 */
import type { DesignTokens, RenderedElement, ElementPosition } from '../types.js';

export interface FootnoteProps {
  text: string;
  position?: Partial<ElementPosition>;
}

export function Footnote(props: FootnoteProps, tokens: DesignTokens): RenderedElement {
  const pos: ElementPosition = {
    x: props.position?.x ?? tokens.grid.contentX,
    y: props.position?.y ?? tokens.grid.footerY,
    w: props.position?.w ?? 6,
    h: props.position?.h ?? 0.3,
  };

  return {
    kind: 'text',
    apply(slide) {
      slide.addText(props.text, {
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
        fontSize: tokens.fontSizes.footnote,
        fontFace: tokens.fonts.body,
        color: tokens.colors.muted,
        italic: true,
      });
    },
  };
}
