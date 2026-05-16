/**
 * Document Studio — Chart block substrate tests
 * (Slice E17.charts).
 *
 * Verifies the chart block kind + payload contract added in slice
 * E17.charts to close the FR-22 / §10.7 gap from
 * CONSULTIFY_DOCUMENT_STUDIO_V1_GAP_VS_TARGET_2026-05-08.md
 * (Charts):
 *   - `'chart'` joins `DocumentBlockType` as the 12th canonical
 *     block kind;
 *   - `DocumentChartBlockContent` defines the payload shape;
 *   - `DocumentChartKind` enumerates the 6 supported chart kinds;
 *   - `DocumentChartSeries` defines one series.
 *
 * Also covers the three new public helpers exported from
 * `documentStudioTypes.ts`:
 *   - `isDocumentChartBlock(block)` — type-guard predicate;
 *   - `documentChartBlockContent(block)` — narrowed content extractor;
 *   - `summarizeDocumentChartBlock(block)` — readiness summary.
 *
 * Backwards-compat contract: pre-E17.charts schemas (every existing
 * document) carry no chart blocks and continue to work unchanged.
 * Renderers (DOCX / PDF / markdown) currently fall through to
 * `default: return ''` for unknown block types, so adding the
 * enum value is non-breaking — chart blocks silently render as
 * empty until renderer upgrades wire them in (the follow-up
 * `E17.charts.render` slice).
 */

import { describe, expect, it } from 'vitest';

import type {
  DocumentBlock,
  DocumentChartBlockContent,
  DocumentChartKind,
} from '../documentStudioTypes.js';
import {
  documentChartBlockContent,
  isDocumentChartBlock,
  summarizeDocumentChartBlock,
} from '../documentStudioTypes.js';

function makeChartBlock(content: Partial<DocumentChartBlockContent> = {}): DocumentBlock {
  const fullContent: DocumentChartBlockContent = {
    kind: 'bar',
    title: 'Revenue Q1-Q4',
    series: [{ label: 'Revenue', values: [100, 200, 300, 400] }],
    ...content,
  };
  return {
    blockId: 'blk-chart-1',
    type: 'chart',
    content: fullContent,
  };
}

function makeNonChartBlock(): DocumentBlock {
  return {
    blockId: 'blk-1',
    type: 'paragraph',
    content: { text: 'Just some prose.' },
  };
}

describe('DocumentBlockType — chart added (Slice E17.charts)', () => {
  it('chart is a structurally valid block with type "chart"', () => {
    const block = makeChartBlock();
    expect(block.type).toBe('chart');
    expect(block.blockId).toBe('blk-chart-1');
  });

  it('all 6 chart kinds are accepted', () => {
    const kinds: DocumentChartKind[] = ['bar', 'line', 'pie', 'donut', 'scatter', 'area'];
    for (const kind of kinds) {
      const block = makeChartBlock({ kind });
      expect(isDocumentChartBlock(block)).toBe(true);
    }
  });

  it('legacy (non-chart) block kinds keep working unchanged', () => {
    const para = makeNonChartBlock();
    expect(para.type).toBe('paragraph');
    expect(isDocumentChartBlock(para)).toBe(false);
  });
});

describe('isDocumentChartBlock (Slice E17.charts)', () => {
  it('returns false for null / undefined', () => {
    expect(isDocumentChartBlock(null)).toBe(false);
    expect(isDocumentChartBlock(undefined)).toBe(false);
  });

  it('returns false for non-chart block types', () => {
    expect(isDocumentChartBlock(makeNonChartBlock())).toBe(false);
  });

  it('returns true for a fully-populated chart block', () => {
    expect(isDocumentChartBlock(makeChartBlock())).toBe(true);
  });

  it('returns false when content is missing or non-object', () => {
    expect(isDocumentChartBlock({ blockId: 'b', type: 'chart', content: null })).toBe(false);
    expect(isDocumentChartBlock({ blockId: 'b', type: 'chart', content: undefined })).toBe(false);
    expect(isDocumentChartBlock({ blockId: 'b', type: 'chart', content: 'not-object' })).toBe(
      false
    );
  });

  it('returns false when kind is missing or invalid', () => {
    const noKind: DocumentBlock = { blockId: 'b', type: 'chart', content: { title: 't' } };
    expect(isDocumentChartBlock(noKind)).toBe(false);
    const badKind: DocumentBlock = {
      blockId: 'b',
      type: 'chart',
      content: { kind: 'bubble', title: 't', series: [] },
    };
    expect(isDocumentChartBlock(badKind)).toBe(false);
  });

  it('returns false when title is empty / whitespace / non-string', () => {
    expect(
      isDocumentChartBlock(
        makeChartBlock({ title: '' } as unknown as Partial<DocumentChartBlockContent>)
      )
    ).toBe(false);
    expect(isDocumentChartBlock(makeChartBlock({ title: '   ' }))).toBe(false);
    expect(
      isDocumentChartBlock({
        blockId: 'b',
        type: 'chart',
        content: { kind: 'bar', title: 123, series: [] },
      })
    ).toBe(false);
  });

  it('returns false when series is non-array', () => {
    expect(
      isDocumentChartBlock({
        blockId: 'b',
        type: 'chart',
        content: { kind: 'bar', title: 't', series: 'oops' },
      })
    ).toBe(false);
  });

  it('returns false when any series carries a non-finite value', () => {
    expect(
      isDocumentChartBlock(makeChartBlock({ series: [{ label: 'A', values: [1, 2, NaN] }] }))
    ).toBe(false);
    expect(
      isDocumentChartBlock(makeChartBlock({ series: [{ label: 'A', values: [1, Infinity, 3] }] }))
    ).toBe(false);
  });

  it('returns false when series entry is missing label / values', () => {
    expect(
      isDocumentChartBlock({
        blockId: 'b',
        type: 'chart',
        content: { kind: 'bar', title: 't', series: [{ values: [1] }] },
      })
    ).toBe(false);
    expect(
      isDocumentChartBlock({
        blockId: 'b',
        type: 'chart',
        content: { kind: 'bar', title: 't', series: [{ label: 'A' }] },
      })
    ).toBe(false);
  });

  it('accepts an empty series array (zero series is structurally valid; QA flags it later)', () => {
    expect(isDocumentChartBlock(makeChartBlock({ series: [] }))).toBe(true);
  });

  it('accepts optional categories / axis labels / caption / color', () => {
    const block = makeChartBlock({
      categories: ['Q1', 'Q2', 'Q3', 'Q4'],
      xAxisLabel: 'Quarter',
      yAxisLabel: 'EUR (millions)',
      caption: 'Source: 2024 board pack',
      series: [{ label: 'Revenue', values: [100, 200, 300, 400], color: '#0EA5E9' }],
    });
    expect(isDocumentChartBlock(block)).toBe(true);
  });
});

