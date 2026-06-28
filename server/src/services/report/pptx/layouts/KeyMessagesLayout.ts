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
    (v) =>
      v &&
      (v.slot === 'background_texture' ||
        v.slot === 'side_illustration' ||
        v.purpose === 'image_slide_asset')
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
  // Cards fill the full content region (anti-sparseness): full height, even gutters.
  const cardW = (g.contentW - tokens.spacing.gutter * (count - 1)) / count;
  const cardY = g.contentY;
  const cardH = g.contentH;
  // Vertically center the icon→title→description block inside the tall card so
  // content breathes instead of clinging to the top, leaving an empty bottom.
  const iconH = 0.5;
  const titleH = 0.5;
  const descH = Math.min(cardH - (iconH + titleH) - 0.5, 1.8);
  const blockH = iconH + 0.1 + titleH + 0.1 + descH;
  const blockTop = cardY + Math.max(0.2, (cardH - blockH) / 2);

  for (let i = 0; i < count; i++) {
    const msg = c.messages[i];
    const cardX = g.contentX + i * (cardW + tokens.spacing.gutter);

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
          position: { x: cardX, y: blockTop, w: cardW, h: iconH },
          color: tokens.colors.primary,
          fontSize: 28,
        },
        tokens
      )
    );

    // Title
    elements.push(
      BodyText(
        {
          text: msg.title,
          position: { x: cardX + 0.15, y: blockTop + iconH + 0.1, w: cardW - 0.3, h: titleH },
          bold: true,
          fontSize: 14,
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
          position: {
            x: cardX + 0.15,
            y: blockTop + iconH + 0.1 + titleH + 0.1,
            w: cardW - 0.3,
            h: descH,
          },
          fontSize: 11,
          color: tokens.colors.textSecondary,
          align: 'center',
          valign: 'top',
        },
        tokens
      )
    );
  }

  elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));

  return { masterName: 'BLANK', elements };
}
