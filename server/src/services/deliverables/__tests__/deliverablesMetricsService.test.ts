/**
 * Metryki deliverables (§8 spec) — agregacja eventów telemetrii.
 * dbAll mockowany na granicy modułu; spec biega bez DB.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbAllMock = vi.fn();
vi.mock('../../../utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => dbAllMock(...args),
}));

const { getDeliverableMetrics } = await import('../deliverablesMetricsService.js');

const ORG = 'org-1';

function ev(
  format: string,
  event_type: string,
  duration_ms: number | null = null,
  unit_count: number | null = null,
  grounding_mode: string | null = null
) {
  return { format, event_type, duration_ms, unit_count, grounding_mode };
}

beforeEach(() => vi.clearAllMocks());

describe('getDeliverableMetrics', () => {
  it('brak tabeli/błąd zapytania ⇒ puste metryki, nie rzuca', async () => {
    dbAllMock.mockRejectedValue(new Error('relation does not exist'));
    const m = await getDeliverableMetrics(ORG);
    expect(m.totals.requested).toBe(0);
    expect(m.byFormat).toEqual([]);
  });

  it('zero eventów ⇒ puste metryki', async () => {
    dbAllMock.mockResolvedValue([]);
    const m = await getDeliverableMetrics(ORG);
    expect(m.totals.completionRate).toBeNull();
  });

  it('liczy completion rate, p50/p95 i udział groundingu', async () => {
    dbAllMock.mockResolvedValue([
      ev('doc', 'plan_ready', null, null, 'source_refs'),
      ev('doc', 'completed', 10000, 5, null),
      ev('doc', 'plan_ready', null, null, 'conversation'),
      ev('doc', 'completed', 20000, 9, null),
      ev('doc', 'plan_ready', null, null, 'auto_scan'),
      ev('doc', 'failed', 3000, null, null),
      ev('sheet', 'plan_ready', null, null, 'conversation'),
      ev('sheet', 'completed', 8000, 12, null),
    ]);
    const m = await getDeliverableMetrics(ORG);

    expect(m.totals.requested).toBe(4); // 4× plan_ready
    expect(m.totals.completed).toBe(3);
    expect(m.totals.failed).toBe(1);
    // completed / terminal = 3/4 = 0.75
    expect(m.totals.completionRate).toBe(0.75);
    expect(m.totals.honestFailureCoverage).toBe(1.0);

    const doc = m.byFormat.find((f) => f.format === 'doc')!;
    expect(doc.completed).toBe(2);
    expect(doc.failed).toBe(1);
    expect(doc.avgDurationMs).toBe(15000); // (10000+20000)/2
    expect(doc.avgUnitCount).toBe(7); // (5+9)/2

    const sheet = m.byFormat.find((f) => f.format === 'sheet')!;
    expect(sheet.completed).toBe(1);
    expect(sheet.avgDurationMs).toBe(8000);

    // grounding: source_refs 1, conversation 2, auto_scan 1 → total 4
    const conv = m.groundingShare.find((g) => g.mode === 'conversation')!;
    expect(conv.count).toBe(2);
    expect(conv.share).toBe(0.5);
  });
});
