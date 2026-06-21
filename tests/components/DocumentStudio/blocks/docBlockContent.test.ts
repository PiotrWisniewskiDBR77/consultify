/**
 * R3 — pure narrower contract tests (no React).
 *
 * Covers: chart dual-key tolerance, table dual-key (columns??headers, array
 * vs object rows), KPI both shapes (items[] vs columns+rows), and the hard
 * rule that garbage input → null (never throws).
 */

import { describe, expect, it } from 'vitest';

import {
  narrowChartContent,
  narrowKpiContent,
  narrowTableContent,
} from '../../../../src/components/DocumentStudio/blocks/docBlockContent';

describe('narrowChartContent', () => {
  it('narrows canonical {kind,categories,series}', () => {
    const c = narrowChartContent({
      kind: 'bar',
      title: 'Revenue',
      categories: ['Q1', 'Q2'],
      series: [{ label: 'Net', values: [10, 20] }],
    });
    expect(c).not.toBeNull();
    expect(c!.kind).toBe('bar');
    expect(c!.categories).toEqual(['Q1', 'Q2']);
    expect(c!.series[0].values).toEqual([10, 20]);
  });

  it('tolerates dual keys: type→kind, labels→categories, datasets→series, name→label, data→values', () => {
    const c = narrowChartContent({
      type: 'line',
      labels: ['A', 'B'],
      datasets: [{ name: 'X', data: [1, 2] }],
    });
    expect(c).not.toBeNull();
    expect(c!.kind).toBe('line');
    expect(c!.categories).toEqual(['A', 'B']);
    expect(c!.series[0].label).toBe('X');
    expect(c!.series[0].values).toEqual([1, 2]);
  });

  it('recovers a flat [{name,value}] data array into one series', () => {
    const c = narrowChartContent({
      kind: 'pie',
      data: [
        { name: 'Red', value: 3 },
        { name: 'Blue', value: 7 },
      ],
    });
    expect(c).not.toBeNull();
    expect(c!.categories).toEqual(['Red', 'Blue']);
    expect(c!.series[0].values).toEqual([3, 7]);
  });

  it('coerces numeric strings ("1 200", "12%", "1,5")', () => {
    const c = narrowChartContent({
      kind: 'bar',
      categories: ['a', 'b', 'c'],
      series: [{ label: 'S', values: ['1 200', '12%', '1,5'] }],
    });
    expect(c!.series[0].values).toEqual([1200, 12, 1.5]);
  });

  it('garbage → null, never throws', () => {
    expect(narrowChartContent(null)).toBeNull();
    expect(narrowChartContent(undefined)).toBeNull();
    expect(narrowChartContent('nope')).toBeNull();
    expect(narrowChartContent(42)).toBeNull();
    expect(narrowChartContent({})).toBeNull();
    expect(narrowChartContent({ kind: 'bar', series: [] })).toBeNull();
    expect(narrowChartContent({ series: [{ label: 'x', values: [] }] })).toBeNull();
  });
});

describe('narrowTableContent', () => {
  it('narrows columns + array rows', () => {
    const t = narrowTableContent({
      columns: ['Name', 'Score'],
      rows: [['Alpha', '90'], ['Beta', '80']],
    });
    expect(t).not.toBeNull();
    expect(t!.columns).toEqual(['Name', 'Score']);
    expect(t!.rows).toEqual([['Alpha', '90'], ['Beta', '80']]);
  });

  it('dual-key: headers→columns, and object rows projected onto columns', () => {
    const t = narrowTableContent({
      headers: ['Name', 'Score'],
      data: [{ Name: 'Alpha', Score: 90 }],
    });
    expect(t!.columns).toEqual(['Name', 'Score']);
    expect(t!.rows).toEqual([['Alpha', '90']]);
  });

  it('infers columns from first object row when none declared', () => {
    const t = narrowTableContent({ rows: [{ a: 1, b: 2 }] });
    expect(t!.columns).toEqual(['a', 'b']);
    expect(t!.rows).toEqual([['1', '2']]);
  });

  it('sets riskSemantics from variant / opts', () => {
    expect(narrowTableContent({ columns: ['Impact'], rows: [['High']], variant: 'risk' })!.riskSemantics).toBe(true);
    expect(narrowTableContent({ columns: ['x'], rows: [['y']] }, { riskSemantics: true })!.riskSemantics).toBe(true);
    expect(narrowTableContent({ columns: ['x'], rows: [['y']] })!.riskSemantics).toBe(false);
  });

  it('garbage → null, never throws', () => {
    expect(narrowTableContent(null)).toBeNull();
    expect(narrowTableContent('x')).toBeNull();
    expect(narrowTableContent({})).toBeNull();
  });
});

describe('narrowKpiContent', () => {
  it('shape A: items[]', () => {
    const k = narrowKpiContent({
      items: [
        { label: 'Revenue', value: '1.2M', delta: '+8%', trend: 'up' },
        { name: 'Churn', amount: '3%', change: '-1%', direction: 'down' },
      ],
    });
    expect(k).not.toBeNull();
    expect(k!.items).toHaveLength(2);
    expect(k!.items[0]).toMatchObject({ label: 'Revenue', value: '1.2M', delta: '+8%', trend: 'up' });
    expect(k!.items[1]).toMatchObject({ label: 'Churn', value: '3%', delta: '-1%', trend: 'down' });
  });

  it('shape B: columns + rows (server kpi_strip markdown shape)', () => {
    const k = narrowKpiContent({
      columns: ['Metric', 'Value', 'Δ'],
      rows: [
        ['Revenue', '1.2M', '+8%'],
        ['NPS', '52', '+3'],
      ],
    });
    expect(k).not.toBeNull();
    expect(k!.items).toHaveLength(2);
    expect(k!.items[0]).toMatchObject({ label: 'Revenue', value: '1.2M', delta: '+8%' });
    expect(k!.items[1]).toMatchObject({ label: 'NPS', value: '52', delta: '+3' });
  });

  it('garbage / empty → null, never throws', () => {
    expect(narrowKpiContent(null)).toBeNull();
    expect(narrowKpiContent({})).toBeNull();
    expect(narrowKpiContent({ items: [] })).toBeNull();
    expect(narrowKpiContent({ rows: [] })).toBeNull();
    expect(narrowKpiContent('x')).toBeNull();
  });
});
