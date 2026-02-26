/**
 * Layout: Cover
 * Presentation opening slide — full bleed brand color, title, subtitle, date.
 */
import { BodyText } from '../atomics/BodyText.js';
import { ConfidentialityBanner } from '../atomics/ConfidentialityBanner.js';
import { Image } from '../atomics/Image.js';
import type {
  CoverContent,
  DesignTokens,
  LayoutResult,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

export function CoverLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
): LayoutResult {
  const c = slide.content as CoverContent;
  const elements = [];

  // Optional Gamma-like hero/background visual (render first, so text sits on top)
  const visual = (slide.visuals || []).find(
    (v) => v && (v.slot === 'cover_bg' || v.slot === 'hero' || v.purpose === 'image_cover')
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
          transparency: 10, // keep cover text readable
        },
        tokens
      )
    );
  }

  // Title
  elements.push(
    BodyText(
      {
        text: c.title,
        position: { x: 0.8, y: 1.8, w: 8.4, h: 1.2 },
        fontSize: 40,
        bold: true,
        color: tokens.colors.textInverse,
        align: 'center',
        valign: 'middle',
      },
      tokens
    )
  );

  // Subtitle
  if (c.subtitle) {
    elements.push(
      BodyText(
        {
          text: c.subtitle,
          position: { x: 0.8, y: 3.2, w: 8.4, h: 0.5 },
          fontSize: 18,
          color: tokens.colors.textInverse,
          align: 'center',
        },
        tokens
      )
    );
  }

  // Organization | Date
  const infoLine = [c.organization, c.date].filter(Boolean).join('  |  ');
  elements.push(
    BodyText(
      {
        text: infoLine,
        position: { x: 0.8, y: 4.0, w: 8.4, h: 0.4 },
        fontSize: 14,
        color: tokens.colors.textInverse,
        align: 'center',
      },
      tokens
    )
  );

  // Branding footer
  elements.push(
    BodyText(
      {
        text: 'Consultinity',
        position: { x: 0.8, y: 4.8, w: 8.4, h: 0.3 },
        fontSize: 11,
        color: tokens.colors.textInverse,
        align: 'center',
      },
      tokens
    )
  );

  // Confidentiality
  if (meta.confidentiality && meta.confidentiality !== 'public') {
    elements.push(ConfidentialityBanner({ level: meta.confidentiality }, tokens));
  }

  return {
    masterName: 'COVER',
    elements,
  };
}
