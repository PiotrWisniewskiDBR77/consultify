/**
 * Layout: Comparison
 * A vs B / Before vs After side-by-side.
 */
import { Footnote } from '../atomics/Footnote.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import { ComparisonChart } from '../composites/ComparisonChart.js';
import type {
  ComparisonContent,
  DesignTokens,
  LayoutResult,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

export function ComparisonLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
): LayoutResult {
  const c = slide.content as ComparisonContent;
  const elements = [];
  const g = tokens.grid;

  elements.push(HeaderBar({}, tokens));
  elements.push(SlideTitle({ text: slide.key_message }, tokens));
  elements.push(PageNumber({}, tokens));

  const compElements = ComparisonChart(
    {
      leftLabel: c.left_label,
      rightLabel: c.right_label,
      leftItems: c.left_items,
      rightItems: c.right_items,
      verdict: c.verdict,
      position: { x: g.contentX, y: g.contentY, w: g.contentW, h: g.contentH },
    },
    tokens
  );
  elements.push(...compElements);

  elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));

  return { masterName: 'BLANK', elements };
}
