/**
 * Layout: Recommendation Stack
 * Portfolio of recommendations as a table (3+ items).
 */
import { Footnote } from '../atomics/Footnote.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import { RecommendationStack } from '../composites/RecommendationStack.js';
import type {
  DesignTokens,
  LayoutResult,
  RecommendationPortfolioContent,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

export function RecommendationStackLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
): LayoutResult {
  const c = slide.content as RecommendationPortfolioContent;
  const elements = [];
  const g = tokens.grid;

  elements.push(HeaderBar({}, tokens));
  elements.push(
    SlideTitle(
      {
        text:
          slide.key_message ||
          (meta.language === 'pl' ? 'Portfolio Rekomendacji' : 'Recommendation Portfolio'),
      },
      tokens
    )
  );
  elements.push(PageNumber({}, tokens));

  const stackElements = RecommendationStack(
    {
      recommendations: c.recommendations,
      position: { x: g.contentX, y: g.contentY, w: g.contentW, h: g.contentH },
    },
    tokens
  );
  elements.push(...stackElements);

  elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));

  return { masterName: 'BLANK', elements };
}
