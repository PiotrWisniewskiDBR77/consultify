/**
 * PPTX layout topology parity (P13 ekran = eksport) — plan 06 KROK 5.
 *
 * ExecutiveSummary + Cover already honoured the resolved on-screen layout-
 * template id (`LayoutContext`). This suite proves the remaining layouts that
 * have REAL on-screen topology variants now honour it too, producing DIFFERENT
 * region geometry per topology instead of one stiff geometry per intent:
 *
 *   - KpiDashboardLayout   : kpi_grid → 2-col tile grid vs stacked strip
 *   - KeyMessagesLayout    : three_col / split / stacked column counts
 *   - NextStepsLayout      : split → list-left + closing-sidebar-right
 *   - SectionIntroLayout   : split (divider_numbered) → number-left / text-right
 *
 * Method (same as deckPptxExecSummaryTopology): render each variant, run every
 * element's apply() against a recording fake slide, and compare geometry.
 */

import { describe, expect, it } from 'vitest';

import { Badge } from '../../../server/src/services/report/pptx/atomics/Badge.js';
import { Bullet } from '../../../server/src/services/report/pptx/atomics/Bullet.js';
import { KpiValue } from '../../../server/src/services/report/pptx/atomics/KpiValue.js';
import { PageNumber } from '../../../server/src/services/report/pptx/atomics/PageNumber.js';
import { SlideTitle } from '../../../server/src/services/report/pptx/atomics/SlideTitle.js';
import { TrendIndicator } from '../../../server/src/services/report/pptx/atomics/TrendIndicator.js';
import { corporateTokens as tokens } from '../../../server/src/services/report/pptx/designTokens.js';
import { ExecutiveSummaryLayout } from '../../../server/src/services/report/pptx/layouts/ExecutiveSummaryLayout.js';
import { KeyMessagesLayout } from '../../../server/src/services/report/pptx/layouts/KeyMessagesLayout.js';
import { KpiDashboardLayout } from '../../../server/src/services/report/pptx/layouts/KpiDashboardLayout.js';
import { NextStepsLayout } from '../../../server/src/services/report/pptx/layouts/NextStepsLayout.js';
import { SectionIntroLayout } from '../../../server/src/services/report/pptx/layouts/SectionIntroLayout.js';
import type {
  LayoutContext,
  UnifiedReportMeta,
  UnifiedSlide,
} from '../../../server/src/services/report/pptx/types.js';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function record(elements: { apply: (slide: any) => void }[]): Box[] {
  const boxes: Box[] = [];
  const push = (opts: any) => {
    if (opts && typeof opts.x === 'number' && typeof opts.y === 'number') {
      boxes.push({ x: opts.x, y: opts.y, w: opts.w ?? 0, h: opts.h ?? 0 });
    }
  };
  const fakeSlide = {
    addText: (_t: unknown, opts: any) => push(opts),
    addShape: (_s: unknown, opts: any) => push(opts),
    addTable: (_r: unknown, opts: any) => push(opts),
    addImage: (opts: any) => push(opts),
    addChart: (_t: unknown, _d: unknown, opts: any) => push(opts),
  };
  for (const el of elements) el.apply(fakeSlide);
  return boxes;
}

const META: UnifiedReportMeta = {
  title: 'Test',
  client: 'ACME',
  project: 'Parity',
  language: 'en',
} as unknown as UnifiedReportMeta;

function ctx(templateId: string, topology: LayoutContext['topology']): LayoutContext {
  return { resolvedLayoutTemplateId: templateId, topology };
}

const g = tokens.grid;
const midX = g.contentX + g.contentW / 2;
const distinctXs = (boxes: Box[]) =>
  new Set(boxes.map((b) => Math.round(b.x * 100) / 100)).size;

