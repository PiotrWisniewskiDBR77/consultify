/**
 * Layout: Risk & Mitigation
 * Risk register table with likelihood/impact assessment.
 */
import { Footnote } from '../atomics/Footnote.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import { RiskTable } from '../composites/RiskTable.js';
import type {
  DesignTokens,
  LayoutResult,
  RiskManagementContent,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

export function RiskMitigationLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
): LayoutResult {
  const c = slide.content as RiskManagementContent;
  const elements = [];
  const g = tokens.grid;

  elements.push(HeaderBar({}, tokens));
  elements.push(
    SlideTitle(
      {
        text:
          slide.key_message ||
          (meta.language === 'pl' ? 'Ryzyka i Mitygacja' : 'Risks & Mitigation'),
      },
      tokens
    )
  );
  elements.push(PageNumber({}, tokens));

  const riskElements = RiskTable(
    {
      risks: c.risks,
      position: { x: g.contentX, y: g.contentY, w: g.contentW, h: g.contentH },
    },
    tokens
  );
  elements.push(...riskElements);

  elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));

  return { masterName: 'BLANK', elements };
}
