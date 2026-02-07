/**
 * Atomic: Source Tag
 * Small "Source: ..." label — data provenance for charts and insights.
 */
import type { DesignTokens, RenderedElement, ElementPosition } from '../types.js';

export interface SourceTagProps {
  source: string;
  position?: Partial<ElementPosition>;
}

export function SourceTag(props: SourceTagProps, tokens: DesignTokens): RenderedElement {
  const pos: ElementPosition = {
    x: props.position?.x ?? tokens.grid.contentX,
    y: props.position?.y ?? (tokens.grid.footerY - 0.3),
    w: props.position?.w ?? 5,
    h: props.position?.h ?? 0.25,
  };

  return {
    kind: 'text',
    apply(slide) {
      slide.addText(`Source: ${props.source}`, {
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
