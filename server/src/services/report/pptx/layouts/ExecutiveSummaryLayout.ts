/**
 * Layout: Executive Summary
 * Board-level synthesis — headline, optional KPIs, key findings.
 */
import type { DesignTokens, LayoutResult, UnifiedSlide, UnifiedReportMeta, ExecutiveSummaryContent } from '../types.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { Footnote } from '../atomics/Footnote.js';
import { ExecutiveSummaryPanel } from '../composites/ExecutiveSummaryPanel.js';

export function ExecutiveSummaryLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
): LayoutResult {
  const c = slide.content as ExecutiveSummaryContent;
  const elements = [];

  elements.push(HeaderBar({}, tokens));
  elements.push(SlideTitle({ text: meta.language === 'pl' ? 'Podsumowanie Wykonawcze' : 'Executive Summary' }, tokens));
  elements.push(PageNumber({}, tokens));

  // Main panel
  const panelElements = ExecutiveSummaryPanel({
    headline: c.headline,
    kpis: c.kpis,
    keyFindings: c.key_findings,
    recommendation: c.recommendation,
    position: {
      x: tokens.grid.contentX,
      y: tokens.grid.contentY,
      w: tokens.grid.contentW,
      h: tokens.grid.contentH,
    },
  }, tokens);
  elements.push(...panelElements);

  // Footer
  elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));

  return { masterName: 'BLANK', elements };
}
