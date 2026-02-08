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
import type {
  DesignTokens,
  LayoutResult,
  UnifiedSlide,
  UnifiedReportMeta,
  PrioritizationMatrixContent,
} from '../types.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { Footnote } from '../atomics/Footnote.js';
import { BodyText } from '../atomics/BodyText.js';
import { Badge } from '../atomics/Badge.js';

// Quadrant colors
const QUADRANT_COLORS: Record<string, string> = {
  top_left: 'DCFCE7',      // green-100
  top_right: 'FEF3C7',     // amber-100
  bottom_left: 'DBEAFE',   // blue-100
  bottom_right: 'FEE2E2',  // red-100
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
    SlideTitle({
      text: slide.key_message || (meta.language === 'pl' ? 'Matryca Priorytetów' : 'Prioritization Matrix'),
    }, tokens)
  );
  elements.push(PageNumber({}, tokens));

  // ── Axes labels ──
  const axisLabelGap = 0.35;
  const matrixX = g.contentX + axisLabelGap;
  const matrixY = g.contentY;
  const matrixW = g.contentW - axisLabelGap;
  const matrixH = g.contentH - 0.25;  // leave room for X-axis label

  // Y-axis label (rotated concept — just place vertically on the left)
  elements.push(
    BodyText({
      text: c.yAxisLabel || 'Impact',
      position: { x: g.contentX, y: matrixY + matrixH / 2 - 0.2, w: axisLabelGap - 0.05, h: 0.4 },
      bold: true,
      fontSize: 10,
      color: tokens.colors.textSecondary,
    }, tokens)
  );

  // X-axis label (bottom center)
  elements.push(
    BodyText({
      text: c.xAxisLabel || 'Effort',
      position: { x: matrixX + matrixW / 2 - 1, y: matrixY + matrixH + 0.05, w: 2, h: 0.2 },
      bold: true,
      fontSize: 10,
      color: tokens.colors.textSecondary,
    }, tokens)
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
      BodyText({
        text: quad.label,
        position: { x: cx + 0.1, y: cy + 0.06, w: cellW - 0.2, h: 0.22 },
        bold: true,
        fontSize: 11,
        color: tokens.colors.textPrimary,
      }, tokens)
    );

    // Items inside quadrant
    const maxItems = Math.min(quad.items.length, 5);
    const itemH = 0.2;
    for (let i = 0; i < maxItems; i++) {
      const itemY = cy + 0.32 + i * (itemH + 0.04);
      elements.push(
        Badge({
          text: quad.items[i].name,
          position: { x: cx + 0.12, y: itemY, w: cellW - 0.24, h: itemH },
          bgColor: tokens.colors.primary,
          textColor: tokens.colors.textInverse,
        }, tokens)
      );
    }

    // Overflow indicator
    if (quad.items.length > maxItems) {
      elements.push(
        BodyText({
          text: `+${quad.items.length - maxItems} more`,
          position: { x: cx + 0.12, y: cy + 0.32 + maxItems * (itemH + 0.04), w: cellW - 0.24, h: 0.15 },
          color: tokens.colors.muted,
          fontSize: 8,
        }, tokens)
      );
    }
  }

  elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));

  return { masterName: 'BLANK', elements };
}
