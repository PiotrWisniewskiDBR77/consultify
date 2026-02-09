/**
 * Layout: Section Intro
 * Section transition / divider slide.
 */
import { PageNumber } from '../atomics/PageNumber.js';
import { SectionIntroBlock } from '../composites/SectionIntroBlock.js';
import type {
  DesignTokens,
  LayoutResult,
  SectionIntroContent,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

export function SectionIntroLayout(
  slide: UnifiedSlide,
  _meta: UnifiedReportMeta,
  tokens: DesignTokens
): LayoutResult {
  const c = slide.content as SectionIntroContent;
  const elements = [];

  elements.push(PageNumber({ color: tokens.colors.textInverse }, tokens));

  const blockElements = SectionIntroBlock(
    {
      sectionTitle: c.section_title,
      sectionNumber: c.section_number,
      description: c.description,
      position: { x: 0.5, y: 1.5, w: 9, h: 2.5 },
    },
    tokens
  );
  elements.push(...blockElements);

  return { masterName: 'SECTION_DIVIDER', elements };
}
