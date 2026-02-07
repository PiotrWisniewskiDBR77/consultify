/**
 * Atomic: KPI Label
 * Small label text beneath a KPI value.
 */
import type { DesignTokens, RenderedElement, ElementPosition } from '../types.js';

export interface KpiLabelProps {
  text: string;
  position: ElementPosition;
  color?: string;
}

export function KpiLabel(props: KpiLabelProps, tokens: DesignTokens): RenderedElement {
  return {
    kind: 'text',
    apply(slide) {
      slide.addText(props.text, {
        x: props.position.x,
        y: props.position.y,
        w: props.position.w,
        h: props.position.h,
        fontSize: tokens.fontSizes.kpiLabel,
        fontFace: tokens.fonts.body,
        color: props.color ?? tokens.colors.textSecondary,
        align: 'center',
        valign: 'top',
      });
    },
  };
}
