/**
 * Cross-org IDOR regression test for financeEnterpriseService.createModelVersion.
 *
 * When a new model version is branched from a `parentVersionId`, the parent
 * snapshot (assumptions/events/outputs) was previously read by `WHERE id = ?`
 * with NO org filter — letting org B seed a version from org A's confidential
 * financial snapshot. The fix scopes that read to the caller's org.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryOne = vi.fn();
const queryRun = vi.fn();
const queryAll = vi.fn();

vi.mock('../../utils/queryHelpers.js', () => ({
  queryOne: (...a: unknown[]) => queryOne(...a),
  queryRun: (...a: unknown[]) => queryRun(...a),
  queryAll: (...a: unknown[]) => queryAll(...a),
}));

vi.mock('../../database/Database.js', () => ({ getDatabase: vi.fn() }));

import { financeEnterpriseService } from '../financeEnterpriseService.js';

const ORG = 'org-attacker';
const PARENT_VERSION = 'version-owned-by-victim';

describe('financeEnterpriseService.createModelVersion — cross-org parent read', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryRun.mockResolvedValue({ changes: 1 });
  });

  it('scopes the parent-version snapshot read to the caller org', async () => {
    // version-number lookup, then the parent snapshot lookup (returns null:
    // foreign-org parent is invisible).
    // 1) assertModelOwned (parent model is owned), 2) version-number lookup,
    // 3) parent-snapshot lookup (foreign-org parent → null, invisible).
    queryOne
      .mockResolvedValueOnce({ id: 'model-1' })
      .mockResolvedValueOnce({ maxV: 0 })
      .mockResolvedValueOnce(null);

    await financeEnterpriseService.createModelVersion(ORG, 'user-1', {
      modelId: 'model-1',
      parentVersionId: PARENT_VERSION,
    });

    const parentCall = queryOne.mock.calls.find((c) =>
      String(c[0]).includes('assumptions_snapshot')
    );
    expect(parentCall).toBeDefined();
    const [sql, params] = parentCall as [string, unknown[]];
    // The parent read MUST be org-filtered.
    expect(sql).toMatch(/organization_id\s*=\s*\?/i);
    expect(params).toEqual([PARENT_VERSION, ORG]);
  });

  it('does NOT copy a foreign-org parent snapshot into the new version', async () => {
    // 1) assertModelOwned (parent model is owned), 2) version-number lookup,
    // 3) parent-snapshot lookup (foreign-org parent → null, invisible).
    queryOne
      .mockResolvedValueOnce({ id: 'model-1' })
      .mockResolvedValueOnce({ maxV: 0 })
      .mockResolvedValueOnce(null);

    await financeEnterpriseService.createModelVersion(ORG, 'user-1', {
      modelId: 'model-1',
      parentVersionId: PARENT_VERSION,
    });

    const insert = queryRun.mock.calls.find((c) =>
      String(c[0]).includes('INSERT INTO financial_model_versions')
    );
    expect(insert).toBeDefined();
    const [, params] = insert as [string, unknown[]];
    // Defaults persist (empty snapshots) — no leaked victim data.
    expect(params).toContain('{}');
    expect(params).toContain('[]');
  });
});

// ════════════════════════════════════════════════════════════
// SEC: child-row writes require parent financial_model ownership.
// A foreign-org modelId must be rejected ('Model not found') and
// must NOT produce any INSERT — preventing org A from grafting
// child rows (budget/allocation/forecast/valuation/assumption/ROI)
// onto org B's financial model.
// ════════════════════════════════════════════════════════════

const FOREIGN_MODEL = 'model-owned-by-victim';

/** assertModelOwned issues `SELECT id FROM financial_models ... AND organization_id = ?`. */
function modelOwnershipReadIsOrgScoped(): void {
  const call = queryOne.mock.calls.find((c) => String(c[0]).includes('FROM financial_models'));
  expect(call).toBeDefined();
  const [sql, params] = call as [string, unknown[]];
  expect(sql).toMatch(/organization_id\s*=\s*\?/i);
  expect(params).toEqual([FOREIGN_MODEL, ORG]);
}

function noInsertHappened(): void {
  const inserts = queryRun.mock.calls.filter((c) => String(c[0]).includes('INSERT INTO'));
  expect(inserts).toHaveLength(0);
}

