/**
 * Atomic: Bullet List
 * Renders a list of items as bullet points (max 5 per spec).
 */
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface BulletProps {
  items: string[];
  position: ElementPosition;
  color?: string;
  fontSize?: number;
  bulletColor?: string;
}

export function Bullet(props: BulletProps, tokens: DesignTokens): RenderedElement {
  return {
    kind: 'text',
    apply(slide) {
      const textRows = props.items.map((item) => ({
        text: item,
        options: {
          fontSize: props.fontSize ?? tokens.fontSizes.body,
          fontFace: tokens.fonts.body,
          color: props.color ?? tokens.colors.textPrimary,
          bullet: { type: 'bullet' as const, color: props.bulletColor ?? tokens.colors.primary },
          paraSpaceAfter: tokens.spacing.paragraphGap,
        },
      }));

      slide.addText(textRows, {
        x: props.position.x,
        y: props.position.y,
        w: props.position.w,
        h: props.position.h,
        // Lists read top-down: anchor to the top of the box. Without this
        // pptxgenjs centres the rows vertically, leaving a large gap between a
        // header and a short list (the disconnected-roadmap bug).
        valign: 'top',
      });
    },
  };
}
