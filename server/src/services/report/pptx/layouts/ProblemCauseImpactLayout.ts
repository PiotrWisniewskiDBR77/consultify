/**
 * Layout: Problem–Cause–Impact
 * Root cause analysis — problem statement + cause-impact table.
 */
import { Footnote } from '../atomics/Footnote.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import { ProblemCauseImpact } from '../composites/ProblemCauseImpact.js';
import type {
  DesignTokens,
  LayoutResult,
  RootCauseContent,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

export function ProblemCauseImpactLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
): LayoutResult {
  const c = slide.content as RootCauseContent;
  const elements = [];
  const g = tokens.grid;

  elements.push(HeaderBar({}, tokens));
  elements.push(
    SlideTitle(
      {
        text:
          slide.key_message ||
          (meta.language === 'pl' ? 'Analiza Przyczyn' : 'Root Cause Analysis'),
      },
      tokens
    )
  );
  elements.push(PageNumber({}, tokens));

  const pciElements = ProblemCauseImpact(
    {
      problem: c.problem,
      language: meta.language,
      causes: c.causes,
      position: { x: g.contentX, y: g.contentY, w: g.contentW, h: g.contentH },
    },
    tokens
  );
  elements.push(...pciElements);

  elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));

  return { masterName: 'BLANK', elements };
}
