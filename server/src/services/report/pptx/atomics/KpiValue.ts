/**
 * Atomic: KPI Value
 * Large, bold numeric value — the hero number in a KPI tile.
 */
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface KpiValueProps {
  value: number | string;
  unit?: string;
  color?: string;
  position: ElementPosition;
}

export function KpiValue(props: KpiValueProps, tokens: DesignTokens): RenderedElement {
  const displayText = props.unit ? `${props.value}${props.unit}` : String(props.value);

  return {
    kind: 'text',
    apply(slide) {
      slide.addText(displayText, {
        x: props.position.x,
        y: props.position.y,
        w: props.position.w,
        h: props.position.h,
        fontSize: tokens.fontSizes.kpiValue,
        fontFace: tokens.fonts.title,
        color: props.color ?? tokens.colors.primary,
        bold: true,
        align: 'center',
        valign: 'middle',
        // Długie liczby walutowe („609 368 EUR") muszą zmieścić się w kafelku
        // na JEDNEJ linii — bez tego zawijały się i nachodziły na sąsiednie pola.
        fit: 'shrink',
        breakLine: false,
        wrap: false,
      });
    },
  };
}
