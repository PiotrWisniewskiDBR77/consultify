/**
 * Composite: Section Intro Block
 * Section transition slide content — large section number + title (+ description).
 *
 * W7: the whole block is vertically centred in its region (centerY) so it reads
 * as a deliberate divider, not text stuck to the top of the slide.
 */
import { BodyText } from '../atomics/BodyText.js';
import { centerY, distributeY } from './verticalRhythm.js';
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface SectionIntroBlockProps {
  sectionTitle: string;
  sectionNumber?: number;
  description?: string;
  position: ElementPosition;
  /**
   * P13 — layout topology of the resolved on-screen template:
   *  - 'centered' (divider_centered): number/title/description stacked & centred.
   *  - 'numbered'  (divider_numbered, split): big number in a LEFT band, title +
   *    description left-aligned in the RIGHT column.
   */
  variant?: 'centered' | 'numbered';
}

export function SectionIntroBlock(
  props: SectionIntroBlockProps,
  tokens: DesignTokens
): RenderedElement[] {
  const { position: p } = props;
  const elements: RenderedElement[] = [];

  const hasNumber = props.sectionNumber != null;
  const hasDesc = !!props.description;

  // ── Numbered (split) variant — big number left, text right. ────────────────
  if (props.variant === 'numbered' && hasNumber) {
    const numberW = Math.min(2.6, p.w * 0.3);
    const textX = p.x + numberW + 0.4;
    const textW = p.x + p.w - textX;

    elements.push(
      BodyText(
        {
          text: String(props.sectionNumber).padStart(2, '0'),
          position: { x: p.x, y: p.y, w: numberW, h: p.h },
          fontSize: 96,
          bold: true,
          color: tokens.colors.textInverse,
          align: 'left',
          valign: 'middle',
          fontFace: tokens.fonts.title,
        },
        tokens
      )
    );

    const titleH = 0.9;
    const descH = 0.7;
    const rows = hasDesc ? [titleH, descH] : [titleH];
    const ys =
      rows.length === 1 ? [centerY({ y: p.y, h: p.h }, titleH)] : distributeY({ y: p.y, h: p.h }, rows, 'center', 0.2);

    elements.push(
      BodyText(
        {
          text: props.sectionTitle,
          position: { x: textX, y: ys[0], w: textW, h: titleH },
          fontSize: tokens.fontSizes.sectionTitle,
          bold: true,
          color: tokens.colors.textInverse,
          align: 'left',
          valign: 'middle',
          fontFace: tokens.fonts.title,
        },
        tokens
      )
    );
    if (hasDesc) {
      elements.push(
        BodyText(
          {
            text: props.description!,
            position: { x: textX, y: ys[1], w: textW, h: descH },
            color: tokens.colors.textInverse,
            align: 'left',
            valign: 'top',
          },
          tokens
        )
      );
    }
    return elements;
  }

  // Row heights (inches) for the stacked block, in render order.
  const numberH = 0.9;
  const titleH = 0.8;
  const descH = 0.6;

  const rows: number[] = [];
  if (hasNumber) rows.push(numberH);
  rows.push(titleH);
  if (hasDesc) rows.push(descH);

  // Centre the block vertically within the region. A single row (title only)
  // → centerY; multiple rows → tight centred stack via distributeY('center').
  let ys: number[];
  if (rows.length === 1) {
    ys = [centerY(p, rows[0])];
  } else {
    ys = distributeY(p, rows, 'center', 0.18);
  }

  let r = 0;

  // Large section number.
  if (hasNumber) {
    elements.push(
      BodyText(
        {
          text: String(props.sectionNumber).padStart(2, '0'),
          position: { x: p.x, y: ys[r], w: p.w, h: numberH },
          fontSize: 56,
          bold: true,
          color: tokens.colors.textInverse,
          align: 'center',
          valign: 'middle',
          fontFace: tokens.fonts.title,
        },
        tokens
      )
    );
    r++;
  }

  // Section title.
  elements.push(
    BodyText(
      {
        text: props.sectionTitle,
        position: { x: p.x, y: ys[r], w: p.w, h: titleH },
        fontSize: tokens.fontSizes.sectionTitle,
        bold: true,
        color: tokens.colors.textInverse,
        align: 'center',
        valign: 'middle',
        fontFace: tokens.fonts.title,
      },
      tokens
    )
  );
  r++;

  // Description.
  if (hasDesc) {
    elements.push(
      BodyText(
        {
          text: props.description!,
          position: { x: p.x + p.w * 0.1, y: ys[r], w: p.w * 0.8, h: descH },
          color: tokens.colors.textInverse,
          align: 'center',
          valign: 'middle',
        },
        tokens
      )
    );
  }

  return elements;
}
