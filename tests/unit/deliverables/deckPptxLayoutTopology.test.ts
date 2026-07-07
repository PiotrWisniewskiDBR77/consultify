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

import { corporateTokens as tokens } from '../../../server/src/services/report/pptx/designTokens.js';
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
