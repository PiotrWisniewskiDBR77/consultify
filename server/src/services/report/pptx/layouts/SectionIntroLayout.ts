/**
 * Layout: Section Intro
 * Section transition / divider slide.
 */
import { Image } from '../atomics/Image.js';
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

  // Optional subtle background texture/visual (render first)
  const visual = (slide.visuals || []).find(
    (v) =>
      v &&
      (v.slot === 'background_texture' || v.slot === 'hero' || v.purpose === 'image_slide_asset')
  );
  const asset = visual?.asset;
  if (asset?.path || asset?.dataUri) {
    elements.push(
      Image(
        {
          position: { x: 0, y: 0, w: tokens.grid.slideW, h: tokens.grid.slideH },
          path: asset.path,
          data: asset.dataUri,
          fit: 'cover',
          transparency: 22,
        },
        tokens
      )
    );
  }

  elements.push(PageNumber({ color: tokens.colors.textInverse }, tokens));

  // Divider slides have no header/footer chrome — centre the block over the full
  // slide height (minus a small page-number margin) so it reads as deliberate.
  const blockElements = SectionIntroBlock(
    {
      sectionTitle: c.section_title,
      sectionNumber: c.section_number,
      description: c.description,
      position: { x: 0.5, y: 0.6, w: 9, h: tokens.grid.slideH - 1.2 },
    },
    tokens
  );
  elements.push(...blockElements);

  return { masterName: 'SECTION_DIVIDER', elements };
}
