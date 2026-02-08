/**
 * Layout: Heatmap / Maturity Matrix
 * Assessment visualization with color-coded scores.
 */
import { Footnote } from '../atomics/Footnote.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import { Heatmap } from '../composites/Heatmap.js';
import type {
  AssessmentContent,
  DesignTokens,
  LayoutResult,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

export function HeatmapLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
): LayoutResult {
  const c = slide.content as AssessmentContent;
  const elements = [];
  const g = tokens.grid;

  elements.push(HeaderBar({}, tokens));
  elements.push(
    SlideTitle(
      {
        text:
          slide.key_message ||
          (meta.language === 'pl' ? 'Ocena Dojrzałości' : 'Maturity Assessment'),
      },
      tokens
    )
  );
  elements.push(PageNumber({}, tokens));

  const heatmapElements = Heatmap(
    {
      axes: c.axes,
      scaleMax: c.scale_max,
      overallScore: c.overall_score,
      position: { x: g.contentX, y: g.contentY + 0.2, w: g.contentW, h: g.contentH - 0.3 },
    },
    tokens
  );
  elements.push(...heatmapElements);

  elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));

  return { masterName: 'BLANK', elements };
}