describe('financeEnterpriseService child-writes — parent model ownership gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryRun.mockResolvedValue({ changes: 1 });
    // First queryOne in every create* path is assertModelOwned → foreign = null.
    queryOne.mockResolvedValue(null);
  });

  it('createAllocation rejects a foreign-org modelId and writes nothing', async () => {
    await expect(
      financeEnterpriseService.createAllocation(ORG, { modelId: FOREIGN_MODEL })
    ).rejects.toThrow(/not found/i);
    modelOwnershipReadIsOrgScoped();
    noInsertHappened();
  });

  it('createBudgetVersion rejects a foreign-org modelId and writes nothing', async () => {
    await expect(
      financeEnterpriseService.createBudgetVersion(ORG, 'user-1', {
        modelId: FOREIGN_MODEL,
        fiscalYear: 2026,
        plannedData: { rev: 100 },
      })
    ).rejects.toThrow(/not found/i);
    modelOwnershipReadIsOrgScoped();
    noInsertHappened();
  });

  it('createForecastCycle rejects a foreign-org modelId and writes nothing', async () => {
    await expect(
      financeEnterpriseService.createForecastCycle(ORG, {
        modelId: FOREIGN_MODEL,
        cycleName: 'Q1',
      })
    ).rejects.toThrow(/not found/i);
    modelOwnershipReadIsOrgScoped();
    noInsertHappened();
  });

  it('createValuationSnapshot rejects a foreign-org modelId and writes nothing', async () => {
    await expect(
      financeEnterpriseService.createValuationSnapshot(ORG, 'user-1', {
        modelId: FOREIGN_MODEL,
        inputs: { wacc: 0.1 },
        outputs: { ev: 1000 },
      })
    ).rejects.toThrow(/not found/i);
    modelOwnershipReadIsOrgScoped();
    noInsertHappened();
  });

  it('createAIAssumption rejects a foreign-org modelId and writes nothing', async () => {
    await expect(
      financeEnterpriseService.createAIAssumption(ORG, {
        modelId: FOREIGN_MODEL,
        assumptionKey: 'growth',
        assumptionValue: '0.2',
      })
    ).rejects.toThrow(/not found/i);
    modelOwnershipReadIsOrgScoped();
    noInsertHappened();
  });

  it('createROILink rejects a foreign-org modelId and writes nothing', async () => {
    await expect(
      financeEnterpriseService.createROILink(ORG, { modelId: FOREIGN_MODEL })
    ).rejects.toThrow(/not found/i);
    modelOwnershipReadIsOrgScoped();
    noInsertHappened();
  });

  it('createConsolidation rejects a foreign-org id in sourceModelIds and writes nothing', async () => {
    // First id is owned, second belongs to the victim → the loop must reject
    // before the INSERT, so no consolidation row is grafted onto org B's models.
    queryOne.mockResolvedValueOnce({ id: 'model-owned-by-attacker' }).mockResolvedValueOnce(null);

    await expect(
      financeEnterpriseService.createConsolidation(ORG, 'user-1', {
        name: 'Group rollup',
        sourceModelIds: ['model-owned-by-attacker', FOREIGN_MODEL],
      })
    ).rejects.toThrow(/not found/i);

    // The ownership read for the foreign id is org-scoped.
    const call = queryOne.mock.calls.find(
      (c) =>
        String(c[0]).includes('FROM financial_models') && (c[1] as unknown[])?.[0] === FOREIGN_MODEL
    );
    expect(call).toBeDefined();
    const [sql, params] = call as [string, unknown[]];
    expect(sql).toMatch(/organization_id\s*=\s*\?/i);
    expect(params).toEqual([FOREIGN_MODEL, ORG]);
    noInsertHappened();
  });

  it('createModelVersion rejects a foreign-org modelId and writes nothing', async () => {
    await expect(
      financeEnterpriseService.createModelVersion(ORG, 'user-1', { modelId: FOREIGN_MODEL })
    ).rejects.toThrow(/not found/i);
    modelOwnershipReadIsOrgScoped();
    noInsertHappened();
  });
});

// ════════════════════════════════════════════════════════════
// updateBudgetActuals variance math (residual #10).
// Hand-derived from the formula: delta = a - p; pct = (a - p)/|p|*100,
// guarded to 0 when p === 0. NEVER snapshot the service output.
// ════════════════════════════════════════════════════════════

describe('financeEnterpriseService.updateBudgetActuals — variance math', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryRun.mockResolvedValue({ changes: 1 });
  });

  it('computes delta and pct hand-derived, with a p===0 guard', async () => {
    // planned: positive, negative, and zero baselines.
    queryOne.mockResolvedValueOnce({
      planned_data: JSON.stringify({ rev: 200, cost: -50, newline: 0 }),
    });

    const ok = await financeEnterpriseService.updateBudgetActuals(ORG, 'budget-1', {
      rev: 260, // p=200, a=260 → delta=60,  pct = 60/200*100  = 30
      cost: -80, // p=-50, a=-80 → delta=-30, pct = -30/50*100  = -60
      newline: 999, // p=0    → guard → pct = 0, delta = 999
    });
    expect(ok).toBe(true);

    const update = queryRun.mock.calls.find((c) =>
      String(c[0]).includes('UPDATE financial_budget_versions')
    );
    expect(update).toBeDefined();
    const [, params] = update as [string, unknown[]];
    // params: [actual_data, variance_data, updated_at, id, org]
    const variance = JSON.parse(params[1] as string);

    expect(variance.rev).toEqual({ planned: 200, actual: 260, delta: 60, pct: 30 });
    expect(variance.cost).toEqual({ planned: -50, actual: -80, delta: -30, pct: -60 });
    expect(variance.newline).toEqual({ planned: 0, actual: 999, delta: 999, pct: 0 });
  });

  it('returns false (no write) when the budget is foreign-org / missing', async () => {
    queryOne.mockResolvedValueOnce(null);

    const ok = await financeEnterpriseService.updateBudgetActuals(ORG, 'budget-x', { rev: 1 });
    expect(ok).toBe(false);

    const update = queryRun.mock.calls.find((c) =>
      String(c[0]).includes('UPDATE financial_budget_versions')
    );
    expect(update).toBeUndefined();
  });
});
