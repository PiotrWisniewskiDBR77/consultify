/**
 * Atomic: Highlight
 * A colored box with bold text — used for key stats, impact callouts.
 */
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface HighlightProps {
  text: string;
  position: ElementPosition;
  bgColor?: string;
  textColor?: string;
  fontSize?: number;
}

export function Highlight(props: HighlightProps, tokens: DesignTokens): RenderedElement {
  return {
    kind: 'text',
    apply(slide) {
      // Background shape
      slide.addShape('rect', {
        x: props.position.x,
        y: props.position.y,
        w: props.position.w,
        h: props.position.h,
        fill: { color: props.bgColor ?? tokens.colors.accent },
        rectRadius: 0.05,
      });

      // Text overlay
      slide.addText(props.text, {
        x: props.position.x,
        y: props.position.y,
        w: props.position.w,
        h: props.position.h,
        fontSize: props.fontSize ?? tokens.fontSizes.body,
        fontFace: tokens.fonts.body,
        color: props.textColor ?? tokens.colors.textInverse,
        bold: true,
        align: 'center',
        valign: 'middle',
        // Długie wartości (np. zakres wyceny) muszą zmieścić się w pasku bez
        // przelewania — kurcz do rozmiaru, jedna linia.
        fit: 'shrink',
        wrap: false,
      });
    },
  };
}