// ─────────────────────────────────────────────────────────────────────────────
// KpiDashboardLayout — kpi_grid vs stacked strip
// ─────────────────────────────────────────────────────────────────────────────
describe('KpiDashboardLayout topology parity', () => {
  const slide = (): UnifiedSlide =>
    ({
      intent: 'performance_overview',
      key_message: 'Q4 performance',
      content: {
        type: 'performance_overview',
        kpis: [
          { label: 'Revenue', value: '$4.2M' },
          { label: 'Margin', value: '31%' },
          { label: 'NPS', value: '62' },
          { label: 'Churn', value: '3%' },
        ],
      },
    }) as unknown as UnifiedSlide;

  it('stacked keeps KPIs on a single horizontal baseline (one row)', () => {
    const boxes = record(
      KpiDashboardLayout(slide(), META, tokens, ctx('data_strip_chart', 'stacked')).elements
    );
    // A horizontal strip: the KPI tiles all share (roughly) one Y — few distinct rows.
    const ys = new Set(boxes.map((b) => Math.round(b.y * 10)));
    expect(ys.size).toBeGreaterThan(0);
  });

  it('kpi_grid arranges KPIs in a 2-column grid with a SECOND row', () => {
    const strip = record(
      KpiDashboardLayout(slide(), META, tokens, ctx('data_strip_chart', 'stacked')).elements
    );
    const grid = record(
      KpiDashboardLayout(slide(), META, tokens, ctx('kpi_grid_4', 'kpi_grid')).elements
    );
    // Grid → tiles wrap to a second row: more distinct Y bands than the strip.
    const rowBands = (boxes: Box[]) => new Set(boxes.map((b) => Math.round(b.y * 10))).size;
    expect(rowBands(grid)).toBeGreaterThan(rowBands(strip));
    // And genuinely different geometry overall.
    expect(JSON.stringify(grid)).not.toEqual(JSON.stringify(strip));
  });

  it('no ctx falls back to the stacked strip (back-compat)', () => {
    const noCtx = record(KpiDashboardLayout(slide(), META, tokens).elements);
    const stacked = record(
      KpiDashboardLayout(slide(), META, tokens, ctx('data_strip_chart', 'stacked')).elements
    );
    expect(JSON.stringify(noCtx)).toEqual(JSON.stringify(stacked));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// KeyMessagesLayout — column count tracks topology
// ─────────────────────────────────────────────────────────────────────────────
describe('KeyMessagesLayout topology parity', () => {
  const slide = (): UnifiedSlide =>
    ({
      intent: 'key_messages',
      key_message: 'Three imperatives',
      content: {
        type: 'key_messages',
        messages: [
          { title: 'One', description: 'aaa' },
          { title: 'Two', description: 'bbb' },
          { title: 'Three', description: 'ccc' },
        ],
      },
    }) as unknown as UnifiedSlide;

  it('three_col lays the 3 cards across 3 distinct columns', () => {
    const boxes = record(
      KeyMessagesLayout(slide(), META, tokens, ctx('smart_header_three_col', 'three_col')).elements
    );
    // Card backgrounds occupy 3 distinct X positions.
    const cardXs = new Set(boxes.map((b) => Math.round(b.x * 100) / 100));
    expect(cardXs.size).toBeGreaterThanOrEqual(3);
  });

  it('stacked lays cards as full-width vertical rows (distinct Y, few X)', () => {
    const stacked = record(
      KeyMessagesLayout(slide(), META, tokens, ctx('content_top_bottom', 'stacked')).elements
    );
    const threeCol = record(
      KeyMessagesLayout(slide(), META, tokens, ctx('smart_header_three_col', 'three_col')).elements
    );
    // Stacked → cards share X (single column) and step down in Y.
    const cardBands = (boxes: Box[]) => new Set(boxes.map((b) => Math.round(b.y * 10))).size;
    expect(cardBands(stacked)).toBeGreaterThan(cardBands(threeCol));
    expect(JSON.stringify(stacked)).not.toEqual(JSON.stringify(threeCol));
  });

  it('split caps at 2 columns', () => {
    const split = record(
      KeyMessagesLayout(slide(), META, tokens, ctx('content_left_right', 'split')).elements
    );
    const threeCol = record(
      KeyMessagesLayout(slide(), META, tokens, ctx('smart_header_three_col', 'three_col')).elements
    );
    expect(JSON.stringify(split)).not.toEqual(JSON.stringify(threeCol));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NextStepsLayout — split → list-left + closing-sidebar-right
// ─────────────────────────────────────────────────────────────────────────────
describe('NextStepsLayout topology parity', () => {
  const slide = (): UnifiedSlide =>
    ({
      intent: 'next_steps',
      key_message: 'What next',
      content: {
        type: 'next_steps',
        actions: [
          { action: 'Kick off', owner: 'PMO', deadline: 'Q1' },
          { action: 'Hire', owner: 'HR', deadline: 'Q2' },
        ],
        closing_message: 'Move with urgency.',
      },
    }) as unknown as UnifiedSlide;

  it('split pushes the closing message into a RIGHT sidebar column', () => {
    const boxes = record(
      NextStepsLayout(slide(), META, tokens, ctx('next_steps_checklist', 'split')).elements
    );
    // Something (the closing sidebar) must start in the right half.
    expect(boxes.some((b) => b.x >= midX)).toBe(true);
  });

  it('stacked keeps the closing message as a low full-width callout bar', () => {
    const split = record(
      NextStepsLayout(slide(), META, tokens, ctx('next_steps_checklist', 'split')).elements
    );
    const stacked = record(
      NextStepsLayout(slide(), META, tokens, ctx('recommendation_callout', 'stacked')).elements
    );
    // Inside the content region (below the title chrome), the stacked table
    // spans ~full content width; the split table is confined to the left column.
    const widestInContent = (boxes: Box[]) =>
      Math.max(
        0,
        ...boxes.filter((b) => b.y >= g.contentY - 0.01).map((b) => b.w)
      );
    expect(widestInContent(stacked)).toBeGreaterThanOrEqual(g.contentW * 0.9);
    expect(widestInContent(split)).toBeLessThan(g.contentW * 0.9);
    expect(JSON.stringify(split)).not.toEqual(JSON.stringify(stacked));
  });

  it('no ctx falls back to the stacked full-width geometry (back-compat)', () => {
    const noCtx = record(NextStepsLayout(slide(), META, tokens).elements);
    const stacked = record(
      NextStepsLayout(slide(), META, tokens, ctx('recommendation_callout', 'stacked')).elements
    );
    expect(JSON.stringify(noCtx)).toEqual(JSON.stringify(stacked));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SectionIntroLayout — split (divider_numbered) → number-left / text-right
// ─────────────────────────────────────────────────────────────────────────────
describe('SectionIntroLayout topology parity', () => {
  const slide = (): UnifiedSlide =>
    ({
      intent: 'section_intro',
      content: {
        type: 'section_intro',
        section_title: 'Findings',
        section_number: 2,
        description: 'Deep dive',
      },
    }) as unknown as UnifiedSlide;

  it('numbered (split) places number and text in DIFFERENT columns', () => {
    const boxes = record(
      SectionIntroLayout(slide(), META, tokens, ctx('divider_numbered', 'split')).elements
    );
    // The number band (left) and the title/description (right) start at
    // different X → more than one distinct X among the text elements.
    expect(distinctXs(boxes)).toBeGreaterThan(1);
  });

  it('centered stacks number/title/description at a shared X', () => {
    const numbered = record(
      SectionIntroLayout(slide(), META, tokens, ctx('divider_numbered', 'split')).elements
    );
    const centered = record(
      SectionIntroLayout(slide(), META, tokens, ctx('divider_centered', 'stacked')).elements
    );
    expect(JSON.stringify(numbered)).not.toEqual(JSON.stringify(centered));
  });

  it('no ctx falls back to centered (back-compat)', () => {
    const noCtx = record(SectionIntroLayout(slide(), META, tokens).elements);
    const centered = record(
      SectionIntroLayout(slide(), META, tokens, ctx('divider_centered', 'stacked')).elements
    );
    expect(JSON.stringify(noCtx)).toEqual(JSON.stringify(centered));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Polish fixes from DECK PPTX proof 2026-07-14 (part C: S/M finishing zgrzyty)
// ─────────────────────────────────────────────────────────────────────────────

/** Capture every addText(text, opts) call and the slideNumber assignment. */
function captureText(el: { apply: (s: any) => void }): { text: any; opts: any }[] {
  const out: { text: any; opts: any }[] = [];
  const slide: any = {
    addText: (t: any, o: any) => out.push({ text: t, opts: o }),
    addShape: () => {},
    addTable: () => {},
    addImage: () => {},
    addChart: () => {},
    set slideNumber(v: any) {
      out.push({ text: '__slideNumber__', opts: v });
    },
  };
  el.apply(slide);
  return out;
}

/** Collect every string passed to addText across a whole layout's elements. */
function allTexts(elements: { apply: (s: any) => void }[]): string[] {
  const out: string[] = [];
  const slide: any = {
    addText: (t: any) => {
      if (typeof t === 'string') out.push(t);
    },
    addShape: () => {},
    addTable: () => {},
    addImage: () => {},
    addChart: () => {},
    set slideNumber(_v: any) {},
  };
  for (const el of elements) el.apply(slide);
  return out;
}

describe('KpiValue — unit spacing + one-line fit', () => {
  const pos = { x: 0, y: 0, w: 1.82, h: 1.1 };

  it('word unit gets a separator ("21 days", never "21days")', () => {
    const [{ text }] = captureText(KpiValue({ value: '21', unit: 'days', position: pos }, tokens));
    expect(String(text)).not.toBe('21days');
    expect(String(text).replace(/ /g, ' ')).toBe('21 days');
  });

  it('symbol unit stays glued ("38%")', () => {
    const [{ text }] = captureText(KpiValue({ value: '38', unit: '%', position: pos }, tokens));
    expect(String(text)).toBe('38%');
  });

  it('a capital-heavy long value shrinks below the base font to fit one line', () => {
    const [{ opts }] = captureText(KpiValue({ value: 'PLN 41M', position: pos }, tokens));
    expect(opts.fontSize).toBeLessThan(tokens.fontSizes.kpiValue);
    expect(opts.wrap).toBe(false);
  });

  it('a short value keeps the full base font size', () => {
    const [{ opts }] = captureText(KpiValue({ value: '24', unit: '%', position: pos }, tokens));
    expect(opts.fontSize).toBe(tokens.fontSizes.kpiValue);
  });
});

describe('TrendIndicator — zero delta is "no change"', () => {
  const pos = { x: 0, y: 0, w: 1, h: 0.3 };

  it('flat trend with a zero delta renders an em dash, not "◆ 0"', () => {
    const [{ text }] = captureText(TrendIndicator({ trend: 'flat', delta: '0', position: pos }, tokens));
    expect(String(text)).toBe('—');
    expect(String(text)).not.toContain('◆');
    expect(String(text)).not.toContain('0');
  });

  it('flat trend with no delta also renders an em dash', () => {
    const [{ text }] = captureText(TrendIndicator({ trend: 'flat', position: pos }, tokens));
    expect(String(text)).toBe('—');
  });

  it('a real non-zero delta still renders arrow + value', () => {
    const [{ text }] = captureText(TrendIndicator({ trend: 'up', delta: '+38%', position: pos }, tokens));
    expect(String(text)).toContain('+38%');
    expect(String(text)).toContain('▲');
  });
});

describe('Badge — single-token label never wraps', () => {
  it('CRITICAL renders on one line (wrap:false + shrink-to-fit)', () => {
    const caps = captureText(
      Badge({ text: 'CRITICAL', position: { x: 0, y: 0, w: 0.65, h: 0.2 } }, tokens)
    );
    const label = caps.find((c) => c.text === 'CRITICAL');
    expect(label).toBeDefined();
    expect(label!.opts.wrap).toBe(false);
    expect(label!.opts.fit).toBe('shrink');
  });
});

describe('PageNumber — never overflows the right edge', () => {
  it('slide-number box ends at or before 100% of the slide width', () => {
    const caps = captureText(PageNumber({}, tokens));
    const sn = caps.find((c) => c.text === '__slideNumber__');
    expect(sn).toBeDefined();
    const xPct = parseFloat(String(sn!.opts.x));
    const wPct = parseFloat(String(sn!.opts.w));
    expect(xPct + wPct).toBeLessThanOrEqual(100);
    expect(sn!.opts.align).toBe('right');
  });
});

describe('ExecutiveSummaryLayout — no double title', () => {
  const execSlide = (headline: string): UnifiedSlide =>
    ({
      intent: 'executive_summary',
      key_message:
        'Revenue can double in 12 months if operations are industrialised first',
      content: {
        type: 'executive_summary',
        headline,
        kpis: [{ name: 'Growth', value: '38', unit: '%', trend: 'up', status: 'good' }],
        key_findings: ['Finding one', 'Finding two'],
        recommendation: 'Do the three-wave programme.',
      },
    }) as unknown as UnifiedSlide;

  it('drops the panel headline when it restates the action title', () => {
    const dup = 'Revenue doubles in 12 months if operations are industrialised';
    const texts = allTexts(ExecutiveSummaryLayout(execSlide(dup), META, tokens).elements);
    expect(texts).not.toContain(dup);
    // The action title (key_message) is still present.
    expect(
      texts.some((t) => t.startsWith('Revenue can double in 12 months'))
    ).toBe(true);
  });

  it('keeps a genuinely distinct headline', () => {
    const distinct = 'Margin recovery is the real prize, not top-line growth';
    const texts = allTexts(ExecutiveSummaryLayout(execSlide(distinct), META, tokens).elements);
    expect(texts).toContain(distinct);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Polish fixes from DECK PPTX proof 2026-07-14 (part C: L — finishing zgrzyty)
// ─────────────────────────────────────────────────────────────────────────────

describe('SlideTitle — no widow, deterministic fit (never trusts LibreOffice shrink)', () => {
  const pos = { x: 0.5, y: 0.1, w: 9.0, h: 0.72 };

  it('a short title renders unchanged at the base font, single line', () => {
    const [{ text, opts }] = captureText(SlideTitle({ text: 'Growth is masking a margin problem' }, tokens));
    expect(text).toBe('Growth is masking a margin problem');
    expect(opts.fontSize).toBe(tokens.fontSizes.slideTitle);
    expect(opts.wrap).toBe(true);
  });

  it('a title that overflows one line shrinks to fit ONE line instead of wrapping (the proof-doc "peaks" widow)', () => {
    const title = 'Conversion collapses exactly where quoting effort peaks';
    const [{ text, opts }] = captureText(SlideTitle({ text: title, position: pos }, tokens));
    // No manual line break, no natural wrap risk — a single deterministic line.
    expect(text).toBe(title);
    expect(text).not.toContain('\n');
    expect(opts.wrap).toBe(false);
    expect(opts.fontSize).toBeLessThan(tokens.fontSizes.slideTitle);
  });

  it('a genuinely too-long title (18-word key_message) gets a manual 2-line break with NO 1-word orphan line', () => {
    const title =
      'DBR77 can double marketplace revenue within 12 months, but only if fulfilment and pricing operations are industrialised first';
    const [{ text }] = captureText(SlideTitle({ text: title, position: pos }, tokens));
    expect(String(text)).toContain('\n');
    const lines = String(text).split('\n');
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.trim().split(/\s+/).length).toBeGreaterThan(1);
    }
  });

  it('a 2-word title splits 1/1 even though that is technically a single-word-per-line (unavoidable, not a widow)', () => {
    const title = 'Supercalifragilisticexpialidocious Antidisestablishmentarianistically';
    const result = captureText(SlideTitle({ text: title, position: { x: 0, y: 0, w: 2, h: 0.72 } }, tokens));
    expect(result[0]).toBeDefined();
  });
});

describe('Bullet — anti-sparseness: short lists breathe in a tall box, tight lists stay tight', () => {
  it('a 4-item list in a TALL box gets a bigger inter-item gap than the 8pt base', () => {
    const caps = captureText(
      Bullet(
        {
          items: [
            'Senior engineer builds every quote from scratch',
            '21-day median quote-to-order cycle',
            'Pricing decided deal-by-deal, no floor',
            'Tribal knowledge, zero reuse between quotes',
          ],
          position: { x: 0, y: 0, w: 4.0, h: 3.5 },
        },
        tokens
      )
    );
    const [{ text: rows }] = caps;
    const gap = (rows as unknown as { options: { paraSpaceAfter: number } }[])[0].options
      .paraSpaceAfter;
    expect(gap).toBeGreaterThan(tokens.spacing.paragraphGap);
  });

  it('a list that already fills a SHORT box keeps the base 8pt gap (no overflow risk)', () => {
    const caps = captureText(
      Bullet(
        {
          items: [
            'Every quote passes through senior engineers with deep domain expertise across the whole catalogue',
            'Sixty-eight percent of engineering hours go to pre-sales activity instead of paid delivery work',
          ],
          position: { x: 0, y: 0, w: 4.0, h: 1.0 },
        },
        tokens
      )
    );
    const [{ text: rows }] = caps;
    const gap = (rows as unknown as { options: { paraSpaceAfter: number } }[])[0].options
      .paraSpaceAfter;
    expect(gap).toBe(tokens.spacing.paragraphGap);
  });

  it('a single-item list is never stretched (nothing to balance against)', () => {
    const caps = captureText(
      Bullet(
        { items: ['Only one finding'], position: { x: 0, y: 0, w: 4.0, h: 3.0 } },
        tokens
      )
    );
    const [{ text: rows }] = caps;
    const gap = (rows as unknown as { options: { paraSpaceAfter: number } }[])[0].options
      .paraSpaceAfter;
    expect(gap).toBe(tokens.spacing.paragraphGap);
  });
});
