/**
 * Layout: Next Steps
 * Call to action — action items table + closing message.
 */
import { BodyText } from '../atomics/BodyText.js';
import { Footnote } from '../atomics/Footnote.js';
import { HeaderBar } from '../atomics/HeaderBar.js';
import { PageNumber } from '../atomics/PageNumber.js';
import { SlideTitle } from '../atomics/SlideTitle.js';
import type {
  DesignTokens,
  LayoutContext,
  LayoutResult,
  NextStepsContent,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../types.js';

export function NextStepsLayout(
  slide: UnifiedSlide,
  meta: UnifiedReportMeta,
  tokens: DesignTokens,
  ctx?: LayoutContext
): LayoutResult {
  const c = slide.content as NextStepsContent;
  const elements = [];
  const g = tokens.grid;

  elements.push(HeaderBar({}, tokens));
  elements.push(
    SlideTitle(
      { text: slide.key_message || (meta.language === 'pl' ? 'Kolejne Kroki' : 'Next Steps') },
      tokens
    )
  );
  elements.push(PageNumber({}, tokens));

  // Actions table
  const headerRow = [
    {
      text: '#',
      options: {
        bold: true,
        fill: { color: tokens.colors.primary },
        color: 'FFFFFF',
        fontSize: 9,
        fontFace: tokens.fonts.body,
        align: 'center' as const,
      },
    },
    {
      text: 'Action',
      options: {
        bold: true,
        fill: { color: tokens.colors.primary },
        color: 'FFFFFF',
        fontSize: 10,
        fontFace: tokens.fonts.body,
      },
    },
    {
      text: 'Owner',
      options: {
        bold: true,
        fill: { color: tokens.colors.primary },
        color: 'FFFFFF',
        fontSize: 10,
        fontFace: tokens.fonts.body,
        align: 'center' as const,
      },
    },
    {
      text: 'Deadline',
      options: {
        bold: true,
        fill: { color: tokens.colors.primary },
        color: 'FFFFFF',
        fontSize: 10,
        fontFace: tokens.fonts.body,
        align: 'center' as const,
      },
    },
  ];

  const dataRows = c.actions.map((a, i) => [
    {
      text: String(i + 1),
      options: {
        fontSize: 9,
        fontFace: tokens.fonts.body,
        color: tokens.colors.textSecondary,
        align: 'center' as const,
      },
    },
    {
      text: a.action,
      options: { fontSize: 10, fontFace: tokens.fonts.body, color: tokens.colors.textPrimary },
    },
    {
      text: a.owner ?? '—',
      options: {
        fontSize: 10,
        fontFace: tokens.fonts.body,
        color: tokens.colors.textSecondary,
        align: 'center' as const,
      },
    },
    {
      text: a.deadline ?? '—',
      options: {
        fontSize: 10,
        fontFace: tokens.fonts.body,
        color: tokens.colors.textSecondary,
        align: 'center' as const,
      },
    },
  ]);

  // P13 — ekran = eksport parity. When the on-screen editor resolves this slide
  // to `next_steps_checklist` (topology `split`, grid `"list sidebar"`), the
  // action list sits in a LEFT column with the closing message as a RIGHT
  // sidebar. Every other resolved template keeps today's full-width table with
  // a low closing callout bar.
  const isSplit = ctx?.topology === 'split' && !!c.closing_message;
  const rowCount = 1 + dataRows.length; // header + data rows

  if (isSplit) {
    // Left = actions table (~62%), right = closing sidebar (~38%).
    const gutter = tokens.spacing.gutter;
    const listW = (g.contentW - gutter) * 0.62;
    const sidebarW = g.contentW - gutter - listW;
    const sidebarX = g.contentX + listW + gutter;

    const rowH = Math.max(0.42, Math.min(0.9, g.contentH / rowCount));
    const tableH = rowH * rowCount;
    const tableY = g.contentY + Math.max(0, (g.contentH - tableH) / 2);

    elements.push({
      kind: 'table' as const,
      apply(s: any) {
        s.addTable([headerRow, ...dataRows], {
          x: g.contentX,
          y: tableY,
          w: listW,
          colW: [listW * 0.09, listW * 0.49, listW * 0.2, listW * 0.22],
          border: { pt: 0.5, color: tokens.colors.border },
          fontFace: tokens.fonts.body,
          rowH,
          valign: 'middle',
          autoPage: false,
        });
      },
    });

    // Closing message — full-height accent sidebar on the right.
    elements.push({
      kind: 'shape' as const,
      apply(s: any) {
        s.addShape('roundRect', {
          x: sidebarX,
          y: g.contentY,
          w: sidebarW,
          h: g.contentH,
          fill: { color: tokens.colors.primary },
          line: { color: tokens.colors.primary, width: 0 },
          rectRadius: 0.06,
        });
      },
    });
    elements.push(
      BodyText(
        {
          text: c.closing_message!,
          position: {
            x: sidebarX + 0.25,
            y: g.contentY + 0.25,
            w: sidebarW - 0.5,
            h: g.contentH - 0.5,
          },
          bold: true,
          color: 'FFFFFF',
          align: 'left',
          valign: 'middle',
        },
        tokens
      )
    );
  } else {
    // Anti-sparseness: stretch the actions table to fill the usable region, then
    // anchor the closing message as a low callout bar (NOT floating mid-slide).
    const calloutH = 0.46;
    const calloutGap = 0.18;
    // Region reserved for the table = everything above the low callout bar.
    const tableRegionH = c.closing_message ? g.contentH - calloutH - calloutGap : g.contentH;
    // Grow row height so the table breathes and fills tableRegionH; cap so a tiny
    // table doesn't become absurd. When capped (few rows), CENTRE the table in its
    // region instead of clinging to the top (kills the table↔callout gap).
    const rowH = Math.max(0.42, Math.min(0.9, tableRegionH / rowCount));
    const tableH = rowH * rowCount;
    const tableY = g.contentY + Math.max(0, (tableRegionH - tableH) / 2);

    elements.push({
      kind: 'table' as const,
      apply(s: any) {
        s.addTable([headerRow, ...dataRows], {
          x: g.contentX,
          y: tableY,
          w: g.contentW,
          colW: [g.contentW * 0.07, g.contentW * 0.48, g.contentW * 0.22, g.contentW * 0.23],
          border: { pt: 0.5, color: tokens.colors.border },
          fontFace: tokens.fonts.body,
          rowH,
          valign: 'middle',
          autoPage: false,
        });
      },
    });

    // Closing message — full-width accent callout bar anchored low (~y 4.5).
    if (c.closing_message) {
      const calloutY = g.contentY + g.contentH - calloutH;
      elements.push({
        kind: 'shape' as const,
        apply(s: any) {
          s.addShape('roundRect', {
            x: g.contentX,
            y: calloutY,
            w: g.contentW,
            h: calloutH,
            fill: { color: tokens.colors.primary },
            line: { color: tokens.colors.primary, width: 0 },
            rectRadius: 0.05,
          });
        },
      });
      elements.push(
        BodyText(
          {
            text: c.closing_message,
            position: { x: g.contentX + 0.3, y: calloutY, w: g.contentW - 0.6, h: calloutH },
            bold: true,
            color: 'FFFFFF',
            align: 'center',
            valign: 'middle',
          },
          tokens
        )
      );
    }
  }

  elements.push(Footnote({ text: `${meta.client} — ${meta.project}` }, tokens));

  return { masterName: 'BLANK', elements };
}
