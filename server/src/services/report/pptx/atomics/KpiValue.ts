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
  // Word units ("days", "months") need a space after the number ("21 days"), but
  // symbol units ("%", "pp") stay glued ("38%"). Without this a word unit rendered
  // as "21days".
  const needsSpace = !!props.unit && /^[A-Za-z]/.test(props.unit);
  const rawText = props.unit
    ? `${props.value}${needsSpace ? ' ' : ''}${props.unit}`
    : String(props.value);
  // Multi-token values ("PLN 41M", "21 days") must stay on ONE line inside the
  // tile — convert every space to a non-breaking space so LibreOffice/PowerPoint
  // can't wrap at it; `fit: 'shrink'` below then scales the single line to width.
  const displayText = rawText.replace(/ /g, ' ');

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
