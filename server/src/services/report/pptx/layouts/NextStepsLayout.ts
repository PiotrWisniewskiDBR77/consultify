/**
 * Layout: Next Steps
 * Call to action — action items table + closing message.
 */
import type { DesignTokens, LayoutResult, UnifiedSlide, UnifiedReportMeta, NextStepsContent } from '../types.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { BodyText } from '../atomics/BodyText.js';
import { Footnote } from '../atomics/Footnote.js';

export function NextStepsLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens
): LayoutResult {
  const c = slide.content as NextStepsContent;
  const elements = [];
  const g = tokens.grid;

  elements.push(HeaderBar({}, tokens));
  elements.push(SlideTitle({ text: slide.key_message || (meta.language === 'pl' ? 'Kolejne Kroki' : 'Next Steps') }, tokens));
  elements.push(PageNumber({}, tokens));

  // Actions table
  const headerRow = [
    { text: '#', options: { bold: true, fill: { color: tokens.colors.primary }, color: 'FFFFFF', fontSize: 9, fontFace: tokens.fonts.body, align: 'center' as const } },
    { text: 'Action', options: { bold: true, fill: { color: tokens.colors.primary }, color: 'FFFFFF', fontSize: 10, fontFace: tokens.fonts.body } },
    { text: 'Owner', options: { bold: true, fill: { color: tokens.colors.primary }, color: 'FFFFFF', fontSize: 10, fontFace: tokens.fonts.body, align: 'center' as const } },
    { text: 'Deadline', options: { bold: true, fill: { color: tokens.colors.primary }, color: 'FFFFFF', fontSize: 10, fontFace: tokens.fonts.body, align: 'center' as const } },
  ];

  const dataRows = c.actions.map((a, i) => [
    { text: String(i + 1), options: { fontSize: 9, fontFace: tokens.fonts.body, color: tokens.colors.textSecondary, align: 'center' as const } },
    { text: a.action, options: { fontSize: 10, fontFace: tokens.fonts.body, color: tokens.colors.textPrimary } },
    { text: a.owner ?? '—', options: { fontSize: 10, fontFace: tokens.fonts.body, color: tokens.colors.textSecondary, align: 'center' as const } },
    { text: a.deadline ?? '—', options: { fontSize: 10, fontFace: tokens.fonts.body, color: tokens.colors.textSecondary, align: 'center' as const } },
  ]);

  const tableH = c.closing_message ? g.contentH - 0.7 : g.contentH;
  elements.push({
    kind: 'table' as const,
    apply(s: any) {
      s.addTable([headerRow, ...dataRows], {
        x: g.contentX,
        y: g.contentY,
        w: g.contentW,
        colW: [g.contentW * 0.07, g.contentW * 0.48, g.contentW * 0.22, g.contentW * 0.23],
        border: { pt: 0.5, color: tokens.colors.border },
        fontFace: tokens.fonts.body,
        rowH: 0.38,
        autoPage: false,
      });
    },
  });

  // Closing message
  if (c.closing_message) {
    elements.push(
      BodyText({
        text: c.closing_message,
        position: { x: g.contentX, y: g.contentY + tableH + 0.1, w: g.contentW, h: 0.5 },
        bold: true,
        color: tokens.colors.primary,
        align: 'center',
      }, tokens)
    );
  }

  elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));

  return { masterName: 'BLANK', elements };
}
