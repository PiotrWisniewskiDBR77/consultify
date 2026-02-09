/**
 * Layout: Appendix
 * Deep dive / supplementary data — body text + optional tables.
 */
import { BodyText } from '../atomics/BodyText.js';
import { Footnote } from '../atomics/Footnote.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import type {
  AppendixContent,
  DesignTokens,
  LayoutResult,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

export function AppendixLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
): LayoutResult {
  const c = slide.content as AppendixContent;
  const elements = [];
  const g = tokens.grid;

  elements.push(HeaderBar({}, tokens));
  elements.push(SlideTitle({ text: c.title || 'Appendix' }, tokens));
  elements.push(PageNumber({}, tokens));

  // Body text
  const bodyH = c.tables && c.tables.length > 0 ? g.contentH * 0.4 : g.contentH;
  elements.push(
    BodyText(
      {
        text: c.body,
        position: { x: g.contentX, y: g.contentY, w: g.contentW, h: bodyH },
      },
      tokens
    )
  );

  // Tables
  if (c.tables && c.tables.length > 0) {
    const table = c.tables[0]; // First table only for slide
    const headerRow = table.headers.map((h) => ({
      text: h,
      options: {
        bold: true,
        fill: { color: tokens.colors.primary },
        color: 'FFFFFF',
        fontSize: 9,
        fontFace: tokens.fonts.body,
      },
    }));

    const dataRows = table.rows.slice(0, 8).map((row) =>
      row.map((cell) => ({
        text: cell,
        options: { fontSize: 9, fontFace: tokens.fonts.body, color: tokens.colors.textPrimary },
      }))
    );

    const tableY = g.contentY + bodyH + 0.15;
    elements.push({
      kind: 'table' as const,
      apply(s: any) {
        s.addTable([headerRow, ...dataRows], {
          x: g.contentX,
          y: tableY,
          w: g.contentW,
          colW: table.headers.map(() => g.contentW / table.headers.length),
          border: { pt: 0.5, color: tokens.colors.border },
          fontFace: tokens.fonts.body,
          rowH: 0.3,
          autoPage: false,
        });
      },
    });
  }

  // Footnotes
  if (c.footnotes && c.footnotes.length > 0) {
    elements.push(Footnote({ text: c.footnotes.join(' | ') }, tokens));
  } else {
    elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));
  }

  return { masterName: 'BLANK', elements };
}
