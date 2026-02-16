/**
 * Layout: Single Insight Chart
 * One data-driven insight — chart left, analysis right.
 */
import { Footnote } from '../atomics/Footnote.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import { SingleInsightChart } from '../composites/SingleInsightChart.js';
import type {
  DesignTokens,
  LayoutResult,
  SingleInsightContent,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

export function SingleInsightLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
): LayoutResult {
  const c = slide.content as SingleInsightContent;
  const elements = [];
  const g = tokens.grid;

  elements.push(HeaderBar({}, tokens));
  elements.push(SlideTitle({ text: slide.key_message }, tokens));
  elements.push(PageNumber({}, tokens));

  const chartElements = SingleInsightChart(
    {
      chartType: c.chart_type,
      chartData: c.chart_data,
      insightText: c.insight_text,
      source: c.source,
      position: { x: g.contentX, y: g.contentY, w: g.contentW, h: g.contentH },
    },
    tokens
  );
  elements.push(...chartElements);

  elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));

  return { masterName: 'BLANK', elements };
}
