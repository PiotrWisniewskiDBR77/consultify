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

  // KPI tiles
  const kpiY = c.period ? g.contentY + 0.25 : g.contentY;
  const kpiH = c.context ? 1.3 : 2.5;
  const kpiElements = KpiStrip(
    {
      kpis: c.kpis.slice(0, 6),
      position: { x: g.contentX, y: kpiY, w: g.contentW, h: kpiH },
    },
    tokens
  );
  elements.push(...kpiElements);

  // Context text
  if (c.context) {
    elements.push(
      BodyText(
        {
          text: c.context,
          position: {
            x: g.contentX,
            y: kpiY + kpiH + 0.2,
            w: g.contentW,
            h: g.contentH - kpiH - 0.5,
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
