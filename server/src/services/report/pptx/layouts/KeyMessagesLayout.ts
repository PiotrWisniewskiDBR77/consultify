/**
 * Layout: Key Messages
 * Narrative framing — 3-4 key messages displayed as cards.
 */
import { BodyText } from '../atomics/BodyText.js';
import { Footnote } from '../atomics/Footnote.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { Icon, ICONS } from '../atomics/Icon.js';
import { Image } from '../atomics/Image.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import type {
  DesignTokens,
  KeyMessagesContent,
  LayoutResult,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

export function KeyMessagesLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
): LayoutResult {
  const c = slide.content as KeyMessagesContent;
  const elements = [];

  // Optional subtle background visual (render first)
  const visual = (slide.visuals || []).find(
    (v) => v && (v.slot === 'background_texture' || v.slot === 'side_illustration' || v.purpose === 'image_slide_asset')
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
          transparency: 26,
        },
        tokens
      )
    );
  }

  elements.push(HeaderBar({}, tokens));
  elements.push(
    SlideTitle(
      {
        text:
          slide.key_message || (meta.language === 'pl' ? 'Kluczowe Przesłania' : 'Key Messages'),
      },
      tokens
    )
  );
  elements.push(PageNumber({}, tokens));

  const g = tokens.grid;
  const count = Math.min(c.messages.length, 4);
  const cardW = (g.contentW - tokens.spacing.gutter * (count - 1)) / count;

  for (let i = 0; i < count; i++) {
    const msg = c.messages[i];
    const cardX = g.contentX + i * (cardW + tokens.spacing.gutter);
    const cardY = g.contentY + 0.1;
    const cardH = g.contentH - 0.2;

    // Card background
    elements.push({
      kind: 'shape' as const,
      apply(s: any) {
        s.addShape('roundRect', {
          x: cardX,
          y: cardY,
          w: cardW,
          h: cardH,
          fill: { color: tokens.colors.surface },
          line: { color: tokens.colors.border, width: 0.5 },
          rectRadius: 0.06,
        });
      },
    });

    // Icon
    elements.push(
      Icon(
        {
          icon: msg.icon || ICONS.diamond,
          position: { x: cardX, y: cardY + 0.15, w: cardW, h: 0.35 },
          color: tokens.colors.primary,
          fontSize: 20,
        },
        tokens
      )
    );

    // Title
    elements.push(
      BodyText(
        {
          text: msg.title,
          position: { x: cardX + 0.1, y: cardY + 0.6, w: cardW - 0.2, h: 0.4 },
          bold: true,
          fontSize: 12,
          align: 'center',
        },
        tokens
      )
    );

    // Description
    elements.push(
      BodyText(
        {
          text: msg.description,
          position: { x: cardX + 0.1, y: cardY + 1.05, w: cardW - 0.2, h: cardH - 1.2 },
          fontSize: 10,
          color: tokens.colors.textSecondary,
          align: 'center',
        },
        tokens
      )
    );
  }

  elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));

  return { masterName: 'BLANK', elements };
}
