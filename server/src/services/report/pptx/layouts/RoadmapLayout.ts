/**
 * Layout: Roadmap
 * Sequenced plan — horizontal phase bands (Now/Next/Later).
 */
import type { DesignTokens, LayoutResult, UnifiedSlide, UnifiedReportMeta, RoadmapContent } from '../types.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { Footnote } from '../atomics/Footnote.js';
import { RoadmapBand } from '../composites/RoadmapBand.js';

export function RoadmapLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
): LayoutResult {
  const c = slide.content as RoadmapContent;
  const elements = [];
  const g = tokens.grid;

  elements.push(HeaderBar({}, tokens));
  elements.push(SlideTitle({ text: slide.key_message || (meta.language === 'pl' ? 'Plan Działania' : 'Roadmap') }, tokens));
  elements.push(PageNumber({}, tokens));

  const bandElements = RoadmapBand({
    phases: c.phases,
    position: { x: g.contentX, y: g.contentY, w: g.contentW, h: g.contentH },
  }, tokens);
  elements.push(...bandElements);

  elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));

  return { masterName: 'BLANK', elements };
}
