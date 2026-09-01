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
  LayoutContext,
  LayoutResult,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

export function KeyMessagesLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens,
  ctx?: LayoutContext
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
  const total = Math.min(c.messages.length, 4);

  // P13 — ekran = eksport parity. The on-screen editor resolves key-messages to
  // one of several topologies; honour the column count it implies so the export
  // matches the shape shown:
  //   three_col → 3 columns · split → 2 columns · stacked → vertical rows ·
  //   otherwise the intent default (up to 4 across).
  // `stacked` renders the messages as full-width horizontal rows (one per row)
  // instead of side-by-side cards.
  const isStacked = ctx?.topology === 'stacked';
  const cols = isStacked
    ? 1
    : ctx?.topology === 'three_col'
      ? Math.min(total, 3)
      : ctx?.topology === 'split'
        ? Math.min(total, 2)
        : total;
  const rows = Math.max(1, Math.ceil(total / cols));

  const gutter = tokens.spacing.gutter;
  const cardW = (g.contentW - gutter * (cols - 1)) / cols;
  const availableCardH = (g.contentH - gutter * (rows - 1)) / rows;
  const charsPerLine = Math.max(18, Math.floor(cardW * 11));
  const descriptionLines = Math.max(
    1,
    ...c.messages
      .slice(0, total)
      .map((message) => Math.ceil(message.description.length / charsPerLine))
  );
  const naturalCardH = isStacked ? 0.9 : Math.min(2.6, 1.25 + descriptionLines * 0.24);
  const cardH = Math.min(availableCardH, naturalCardH);

  for (let i = 0; i < total; i++) {
    const msg = c.messages[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cardX = g.contentX + col * (cardW + gutter);
    const cardY = g.contentY + row * (cardH + gutter);

    // Stacked rows are short and wide → lay the icon/title/description on a
    // horizontal baseline; column cards keep the centred vertical block.
    const iconH = 0.5;
    const titleH = isStacked ? 0.3 : 0.5;
    const descH = isStacked
      ? Math.max(0.25, cardH - titleH - 0.24)
      : Math.min(cardH - (iconH + titleH) - 0.5, 1.8);
    const blockH = isStacked ? cardH : iconH + 0.1 + titleH + 0.1 + descH;
    const blockTop = cardY + Math.max(0.1, (cardH - blockH) / 2);

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

    if (isStacked) {
      // Horizontal row: icon on the left, title + description stacked to the right.
      const iconW = 0.6;
      elements.push(
        Icon(
          {
            icon: msg.icon || ICONS.diamond,
            position: { x: cardX + 0.1, y: cardY, w: iconW, h: cardH },
            color: tokens.colors.primary,
            fontSize: 24,
          },
          tokens
        )
      );
      const textX = cardX + iconW + 0.2;
      const textW = cardW - iconW - 0.4;
      elements.push(
        BodyText(
          {
            text: msg.title,
            position: { x: textX, y: cardY + 0.12, w: textW, h: titleH },
            bold: true,
            fontSize: 14,
            align: 'left',
            valign: 'middle',
          },
          tokens
        )
      );
      elements.push(
        BodyText(
          {
            text: msg.description,
            position: { x: textX, y: cardY + 0.12 + titleH, w: textW, h: descH },
            fontSize: 11,
            color: tokens.colors.textSecondary,
            align: 'left',
            valign: 'top',
          },
          tokens
        )
      );
      continue;
    }

    // Column card: centred icon → title → description block.
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
