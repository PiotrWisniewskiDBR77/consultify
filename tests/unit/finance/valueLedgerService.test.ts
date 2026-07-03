import { beforeEach, describe, expect, it, vi } from 'vitest';

// M16/3.4 — Frozen Baseline & Value Ledger.
//   Layer 1: pure currentValueFromLedger (baseline + deltas → current + audit trail).
//   Layer 2: DB-touching freezeBaseline / appendLedgerEntry with mocked DbPromise —
//            verifies org-scoping, prior-baseline deactivation, and insert wiring.

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
}));
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as DbPromise from '../../../server/src/utils/DbPromise.js';
import {
  appendLedgerEntry,
  currentValueFromLedger,
  freezeBaseline,
  getActiveBaseline,
} from '../../../server/src/services/valueLedgerService.js';

const dbRun = vi.mocked(DbPromise.run);
const dbGet = vi.mocked(DbPromise.get);

beforeEach(() => {
  vi.clearAllMocks();
  // Default: all writes (schema DDL + inserts/updates) succeed.
  dbRun.mockResolvedValue({ success: true, changes: 1 } as never);
});

// ---------------------------------------------------------------------------
// Layer 1 — pure currentValueFromLedger
// ---------------------------------------------------------------------------

describe('currentValueFromLedger (pure)', () => {
  it('baseline only → current equals frozen value, single audit step', () => {
    const res = currentValueFromLedger({ frozen_value: 100, id: 'b1' }, []);
    expect(res.current).toBe(100);
    expect(res.baselineValue).toBe(100);
    expect(res.auditTrail).toHaveLength(1);
    expect(res.auditTrail[0].kind).toBe('baseline');
    expect(res.auditTrail[0].runningTotal).toBe(100);
  });

  it('baseline + deltas → sums and reports running totals in order', () => {
    const res = currentValueFromLedger({ frozen_value: 100, id: 'b1' }, [
      { id: 'e1', entry_type: 'correction', value_delta: 25 },
      { id: 'e2', entry_type: 'adjustment', value_delta: -10 },
    ]);
    expect(res.current).toBe(115);
    expect(res.auditTrail).toHaveLength(3);
    expect(res.auditTrail.map((s) => s.runningTotal)).toEqual([100, 125, 115]);
    expect(res.auditTrail[1].kind).toBe('correction');
    expect(res.auditTrail[2].delta).toBe(-10);
  });

  it('null baseline treated as zero', () => {
    const res = currentValueFromLedger(null, [{ value_delta: 7 }]);
    expect(res.baselineValue).toBe(0);
    expect(res.current).toBe(7);
    expect(res.auditTrail[0].kind).toBe('baseline');
  });

  it('carries reason and provenance into the audit trail', () => {
    const res = currentValueFromLedger({ frozen_value: 0 }, [
      { value_delta: 5, reason: 'restated Q3', provenance: 'finance-statement:42' },
    ]);
    expect(res.auditTrail[1].reason).toBe('restated Q3');
    expect(res.auditTrail[1].provenance).toBe('finance-statement:42');
  });

  it('coerces non-numeric deltas to zero', () => {
    const res = currentValueFromLedger({ frozen_value: 10 }, [
      { value_delta: Number.NaN as unknown as number },
    ]);
    expect(res.current).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Layer 2 — freezeBaseline (mocked DbPromise: deactivate + insert)
// ---------------------------------------------------------------------------

describe('freezeBaseline (DB)', () => {
  it('deactivates prior active baseline then inserts the new one, org-scoped', async () => {
    const row = await freezeBaseline('org-1', {
      initiativeId: 'init-1',
      kpiId: 'kpi-1',
      value: 250,
      frozenBy: 'user-9',
      sourceSnapshot: { period: '2024Q4' },
    });

    // schema DDL runs are also dbRun calls; filter to the meaningful statements.
    const updateCall = dbRun.mock.calls.find((c) => /UPDATE value_baselines/i.test(c[0] as string));
    const insertCall = dbRun.mock.calls.find((c) => /INSERT INTO value_baselines/i.test(c[0] as string));

    expect(updateCall).toBeTruthy();
    // deactivation is scoped to org + initiative + kpi + is_active = 1
    expect(updateCall![0]).toMatch(/is_active = 0/i);
    expect(updateCall![1]).toEqual(['org-1', 'init-1', 'kpi-1']);

    expect(insertCall).toBeTruthy();
    const insParams = insertCall![1] as unknown[];
    expect(insParams[1]).toBe('org-1'); // organization_id
    expect(insParams[2]).toBe('init-1');
    expect(insParams[3]).toBe('kpi-1');
    expect(insParams[4]).toBe(250); // frozen_value
    expect(insParams[6]).toBe('user-9'); // frozen_by
    expect(insParams[7]).toBe(JSON.stringify({ period: '2024Q4' })); // serialized snapshot

    expect(row.organization_id).toBe('org-1');
    expect(row.frozen_value).toBe(250);
    expect(row.is_active).toBe(1);
  });

  it('throws on insert failure', async () => {
    dbRun.mockImplementation((sql: string) => {
      if (/INSERT INTO value_baselines/i.test(sql)) {
        return Promise.resolve({ success: false, error: 'boom' }) as never;
      }
      return Promise.resolve({ success: true, changes: 1 }) as never;
    });

    await expect(
      freezeBaseline('org-1', { initiativeId: 'i', kpiId: 'k', value: 1 })
    ).rejects.toThrow(/boom/);
  });
});

// ---------------------------------------------------------------------------
// Layer 2 — appendLedgerEntry (org-scope + provenance)
// ---------------------------------------------------------------------------

describe('appendLedgerEntry (DB)', () => {
  it('inserts an org-scoped entry with serialized provenance', async () => {
    const row = await appendLedgerEntry('org-7', {
      initiativeId: 'init-3',
      entryType: 'correction',
      valueDelta: -12.5,
      reason: 'double-count fix',
      provenance: { source: 'audit', ref: 'A-19' },
      createdBy: 'analyst-2',
    });

    const insertCall = dbRun.mock.calls.find((c) =>
      /INSERT INTO value_ledger_entries/i.test(c[0] as string)
    );
    expect(insertCall).toBeTruthy();
    const p = insertCall![1] as unknown[];
    expect(p[1]).toBe('org-7'); // organization_id
    expect(p[2]).toBe('init-3'); // initiative_id
    expect(p[3]).toBe('correction'); // entry_type
    expect(p[4]).toBe(-12.5); // value_delta
    expect(p[5]).toBe('double-count fix'); // reason
    expect(p[6]).toBe(JSON.stringify({ source: 'audit', ref: 'A-19' })); // provenance
    expect(p[7]).toBe('analyst-2'); // created_by

    expect(row.organization_id).toBe('org-7');
    expect(row.value_delta).toBe(-12.5);
    expect(row.provenance).toBe(JSON.stringify({ source: 'audit', ref: 'A-19' }));
  });

  it('throws on insert failure', async () => {
    dbRun.mockImplementation((sql: string) => {
      if (/INSERT INTO value_ledger_entries/i.test(sql)) {
        return Promise.resolve({ success: false, error: 'nope' }) as never;
      }
      return Promise.resolve({ success: true, changes: 1 }) as never;
    });

    await expect(
      appendLedgerEntry('org-7', { initiativeId: 'i', entryType: 't', valueDelta: 1 })
    ).rejects.toThrow(/nope/);
  });
});

// ---------------------------------------------------------------------------
// Layer 2 — getActiveBaseline (org-scoped read)
// ---------------------------------------------------------------------------

describe('getActiveBaseline (DB)', () => {
  it('reads the single active baseline scoped by org + initiative + kpi', async () => {
    dbGet.mockResolvedValue({
      id: 'b1',
      organization_id: 'org-1',
      initiative_id: 'init-1',
      kpi_id: 'kpi-1',
      frozen_value: 99,
      frozen_at: '2024-01-01',
      frozen_by: null,
      source_snapshot: null,
      is_active: 1,
    } as never);

    const row = await getActiveBaseline('org-1', 'init-1', 'kpi-1');
    expect(row?.frozen_value).toBe(99);

    const call = dbGet.mock.calls.at(-1)!;
    expect(call[0]).toMatch(/is_active = 1/i);
    expect(call[1]).toEqual(['org-1', 'init-1', 'kpi-1']);
  });

  it('returns null when none active', async () => {
    dbGet.mockResolvedValue(null as never);
    expect(await getActiveBaseline('org-1', 'init-1', 'kpi-1')).toBeNull();
  });
});
