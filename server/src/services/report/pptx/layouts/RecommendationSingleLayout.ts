/**
 * Layout: Recommendation (Single)
 * One focused recommendation with full detail.
 */
import { Footnote } from '../atomics/Footnote.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import { RecommendationCard } from '../composites/RecommendationCard.js';
import { centerY } from '../composites/verticalRhythm.js';
import type {
  DesignTokens,
  LayoutResult,
  RecommendationSingleContent,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

export function RecommendationSingleLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
): LayoutResult {
  const c = slide.content as RecommendationSingleContent;
  const elements = [];
  const g = tokens.grid;

  elements.push(HeaderBar({}, tokens));
  elements.push(
    SlideTitle(
      { text: slide.key_message || (meta.language === 'pl' ? 'Rekomendacja' : 'Recommendation') },
      tokens
    )
  );
  elements.push(PageNumber({}, tokens));

  // Single recommendation: a substantial card centred vertically in the region
  // so it reads as a deliberate focal point (not clinging to the top, not a
  // full-bleed slab). Tall enough to fill ~85% of the usable height.
  const cardH = Math.min(g.contentH - 0.2, 3.4);
  const cardY = centerY({ y: g.contentY, h: g.contentH }, cardH);
  const cardElements = RecommendationCard(
    {
      title: c.title,
      description: c.description,
      impact: c.impact,
      effort: c.effort,
      priority: c.priority,
      timeline: c.timeline,
      position: {
        x: g.contentX + 0.5,
        y: cardY,
        w: g.contentW - 1,
        h: cardH,
      },
    },
    tokens
  );
  elements.push(...cardElements);

  elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));

  return { masterName: 'BLANK', elements };
}