describe('documentChartBlockContent (Slice E17.charts)', () => {
  it('returns null for null / undefined / non-chart / malformed', () => {
    expect(documentChartBlockContent(null)).toBe(null);
    expect(documentChartBlockContent(undefined)).toBe(null);
    expect(documentChartBlockContent(makeNonChartBlock())).toBe(null);
    expect(documentChartBlockContent({ blockId: 'b', type: 'chart', content: 'oops' })).toBe(null);
  });

  it('returns the typed content for a valid chart block', () => {
    const block = makeChartBlock({
      kind: 'line',
      title: 'Customer growth',
      series: [{ label: 'Active customers', values: [10, 20, 35, 50] }],
      caption: 'YoY trajectory',
    });
    const content = documentChartBlockContent(block);
    expect(content?.kind).toBe('line');
    expect(content?.title).toBe('Customer growth');
    expect(content?.series).toHaveLength(1);
    expect(content?.caption).toBe('YoY trajectory');
  });
});

describe('summarizeDocumentChartBlock (Slice E17.charts)', () => {
  it('returns the empty summary for non-chart / null / undefined / malformed', () => {
    const empty = {
      kind: null,
      title: null,
      seriesCount: 0,
      totalValueCount: 0,
      hasCaption: false,
      hasAxisLabels: false,
    };
    expect(summarizeDocumentChartBlock(null)).toEqual(empty);
    expect(summarizeDocumentChartBlock(undefined)).toEqual(empty);
    expect(summarizeDocumentChartBlock(makeNonChartBlock())).toEqual(empty);
    expect(summarizeDocumentChartBlock({ blockId: 'b', type: 'chart', content: null })).toEqual(
      empty
    );
  });

  it('counts well-formed series + total values', () => {
    const block = makeChartBlock({
      series: [
        { label: 'A', values: [1, 2, 3] },
        { label: 'B', values: [4, 5] },
      ],
    });
    const summary = summarizeDocumentChartBlock(block);
    expect(summary.seriesCount).toBe(2);
    expect(summary.totalValueCount).toBe(5);
  });

  it('drops malformed series from the count (defensive)', () => {
    const block: DocumentBlock = {
      blockId: 'b',
      type: 'chart',
      content: {
        kind: 'bar',
        title: 'Mixed',
        series: [
          { label: 'A', values: [1, 2, 3] },
          { label: 'B', values: [1, NaN, 3] }, // dropped: non-finite
          { label: 'C', values: [4, 5] },
          { values: [6] }, // dropped: missing label
          { label: 'D', values: 'oops' }, // dropped: non-array values
        ],
      },
    };
    const summary = summarizeDocumentChartBlock(block);
    expect(summary.seriesCount).toBe(2);
    expect(summary.totalValueCount).toBe(5);
  });

  it('reports kind / title and caption / axis presence', () => {
    const block = makeChartBlock({
      kind: 'pie',
      title: 'Revenue by segment',
      caption: 'FY2024',
      xAxisLabel: 'Segment',
    });
    const summary = summarizeDocumentChartBlock(block);
    expect(summary.kind).toBe('pie');
    expect(summary.title).toBe('Revenue by segment');
    expect(summary.hasCaption).toBe(true);
    expect(summary.hasAxisLabels).toBe(true);
  });

  it('whitespace-only title / caption / axis label collapse to false / null', () => {
    const block: DocumentBlock = {
      blockId: 'b',
      type: 'chart',
      content: {
        kind: 'bar',
        title: '   ',
        caption: '\t\n',
        xAxisLabel: '  ',
        yAxisLabel: '   ',
        series: [{ label: 'A', values: [1] }],
      },
    };
    const summary = summarizeDocumentChartBlock(block);
    expect(summary.title).toBe(null);
    expect(summary.hasCaption).toBe(false);
    expect(summary.hasAxisLabels).toBe(false);
  });

  it('reports kind null when kind is invalid', () => {
    const block: DocumentBlock = {
      blockId: 'b',
      type: 'chart',
      content: { kind: 'bubble', title: 't', series: [] },
    };
    expect(summarizeDocumentChartBlock(block).kind).toBe(null);
  });

  it('does not mutate the input block', () => {
    const block = makeChartBlock({
      caption: 'Some caption',
      series: [{ label: 'A', values: [1, 2, 3] }],
    });
    const before = JSON.stringify(block);
    summarizeDocumentChartBlock(block);
    expect(JSON.stringify(block)).toBe(before);
  });
});
