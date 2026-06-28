/**
 * Layout: Executive Summary
 * Board-level synthesis — headline, optional KPIs, key findings.
 */
import { Footnote } from '../atomics/Footnote.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { Image } from '../atomics/Image.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import { ExecutiveSummaryPanel } from '../composites/ExecutiveSummaryPanel.js';
import type {
  DesignTokens,
  ExecutiveSummaryContent,
  LayoutResult,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

export function ExecutiveSummaryLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
): LayoutResult {
  const c = slide.content as ExecutiveSummaryContent;
  const elements = [];

  // Optional right-side illustration (render first, behind panel)
  const side = (slide.visuals || []).find((v) => v && v.slot === 'side_illustration');
  const asset = side?.asset;
  const hasSide = !!(asset?.path || asset?.dataUri);
  if (hasSide) {
    const sideW = 2.9;
    elements.push(
      Image(
        {
          position: { x: tokens.grid.slideW - sideW, y: 0, w: sideW, h: tokens.grid.slideH },
          path: asset?.path,
          data: asset?.dataUri,
          fit: 'cover',
          transparency: 12,
        },
        tokens
      )
    );
  }

  elements.push(HeaderBar({}, tokens));
  // Action-title (beat-Gamma): the slide's thesis (key_message) becomes the title,
  // consistent with every other layout. The generic label is only a fallback.
  // The board-level headline is rendered separately inside ExecutiveSummaryPanel,
  // so there is no duplication.
  elements.push(
    SlideTitle(
      {
        text:
          slide.key_message ||
          (meta.language === 'pl' ? 'Podsumowanie Wykonawcze' : 'Executive Summary'),
      },
      tokens
    )
  );
  elements.push(PageNumber({}, tokens));

  // Main panel
  const panelW = hasSide ? tokens.grid.contentW - 2.3 : tokens.grid.contentW;
  const panelElements = ExecutiveSummaryPanel(
    {
      headline: c.headline,
      kpis: c.kpis,
      keyFindings: c.key_findings,
      recommendation: c.recommendation,
      position: {
        x: tokens.grid.contentX,
        y: tokens.grid.contentY,
        w: panelW,
        h: tokens.grid.contentH,
      },
    },
    tokens
  );
  elements.push(...panelElements);

  // Footer
  elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));

  return { masterName: 'BLANK', elements };
}
