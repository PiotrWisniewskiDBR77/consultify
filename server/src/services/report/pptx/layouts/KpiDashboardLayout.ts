/**
 * Layout: KPI Dashboard
 * Performance overview — KPI strip + optional context text.
 * Max 6 KPIs per Rules Engine.
 */
import { BodyText } from '../atomics/BodyText.js';
import { Footnote } from '../atomics/Footnote.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import { KpiStrip } from '../composites/KpiStrip.js';
import { KpiTile } from '../composites/KpiTile.js';
import type {
  DesignTokens,
  ElementPosition,
  KpiData,
  LayoutContext,
  LayoutResult,
  PerformanceOverviewContent,
  RenderedElement,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

/**
 * P13 — ekran = eksport parity. When the on-screen editor resolves this slide
 * to the `kpi_grid_4` template (topology `kpi_grid`), the KPIs are shown as a
 * 2×N tile grid that fills the region, NOT a single horizontal strip. Arrange
 * the SAME KPI tiles in a 2-column grid so the export matches that shape.
 * Every other resolved template keeps today's horizontal `KpiStrip`.
 */
function kpiGrid(
  kpis: KpiData[],
  region: ElementPosition,
  tokens: DesignTokens
): RenderedElement[] {
  const count = Math.min(kpis.length, 6);
  const cols = count <= 1 ? 1 : 2;
  const rows = Math.ceil(count / cols);
  const gutter = tokens.spacing.gutter;
  const tileW = (region.w - gutter * (cols - 1)) / cols;
  const tileH = (region.h - gutter * (rows - 1)) / rows;
  const elements: RenderedElement[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    elements.push(
      ...KpiTile(
        {
          kpi: kpis[i],
          position: {
            x: region.x + col * (tileW + gutter),
            y: region.y + row * (tileH + gutter),
            w: tileW,
            h: tileH,
          },
        },
        tokens
      )
    );
  }
  return elements;
}

export function KpiDashboardLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens,
  ctx?: LayoutContext
): LayoutResult {
  const c = slide.content as PerformanceOverviewContent;
  const elements = [];
  const g = tokens.grid;

  elements.push(HeaderBar({}, tokens));
  elements.push(
    SlideTitle(
      {
        text:
          slide.key_message ||
          (meta.language === 'pl' ? 'Przegląd Wyników' : 'Performance Overview'),
      },
      tokens
    )
  );
  elements.push(PageNumber({}, tokens));

  // Period label
  if (c.period) {
    elements.push(
      BodyText(
        {
          text: c.period,
          position: { x: g.contentX, y: g.contentY - 0.05, w: g.contentW, h: 0.25 },
          fontSize: tokens.fontSizes.caption,
          color: tokens.colors.textSecondary,
        },
        tokens
      )
    );
  }

  // KPI tiles — W7 anti-sparseness: kafelki rosną i wypełniają płótno zamiast
  // siedzieć w górnej połowie z pustym dołem.
  const periodOffset = c.period ? 0.3 : 0;
  const regionY = g.contentY + periodOffset;
  const regionH = g.contentH - periodOffset; // pasmo użytkowe pod tytułem/okresem

  // Anti-sparseness L2 (proof 2026-07-14): the OLD fixed `regionH * 0.32` cap
  // sized the context box for a long paragraph even when the actual caption
  // was one short sentence — the tiles above stayed at their (smaller) share
  // and the leftover space inside the oversized, top-anchored context box
  // read as dead space in the bottom third of the slide. Estimate the real
  // line count from the caption's length and give the KPI tiles whatever
  // height that frees, so tiles grow to absorb it instead of the gap sitting
  // unused below a one-line caption.
  const estimateContextH = (text: string): number => {
    const charsPerLine = Math.max(20, Math.floor((g.contentW * 72) / 6.4));
    const lines = Math.max(1, Math.ceil(text.length / charsPerLine));
    return Math.min(1.3, Math.max(0.42, lines * 0.32 + 0.12));
  };
  const contextH = c.context ? estimateContextH(c.context) : 0;
  const contextGap = c.context ? 0.25 : 0;
  const kpiH = regionH - contextH - contextGap;
  const kpiY = regionY;

  const kpiRegion = { x: g.contentX, y: kpiY, w: g.contentW, h: kpiH };
  // P13 — honour the on-screen topology: `kpi_grid` → 2-col tile grid; every
  // other resolved template keeps the horizontal strip.
  const kpiElements =
    ctx?.topology === 'kpi_grid'
      ? kpiGrid(c.kpis.slice(0, 6), kpiRegion, tokens)
      : KpiStrip({ kpis: c.kpis.slice(0, 6), position: kpiRegion }, tokens);
  elements.push(...kpiElements);

  // Context text — zakotwiczony pod kafelkami, wypełnia dolny pas.
  if (c.context) {
    elements.push(
      BodyText(
        {
          text: c.context,
          position: {
            x: g.contentX,
            y: kpiY + kpiH + contextGap,
            w: g.contentW,
            h: contextH,
          },
          color: tokens.colors.textSecondary,
        },
        tokens
      )
    );
  }

  elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));

  return { masterName: 'BLANK', elements };
}
