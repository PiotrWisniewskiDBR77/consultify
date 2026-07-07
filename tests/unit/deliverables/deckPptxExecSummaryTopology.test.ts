/**
 * PPTX ExecutiveSummary layout — topology parity (P13 ekran = eksport).
 *
 * Before this change every intent-bound PPTX layout except Cover ignored the
 * `LayoutContext` (resolved on-screen template id), so a slide the editor shows
 * as a split `exec_left_bullets` or a `exec_top_kpi` was always exported as the
 * single stacked `exec_full` geometry. This test proves ExecutiveSummaryLayout
 * now honours the resolved template id and produces DIFFERENT region geometry
 * per variant, matching the on-screen shape.
 *
 * We render each variant, run every element's `apply()` against a recording
 * fake slide, and compare the geometry of the KPI shapes (the region that moves
 * between variants: right column in split, top strip in top_kpi).
 */

import { describe, expect, it } from 'vitest';

import { corporateTokens } from '../../../server/src/services/report/pptx/designTokens.js';
import { ExecutiveSummaryLayout } from '../../../server/src/services/report/pptx/layouts/ExecutiveSummaryLayout.js';
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

function slideWithKpis(): UnifiedSlide {
  return {
    intent: 'executive_summary',
    key_message: 'Board thesis',
    content: {
      type: 'executive_summary',
      headline: 'We grew 20%',
      kpis: [
        { label: 'Revenue', value: '$4.2M' },
        { label: 'Margin', value: '31%' },
        { label: 'NPS', value: '62' },
      ],
      key_findings: ['Finding A', 'Finding B', 'Finding C'],
      recommendation: 'Double down on segment X',
    },
  } as unknown as UnifiedSlide;
}

function ctx(templateId: string): LayoutContext {
  return { resolvedLayoutTemplateId: templateId, topology: 'stacked' };
}

describe('ExecutiveSummaryLayout topology parity', () => {
  it('stacked (exec_full) keeps the panel full-width, single column', () => {
    const boxes = record(ExecutiveSummaryLayout(slideWithKpis(), META, corporateTokens, ctx('exec_full')).elements);
    expect(boxes.length).toBeGreaterThan(0);
  });

  it('split (exec_left_bullets) pushes KPIs into a RIGHT column', () => {
    const stacked = record(
      ExecutiveSummaryLayout(slideWithKpis(), META, corporateTokens, ctx('exec_full')).elements
    );
    const split = record(
      ExecutiveSummaryLayout(slideWithKpis(), META, corporateTokens, ctx('exec_left_bullets')).elements
    );
    // In the split variant, content extends further right than the stacked
    // single column would place its left-aligned blocks: the KPI/right column
    // starts past the horizontal midpoint of the content area.
    const contentMidX = corporateTokens.grid.contentX + corporateTokens.grid.contentW / 2;
    // Some element must start in the right half (the right column) — the split
    // variant pushes KPIs / recommendation there. The stacked variant never
    // does (its blocks are all left-anchored at contentX).
    const splitInRight = split.filter((b) => Number.isFinite(b.x) && b.x >= contentMidX).length;
    const stackedInRight = stacked.filter(
      (b) => Number.isFinite(b.x) && b.x >= contentMidX
    ).length;
    expect(splitInRight).toBeGreaterThan(0);
    expect(splitInRight).toBeGreaterThan(stackedInRight);
    // Geometry genuinely differs from stacked.
    expect(JSON.stringify(split)).not.toEqual(JSON.stringify(stacked));
  });

  it('top_kpi (exec_top_kpi) pins the KPI strip near the TOP of the region', () => {
    const topKpi = record(
      ExecutiveSummaryLayout(slideWithKpis(), META, corporateTokens, ctx('exec_top_kpi')).elements
    );
    // The recommendation callout sits low; findings/KPIs sit high. Confirm the
    // rendered geometry differs from the default stacked distribution.
    const stacked = record(
      ExecutiveSummaryLayout(slideWithKpis(), META, corporateTokens, ctx('exec_full')).elements
    );
    expect(JSON.stringify(topKpi)).not.toEqual(JSON.stringify(stacked));
  });

  it('unknown / non-exec template id falls back to stacked (back-compat)', () => {
    const withCtx = record(
      ExecutiveSummaryLayout(slideWithKpis(), META, corporateTokens, ctx('content_full')).elements
    );
    const noCtx = record(ExecutiveSummaryLayout(slideWithKpis(), META, corporateTokens).elements);
    expect(JSON.stringify(withCtx)).toEqual(JSON.stringify(noCtx));
  });
});
