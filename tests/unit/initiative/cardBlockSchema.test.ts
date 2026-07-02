/**
 * cardBlockSchema.test — F3 walidator (D11).
 * Wzór: deckDesignCritic — deterministyczny, fail-open, issues[].
 */

import { describe, expect, it } from 'vitest';

import {
  CARD_BLOCK_TYPES,
  type CardSpec,
  hasCriticalIssues,
  isRenderableCardSpec,
  validateCardSpec,
} from '@/components/Initiatives/cards/cardBlockSchema';

function baseSpec(blocks: CardSpec['blocks']): CardSpec {
  return { sectionKey: 'problemDefinition', title: 'Definicja problemu', blocks };
}

describe('cardBlockSchema — vocabulary', () => {
  it('exposes the 7 block types with M17 parity naming', () => {
    expect([...CARD_BLOCK_TYPES]).toEqual([
      'heading',
      'paragraph',
      'kpi_strip',
      'bullet_list',
      'table',
      'chart',
      'callout',
    ]);
  });
});

describe('validateCardSpec — spec-level guards', () => {
  it('flags null/undefined spec as CRITICAL', () => {
    const issues = validateCardSpec(null);
    expect(issues.length).toBeGreaterThan(0);
    expect(hasCriticalIssues(issues)).toBe(true);
  });

  it('flags missing sectionKey (CB-01)', () => {
    const issues = validateCardSpec({ sectionKey: '', title: 'x', blocks: [{ type: 'paragraph', text: 'a' }] });
    expect(issues.some((i) => i.code === 'CB-01-NO-SECTION-KEY')).toBe(true);
  });

  it('flags missing title (CB-02, MAJOR not critical)', () => {
    const issues = validateCardSpec({ sectionKey: 'overview', title: '', blocks: [{ type: 'paragraph', text: 'a' }] });
    const titleIssue = issues.find((i) => i.code === 'CB-02-NO-TITLE');
    expect(titleIssue?.severity).toBe('MAJOR');
  });

  it('flags empty blocks array (CB-03 CRITICAL)', () => {
    const issues = validateCardSpec(baseSpec([]));
    expect(issues.some((i) => i.code === 'CB-03-EMPTY-BLOCKS')).toBe(true);
    expect(hasCriticalIssues(issues)).toBe(true);
  });

  it('flags unknown block type (CB-04 CRITICAL)', () => {
    const issues = validateCardSpec(baseSpec([{ type: 'bogus' } as never]));
    expect(issues.some((i) => i.code === 'CB-04-UNKNOWN-BLOCK-TYPE')).toBe(true);
  });
});

describe('validateCardSpec — per-block content', () => {
  it('flags empty paragraph/heading text (CB-05)', () => {
    const issues = validateCardSpec(baseSpec([{ type: 'paragraph', text: '   ' }]));
    expect(issues.some((i) => i.code === 'CB-05-EMPTY-BLOCK-CONTENT' && i.blockIndex === 0)).toBe(true);
  });

  it('flags empty bullet_list (CB-05)', () => {
    const issues = validateCardSpec(baseSpec([{ type: 'bullet_list', items: ['', '   '] }]));
    expect(issues.some((i) => i.code === 'CB-05-EMPTY-BLOCK-CONTENT')).toBe(true);
  });

  it('flags kpi_strip without valid tiles (CB-08)', () => {
    const issues = validateCardSpec(baseSpec([{ type: 'kpi_strip', tiles: [{ label: '', value: '' }] }]));
    expect(issues.some((i) => i.code === 'CB-08-KPI-EMPTY')).toBe(true);
  });

  it('flags table with row length mismatch (CB-06 MAJOR)', () => {
    const issues = validateCardSpec(
      baseSpec([{ type: 'table', columns: ['A', 'B'], rows: [['1']] }]),
    );
    const t = issues.find((i) => i.code === 'CB-06-TABLE-SHAPE');
    expect(t?.severity).toBe('MAJOR');
  });

  it('flags table without columns (CB-06)', () => {
    const issues = validateCardSpec(baseSpec([{ type: 'table', columns: [], rows: [] }]));
    expect(issues.some((i) => i.code === 'CB-06-TABLE-SHAPE')).toBe(true);
  });

  it('flags chart without valid series (CB-07)', () => {
    const issues = validateCardSpec(
      baseSpec([{ type: 'chart', chartKind: 'bar', series: [{ label: '', value: NaN }] }]),
    );
    expect(issues.some((i) => i.code === 'CB-07-CHART-EMPTY')).toBe(true);
  });

  it('flags empty callout text (CB-05)', () => {
    const issues = validateCardSpec(baseSpec([{ type: 'callout', tone: 'warning', text: '' }]));
    expect(issues.some((i) => i.code === 'CB-05-EMPTY-BLOCK-CONTENT')).toBe(true);
  });
});

describe('validateCardSpec — accepts valid specs (one per block type)', () => {
  it('accepts a full valid spec covering every block type', () => {
    const spec: CardSpec = baseSpec([
      { type: 'heading', text: 'Symptom', level: 4 },
      { type: 'paragraph', text: 'Proces trwa 5 dni.', emphasis: 'lead' },
      {
        type: 'kpi_strip',
        tiles: [
          { label: 'Czas', value: '5 dni', delta: '-2 dni', trend: 'down' },
          { label: 'Koszt', value: '120k zł' },
        ],
      },
      { type: 'bullet_list', items: ['Punkt A', 'Punkt B'], ordered: false },
      { type: 'table', columns: ['Metryka', 'Wartość'], rows: [['ROI', '23%'], ['NPV', '1.2M']] },
      { type: 'chart', chartKind: 'bar', title: 'Trend', series: [{ label: 'Q1', value: 10 }, { label: 'Q2', value: 14 }] },
      { type: 'callout', tone: 'danger', title: 'Ryzyko', text: 'Brak danych źródłowych.' },
    ]);
    const issues = validateCardSpec(spec);
    expect(issues).toEqual([]);
    expect(hasCriticalIssues(issues)).toBe(false);
    expect(isRenderableCardSpec(spec)).toBe(true);
  });

  it('isRenderableCardSpec is false when a CRITICAL issue exists', () => {
    expect(isRenderableCardSpec(baseSpec([]))).toBe(false);
  });

  it('table with no rows is only MINOR (renderable)', () => {
    const spec = baseSpec([{ type: 'table', columns: ['A'], rows: [] }]);
    const issues = validateCardSpec(spec);
    expect(issues.every((i) => i.severity !== 'CRITICAL')).toBe(true);
    expect(isRenderableCardSpec(spec)).toBe(true);
  });
});
