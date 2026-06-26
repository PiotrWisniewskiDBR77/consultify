// @vitest-environment node
/**
 * W10.2 — qualityTelemetry: agregacja scorecardów na poziomie organizacji.
 */
import { describe, expect, it } from 'vitest';
import {
  aggregateQualityTelemetry,
  recordsFromRows,
  type TelemetryRecord,
} from '../../../server/src/services/deliverables/qualityTelemetry';

function rec(overall: number, grade: any, capped = false, topIssues: string[] = [], createdAt: string | number = 1000): TelemetryRecord {
  return { scorecard: { overall, grade, capped, topIssues }, createdAt };
}

describe('W10.2 — aggregateQualityTelemetry: podstawy', () => {
  it('pusta lista → zerowa telemetria', () => {
    const t = aggregateQualityTelemetry([]);
    expect(t.count).toBe(0);
    expect(t.averageScore).toBe(0);
    expect(t.topRecurringIssues).toEqual([]);
  });

  it('liczy średnią, medianę, count', () => {
    const t = aggregateQualityTelemetry([rec(90, 'A'), rec(80, 'B'), rec(70, 'C')]);
    expect(t.count).toBe(3);
    expect(t.averageScore).toBe(80);
    expect(t.medianScore).toBe(80);
  });

  it('rozkład ocen A-F', () => {
    const t = aggregateQualityTelemetry([rec(95, 'A'), rec(92, 'A'), rec(85, 'B'), rec(40, 'F')]);
    expect(t.gradeDistribution.A).toBe(2);
    expect(t.gradeDistribution.B).toBe(1);
    expect(t.gradeDistribution.F).toBe(1);
    expect(t.gradeDistribution.C).toBe(0);
  });

  it('goodRate = udział A+B', () => {
    const t = aggregateQualityTelemetry([rec(95, 'A'), rec(85, 'B'), rec(70, 'C'), rec(50, 'F')]);
    expect(t.goodRate).toBe(0.5); // 2/4
  });

  it('cappedRate = udział z capem', () => {
    const t = aggregateQualityTelemetry([rec(59, 'F', true), rec(90, 'A', false), rec(55, 'F', true), rec(80, 'B', false)]);
    expect(t.cappedRate).toBe(0.5);
  });
});

describe('W10.2 — top recurring issues (priorytetyzacja napraw)', () => {
  it('grupuje po kodzie AP/DR i liczy częstość', () => {
    const t = aggregateQualityTelemetry([
      rec(50, 'F', true, ['AP-05-NO-COVER: brak cover', 'DR-01: za gęsto']),
      rec(55, 'F', true, ['AP-05-NO-COVER: brak cover na innym']),
      rec(58, 'F', true, ['AP-05-NO-COVER: kolejny']),
    ]);
    const ap05 = t.topRecurringIssues.find((i) => i.issue === 'AP-05');
    expect(ap05?.count).toBe(3);
    expect(t.topRecurringIssues[0].issue).toBe('AP-05'); // najczęstszy pierwszy
  });

  it('max 10 issue-grup', () => {
    const issues = Array.from({ length: 20 }, (_, i) => `Problem ${i}: detail`);
    const t = aggregateQualityTelemetry([rec(50, 'F', true, issues)]);
    expect(t.topRecurringIssues.length).toBeLessThanOrEqual(10);
  });
});

describe('W10.2 — trend', () => {
  it('poprawa w czasie → trendDelta dodatni', () => {
    // wcześniejsze niskie, późniejsze wysokie
    const t = aggregateQualityTelemetry([
      rec(50, 'F', false, [], 1000),
      rec(55, 'F', false, [], 2000),
      rec(85, 'B', false, [], 3000),
      rec(90, 'A', false, [], 4000),
    ]);
    expect(t.trendDelta).toBeGreaterThan(0);
  });

  it('pogorszenie → trendDelta ujemny', () => {
    const t = aggregateQualityTelemetry([
      rec(90, 'A', false, [], 1000),
      rec(88, 'B', false, [], 2000),
      rec(60, 'D', false, [], 3000),
      rec(55, 'F', false, [], 4000),
    ]);
    expect(t.trendDelta).toBeLessThan(0);
  });

  it('kolejność wejścia nie wpływa (sortuje chronologicznie)', () => {
    const ordered = aggregateQualityTelemetry([rec(50, 'F', false, [], 1000), rec(90, 'A', false, [], 2000)]);
    const shuffled = aggregateQualityTelemetry([rec(90, 'A', false, [], 2000), rec(50, 'F', false, [], 1000)]);
    expect(ordered.trendDelta).toBe(shuffled.trendDelta);
    expect(ordered.trendDelta).toBeGreaterThan(0);
  });
});

describe('W10.2 — materiały bez scorecardu pomijane', () => {
  it('null scorecard nie liczony', () => {
    const t = aggregateQualityTelemetry([
      rec(90, 'A'),
      { scorecard: null, createdAt: 2000 },
      rec(80, 'B'),
    ]);
    expect(t.count).toBe(2); // tylko 2 ze scorecardem
    expect(t.averageScore).toBe(85);
  });

  it('wszystkie null → zerowa telemetria', () => {
    const t = aggregateQualityTelemetry([{ scorecard: null, createdAt: 1 }]);
    expect(t.count).toBe(0);
  });
});

describe('W10.2 — recordsFromRows (DB → rekordy)', () => {
  it('wyciąga scorecard z quality_json', () => {
    const rows = [
      { quality_json: { scorecard: { overall: 88, grade: 'B', capped: false, topIssues: ['x'] } }, created_at: '2026-06-26' },
      { quality_json: { passed: true }, created_at: '2026-06-25' }, // brak scorecard
      { quality_json: null, created_at: '2026-06-24' },
    ];
    const records = recordsFromRows(rows);
    expect(records).toHaveLength(3);
    expect(records[0].scorecard?.overall).toBe(88);
    expect(records[1].scorecard).toBeNull();
    expect(records[2].scorecard).toBeNull();
  });

  it('niepoprawne wejście → []', () => {
    // @ts-expect-error celowo null
    expect(recordsFromRows(null)).toEqual([]);
  });

  it('integracja: rows → records → telemetria', () => {
    const rows = [
      { quality_json: { scorecard: { overall: 90, grade: 'A', capped: false, topIssues: [] } }, created_at: 1000 },
      { quality_json: { scorecard: { overall: 70, grade: 'C', capped: false, topIssues: [] } }, created_at: 2000 },
    ];
    const t = aggregateQualityTelemetry(recordsFromRows(rows));
    expect(t.count).toBe(2);
    expect(t.averageScore).toBe(80);
  });
});
