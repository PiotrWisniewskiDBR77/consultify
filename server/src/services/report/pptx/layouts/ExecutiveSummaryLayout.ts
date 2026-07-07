/**
 * Layout: Executive Summary
 * Board-level synthesis — headline, optional KPIs, key findings.
 */
import { Footnote } from '../atomics/Footnote.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { Image } from '../atomics/Image.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import {
  ExecutiveSummaryPanel,
  type ExecutiveSummaryPanelVariant,
} from '../composites/ExecutiveSummaryPanel.js';
import type {
  DesignTokens,
  ExecutiveSummaryContent,
  LayoutContext,
  LayoutResult,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

/**
 * P13 — ekran = eksport parity. Map the canonical on-screen template id
 * (resolved by `resolveDeckLayoutTemplateId` and passed via `LayoutContext`)
 * to the executive-summary panel geometry variant, so the export reproduces
 * the SAME shape the editor shows instead of the intent-only default.
 */
function panelVariantFromCtx(ctx?: LayoutContext): ExecutiveSummaryPanelVariant {
  switch (ctx?.resolvedLayoutTemplateId) {
    case 'exec_top_kpi':
      return 'top_kpi';
    case 'exec_left_bullets':
      return 'split';
    default:
      return 'stacked'; // exec_full and any non-exec fallback keep today's stack.
  }
}

export function ExecutiveSummaryLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens,
  ctx?: LayoutContext
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
  // A right-anchored side illustration already claims the right column, so the
  // split variant (which puts KPIs on the right) would collide — fall back to
  // the stacked variant in that case. `top_kpi` / `stacked` are safe with a side.
  const requestedVariant = panelVariantFromCtx(ctx);
  const variant: ExecutiveSummaryPanelVariant =
    hasSide && requestedVariant === 'split' ? 'stacked' : requestedVariant;
  const panelElements = ExecutiveSummaryPanel(
    {
      headline: c.headline,
      kpis: c.kpis,
      keyFindings: c.key_findings,
      recommendation: c.recommendation,
      variant,
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
