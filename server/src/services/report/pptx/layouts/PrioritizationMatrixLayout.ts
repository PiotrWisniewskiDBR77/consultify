/**
 * Layout: Prioritization Matrix
 * 2×2 quadrant grid showing items positioned by impact vs effort.
 *
 * Quadrants:
 * - top_left:     High Impact / Low Effort   → "Quick Wins"
 * - top_right:    High Impact / High Effort   → "Major Projects"
 * - bottom_left:  Low Impact / Low Effort     → "Fill-ins"
 * - bottom_right: Low Impact / High Effort    → "Reconsider"
 */
import { Badge } from '../atomics/Badge.js';
import { BodyText } from '../atomics/BodyText.js';
import { Footnote } from '../atomics/Footnote.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import { distributeY } from '../composites/verticalRhythm.js';
import type {
  DesignTokens,
  LayoutResult,
  PrioritizationMatrixContent,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

// Quadrant colors
const QUADRANT_COLORS: Record<string, string> = {
  top_left: 'DCFCE7', // green-100
  top_right: 'FEF3C7', // amber-100
  bottom_left: 'DBEAFE', // blue-100
  bottom_right: 'FEE2E2', // red-100
};

const QUADRANT_POSITIONS: Record<string, { col: number; row: number }> = {
  top_left: { col: 0, row: 0 },
  top_right: { col: 1, row: 0 },
  bottom_left: { col: 0, row: 1 },
  bottom_right: { col: 1, row: 1 },
};

export function PrioritizationMatrixLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
): LayoutResult {
  const c = slide.content as PrioritizationMatrixContent;
  const elements = [];
  const g = tokens.grid;

  // ── Chrome ──
  elements.push(HeaderBar({}, tokens));
  elements.push(
    SlideTitle(
      {
        text:
          slide.key_message ||
          (meta.language === 'pl' ? 'Matryca Priorytetów' : 'Prioritization Matrix'),
      },
      tokens
    )
  );
  elements.push(PageNumber({}, tokens));

  // ── Axes labels ──
  const axisLabelGap = 0.35;
  const matrixX = g.contentX + axisLabelGap;
  const matrixY = g.contentY;
  const matrixW = g.contentW - axisLabelGap;
  const matrixH = g.contentH - 0.25; // leave room for X-axis label

  // Y-axis label rotated as one readable word, rather than wrapped character-by-character.
  elements.push(
    BodyText(
      {
        text: c.yAxisLabel || 'Impact',
        position: { x: g.contentX, y: matrixY, w: axisLabelGap - 0.05, h: matrixH },
        bold: true,
        fontSize: 10,
        color: tokens.colors.textSecondary,
        align: 'center',
        valign: 'middle',
        vertical: 'vert270',
      },
      tokens
    )
  );

  // X-axis label (bottom center)
  elements.push(
    BodyText(
      {
        text: c.xAxisLabel || 'Effort',
        position: { x: matrixX + matrixW / 2 - 1, y: matrixY + matrixH + 0.05, w: 2, h: 0.2 },
        bold: true,
        fontSize: 10,
        color: tokens.colors.textSecondary,
      },
      tokens
    )
  );

  // ── Quadrant cells ──
  const gutter = 0.08;
  const cellW = (matrixW - gutter) / 2;
  const cellH = (matrixH - gutter) / 2;
  const quadrants = c.quadrants || [];

  for (const quad of quadrants) {
    const pos = QUADRANT_POSITIONS[quad.position];
    if (!pos) continue;

    const cx = matrixX + pos.col * (cellW + gutter);
    const cy = matrixY + pos.row * (cellH + gutter);
    const bgColor = QUADRANT_COLORS[quad.position] || tokens.colors.surface;

    // Quadrant background
    elements.push({
      kind: 'shape' as const,
      apply(slide: any) {
        slide.addShape('roundRect', {
          x: cx,
          y: cy,
          w: cellW,
          h: cellH,
          fill: { color: bgColor },
          rectRadius: 0.08,
        });
      },
    });

    // Quadrant label
    elements.push(
      BodyText(
        {
          text: quad.label,
          position: { x: cx + 0.1, y: cy + 0.06, w: cellW - 0.2, h: 0.22 },
          bold: true,
          fontSize: 11,
          color: tokens.colors.textPrimary,
        },
        tokens
      )
    );

    // Items inside quadrant — distribute across the cell so they breathe and
    // fill the quadrant height instead of clinging to the top (W7).
    const maxItems = Math.min(quad.items.length, 6);
    const hasOverflow = quad.items.length > maxItems;
    // Item region: below the quadrant label, with bottom padding.
    const itemsRegionY = cy + 0.34;
    const itemsRegionH = cellH - 0.34 - 0.1 - (hasOverflow ? 0.2 : 0);
    const itemH = 0.26;
    const slots = maxItems;
    const itemYs =
      slots > 0
        ? distributeY({ y: itemsRegionY, h: itemsRegionH }, Array(slots).fill(itemH), 'fill', 0.06)
        : [];
    for (let i = 0; i < maxItems; i++) {
      elements.push(
        Badge(
          {
            text: quad.items[i].name,
            position: { x: cx + 0.12, y: itemYs[i], w: cellW - 0.24, h: itemH },
            bgColor: tokens.colors.primary,
            textColor: tokens.colors.textInverse,
          },
          tokens
        )
      );
    }

    // Overflow indicator
    if (hasOverflow) {
      elements.push(
        BodyText(
          {
            text: `+${quad.items.length - maxItems} more`,
            position: {
              x: cx + 0.12,
              y: cy + cellH - 0.26,
              w: cellW - 0.24,
              h: 0.18,
            },
            color: tokens.colors.muted,
            fontSize: 8,
          },
          tokens
        )
      );
    }
  }

  elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));

  return { masterName: 'BLANK', elements };
}
