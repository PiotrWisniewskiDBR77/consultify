/**
 * Composite: Section Intro Block
 * Section transition slide content — section title + optional description.
 */
import { BodyText } from '../atomics/BodyText.js';
import type { DesignTokens, ElementPosition, RenderedElement } from '../types.js';

export interface SectionIntroBlockProps {
  sectionTitle: string;
  sectionNumber?: number;
  description?: string;
  position: ElementPosition;
}

export function SectionIntroBlock(
  props: SectionIntroBlockProps,
  tokens: DesignTokens
): RenderedElement[] {
  const { position: p } = props;
  const elements: RenderedElement[] = [];

  // Section number (if provided)
  if (props.sectionNumber != null) {
    elements.push(
      BodyText(
        {
          text: `${String(props.sectionNumber).padStart(2, '0')}`,
          position: { x: p.x, y: p.y, w: p.w, h: 0.5 },
          fontSize: 48,
          bold: true,
          color: tokens.colors.textInverse,
          align: 'center',
        },
        tokens
      )
    );
  }

  // Section title
  const titleY = props.sectionNumber != null ? p.y + 0.6 : p.y;
  elements.push(
    BodyText(
      {
        text: props.sectionTitle,
        position: { x: p.x, y: titleY, w: p.w, h: 0.6 },
        fontSize: tokens.fontSizes.sectionTitle,
        bold: true,
        color: tokens.colors.textInverse,
        align: 'center',
        valign: 'middle',
      },
      tokens
    )
  );

  // Description
  if (props.description) {
    elements.push(
      BodyText(
        {
          text: props.description,
          position: { x: p.x + p.w * 0.1, y: titleY + 0.7, w: p.w * 0.8, h: 0.5 },
          color: tokens.colors.textInverse,
          align: 'center',
        },
        tokens
      )
    );
  }

  return elements;
}
