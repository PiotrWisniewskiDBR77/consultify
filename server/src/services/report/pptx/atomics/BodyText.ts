/**
 * Atomic: Body Text
 * Standard paragraph text with optional bold/italic.
 */
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface BodyTextProps {
  text: string;
  position: ElementPosition;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  fontSize?: number;
  align?: 'left' | 'center' | 'right';
  valign?: 'top' | 'middle' | 'bottom';
}

export function BodyText(props: BodyTextProps, tokens: DesignTokens): RenderedElement {
  return {
    kind: 'text',
    apply(slide) {
      slide.addText(props.text, {
        x: props.position.x,
        y: props.position.y,
        w: props.position.w,
        h: props.position.h,
        fontSize: props.fontSize ?? tokens.fontSizes.body,
        fontFace: tokens.fonts.body,
        color: props.color ?? tokens.colors.textPrimary,
        bold: props.bold ?? false,
        italic: props.italic ?? false,
        align: props.align ?? 'left',
        valign: props.valign ?? 'top',
      });
    },
  };
}
