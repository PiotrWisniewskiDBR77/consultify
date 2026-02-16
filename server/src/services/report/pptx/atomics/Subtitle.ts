/**
 * Atomic: Subtitle
 * Secondary heading text — used below titles, in intros, etc.
 */
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface SubtitleProps {
  text: string;
  color?: string;
  position?: Partial<ElementPosition>;
}

export function Subtitle(props: SubtitleProps, tokens: DesignTokens): RenderedElement {
  const pos: ElementPosition = {
    x: props.position?.x ?? tokens.grid.contentX,
    y: props.position?.y ?? 0.55,
    w: props.position?.w ?? tokens.grid.contentW,
    h: props.position?.h ?? 0.4,
  };

  return {
    kind: 'text',
    apply(slide) {
      slide.addText(props.text, {
        x: pos.x,
        y: pos.y,
        w: pos.w,
        h: pos.h,
        fontSize: tokens.fontSizes.subheading,
        fontFace: tokens.fonts.body,
        color: props.color ?? tokens.colors.textSecondary,
      });
    },
  };
}
