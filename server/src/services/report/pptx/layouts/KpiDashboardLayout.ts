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
import type {
  DesignTokens,
  LayoutResult,
  PerformanceOverviewContent,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

export function KpiDashboardLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
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

  // Z kontekstem: kafelki biorą ~60% wysokości (większe niż dawne 1.3),
  // tekst kontekstu wypełnia dół. Bez kontekstu: kafelki wypełniają cały region
  // (były 2.5 → teraz ~3.7), więc oddychają i są czytelne.
  const contextH = c.context ? Math.min(1.3, regionH * 0.32) : 0;
  const contextGap = c.context ? 0.25 : 0;
  const kpiH = regionH - contextH - contextGap;
  const kpiY = regionY;

  const kpiElements = KpiStrip(
    {
      kpis: c.kpis.slice(0, 6),
      position: { x: g.contentX, y: kpiY, w: g.contentW, h: kpiH },
    },
    tokens
  );
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
