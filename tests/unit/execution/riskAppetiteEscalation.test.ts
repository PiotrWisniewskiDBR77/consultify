/**
 * M14/F3 — risk appetite drives escalation (detectRiskSignals).
 *
 * Two fixes locked here:
 *  - "high risk" uses the canonical P×I category (AMBER+RED), not raw HIGH/CRITICAL
 *    impact — so a HIGH-impact × LOW-probability risk (score 3 = GREEN) no longer
 *    fires UNOWNED/UNMITIGATED signals.
 *  - `auto_escalate_above` (previously dead config, zero readers) now emits an
 *    APPETITE_BREACH signal when the score reaches the org threshold.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbAll, getTableColumns } = vi.hoisted(() => ({
  dbAll: vi.fn(),
  getTableColumns: vi.fn(),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({ all: (...a: any[]) => dbAll(...a) }));
vi.mock('../../../server/src/utils/dbSchema.js', () => ({
  getTableColumns: (...a: any[]) => getTableColumns(...a),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { detectRiskSignals } from '../../../server/src/services/riskDetectionService.js';

function risk(over: Record<string, unknown>) {
  return {
    id: 'r1',
    initiative_id: 'ini-1',
    type: 'RISK',
    title: 'Vendor lock-in',
    status: 'OPEN',
    probability: 'HIGH',
    impact: 'CRITICAL',
    owner_id: 'owner-1',
    mitigation_plan: 'plan',
    mitigation_status: 'CLOSED',
    due_date: null,
    ...over,
  };
}

// SQL-content router so the test is independent of query order.
function wire(raidRows: any[], appetiteRows: any[]) {
  dbAll.mockImplementation((sql: string) => {
    if (/raid_appetite_thresholds/i.test(sql)) return Promise.resolve(appetiteRows);
    if (/FROM raid_items/i.test(sql)) return Promise.resolve(raidRows);
    return Promise.resolve([]); // dismissals, initiatives, tasks → empty
  });
  getTableColumns.mockResolvedValue(new Set(['priority', 'planned_end_date', 'progress']));
}

beforeEach(() => vi.clearAllMocks());

describe('detectRiskSignals — appetite-driven escalation', () => {
  it('emits APPETITE_BREACH when score reaches the default threshold (12)', async () => {
    wire([risk({ probability: 'HIGH', impact: 'CRITICAL' })], []); // score 12, default auto-escalate 12
    const out = await detectRiskSignals('org-1');
    expect(out.some((s) => s.signalType === 'APPETITE_BREACH')).toBe(true);
  });

  it('respects a lower org auto_escalate_above (8) → MED×CRITICAL breaches', async () => {
    wire(
      [risk({ probability: 'MEDIUM', impact: 'CRITICAL', owner_id: 'o', mitigation_status: 'CLOSED' })], // score 8
      [{ green_max: 4, amber_max: 9, red_min: 10, auto_escalate_above: 8 }]
    );
    const out = await detectRiskSignals('org-1');
    const breach = out.find((s) => s.signalType === 'APPETITE_BREACH');
    expect(breach).toBeTruthy();
    expect((breach!.sourceData as any).threshold).toBe(8);
  });

  it('does NOT treat HIGH-impact × LOW-probability (score 3 = GREEN) as high risk', async () => {
    // No owner + no mitigation, but GREEN category → no UNOWNED/UNMITIGATED/APPETITE signals.
    wire(
      [risk({ probability: 'LOW', impact: 'HIGH', owner_id: null, mitigation_plan: '', mitigation_status: 'OPEN' })],
      []
    );
    const out = await detectRiskSignals('org-1');
    expect(out.some((s) => s.signalType === 'UNOWNED_RISK')).toBe(false);
    expect(out.some((s) => s.signalType === 'UNMITIGATED_HIGH_RISK')).toBe(false);
    expect(out.some((s) => s.signalType === 'APPETITE_BREACH')).toBe(false);
  });

  it('still flags a genuine high risk (AMBER+) without owner', async () => {
    wire([risk({ probability: 'HIGH', impact: 'HIGH', owner_id: null })], []); // score 9 = AMBER
    const out = await detectRiskSignals('org-1');
    expect(out.some((s) => s.signalType === 'UNOWNED_RISK')).toBe(true);
  });
});
