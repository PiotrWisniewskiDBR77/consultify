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

  // Adaptive font size — `fit:'shrink'` (normAutofit) is NOT honoured by
  // LibreOffice for a single over-wide token, so a long value ("PLN 41M") still
  // wrapped character-level in a narrow dashboard tile. Compute an explicit size
  // that fits the string on one line. Advance is estimated per character class
  // (bold title face) so a capital-heavy "PLN 41M" shrinks while a lowercase
  // "21 days"/"24%" keeps the full size (visual consistency across tiles).
  // Shrink-only — never grows past the token.
  const baseFont = tokens.fontSizes.kpiValue;
  const widthPt = props.position.w * 72;
  const advanceOf = (ch: string): number => {
    if (ch === ' ' || ch === ' ') return 0.3;
    if ('mwMW'.includes(ch)) return 0.85;
    if ("iIlj.,:;'|".includes(ch)) return 0.3;
    if (ch >= 'A' && ch <= 'Z') return 0.68;
    if ('%$&@'.includes(ch)) return 0.8;
    return 0.55; // digits + lowercase
  };
  const advanceUnits = [...displayText].reduce((sum, ch) => sum + advanceOf(ch), 0);
  // 0.80 safety margin — calibrated against LibreOffice bold-title rendering
  // (a value that fits at 28pt must not be sized to 34pt and wrap).
  const fitFont = advanceUnits > 0 ? (widthPt / advanceUnits) * 0.8 : baseFont;
  const fontSize = Math.max(16, Math.min(baseFont, Math.floor(fitFont)));

  return {
    kind: 'text',
    apply(slide) {
      slide.addText(displayText, {
        x: props.position.x,
        y: props.position.y,
        w: props.position.w,
        h: props.position.h,
        fontSize,
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
