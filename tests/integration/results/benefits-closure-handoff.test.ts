/**
 * Integration test — M14 → M15 closure handoff (Decision B1b)
 *
 * Covers the real path `handoffFromClosure` (server/src/services/executionResultsBridge.ts)
 * that runs when an initiative closes (status → DONE). On close, the initiative's
 * planned KPIs (`initiative_kpis`) are materialized into the M15-readable benefits
 * register (`initiative_benefits`) tagged `source_tag = 'M14_CLOSURE_HANDOFF'`.
 *
 * The DB layer (`utils/DbPromise.js`) is mocked with a tiny in-memory store that
 * honours the exact SQL the service issues (planned-KPI SELECT, dedup SELECT,
 * benefit INSERT). This exercises the service's real query/dedup/insert logic
 * end-to-end without a DB engine, deterministically in CI.
 *
 * Scenarios:
 *   (1) 2 KPIs → DONE → 2 benefits with source M14_CLOSURE_HANDOFF
 *   (2) no KPIs → DONE → zero benefits, no error
 *   (3) idempotency — a second DONE does not duplicate benefits
 *   (4) benefits-service failure (DB throws) → surfaced to caller, but the
 *       controller wrapper (verified separately) does not block the status change
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---- In-memory store shared with the DbPromise mock --------------------------
interface KpiRow {
  id: string;
  initiative_id: string;
  name: string;
  unit: string | null;
  target_value: number | null;
  description: string | null;
}
interface BenefitRow {
  id: string;
  initiative_id: string;
  organization_id: string;
  name: string;
  description: string | null;
  benefit_type: string;
  kpi_id: string | null;
  target_value: number | null;
  status: string;
  source_tag: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const store = {
  kpis: [] as KpiRow[],
  benefits: [] as BenefitRow[],
  failInsert: false,
};

function resetStore(): void {
  store.kpis = [];
  store.benefits = [];
  store.failInsert = false;
}

// Minimal SQL interpreter for the three statements the service issues.
function normalize(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim().toLowerCase();
}

const dbAllMock = vi.fn(async (sql: string, params: unknown[] = []) => {
  const s = normalize(sql);
  // Planned KPIs: SELECT ... FROM initiative_kpis WHERE initiative_id = ? AND target_value IS NOT NULL
  if (s.includes('from initiative_kpis')) {
    const [initiativeId] = params as [string];
    return store.kpis.filter(
      (k) => k.initiative_id === initiativeId && k.target_value !== null && k.target_value !== undefined
    );
  }
  return [];
});

const dbGetMock = vi.fn(async (sql: string, params: unknown[] = []) => {
  const s = normalize(sql);
  // Dedup lookup: SELECT id FROM initiative_benefits WHERE initiative_id=? AND kpi_id=? AND source_tag=?
  if (s.includes('from initiative_benefits')) {
    const [initiativeId, kpiId, sourceTag] = params as [string, string, string];
    return (
      store.benefits.find(
        (b) => b.initiative_id === initiativeId && b.kpi_id === kpiId && b.source_tag === sourceTag
      ) ?? null
    );
  }
  return null;
});

const dbRunMock = vi.fn(async (sql: string, params: unknown[] = []) => {
  const s = normalize(sql);
  if (s.includes('insert into initiative_benefits')) {
    if (store.failInsert) {
      throw new Error('simulated benefits-service DB failure');
    }
    const [
      id,
      initiative_id,
      organization_id,
      name,
      description,
      kpi_id,
      target_value,
      source_tag,
      created_by,
      created_at,
      updated_at,
    ] = params as string[];
    store.benefits.push({
      id,
      initiative_id,
      organization_id,
      name,
      description: description ?? null,
      benefit_type: 'quantitative',
      kpi_id: kpi_id ?? null,
      target_value: target_value != null ? Number(target_value) : null,
      status: 'tracking',
      source_tag: source_tag ?? null,
      created_by: created_by ?? null,
      created_at: created_at ?? new Date().toISOString(),
      updated_at: updated_at ?? new Date().toISOString(),
    });
    return { success: true, changes: 1 };
  }
  return { success: true, changes: 0 };
});

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: (...args: unknown[]) => dbAllMock(...(args as [string, unknown[]])),
  get: (...args: unknown[]) => dbGetMock(...(args as [string, unknown[]])),
  run: (...args: unknown[]) => dbRunMock(...(args as [string, unknown[]])),
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Not exercised by handoffFromClosure but imported by the bridge module.
vi.mock('../../../server/src/services/executionBudgetService.js', () => ({
  getInitiativeBudgetSummary: vi.fn(),
}));
vi.mock('../../../server/src/services/v8/resultsROIService.js', () => ({
  createKpiSignal: vi.fn(),
}));

const ORG = 'org-closure-1';
const INIT = 'init-closure-1';
const ACTOR = 'user-actor-1';

describe('M14→M15 closure handoff — handoffFromClosure', () => {
  let handoffFromClosure: typeof import('../../../server/src/services/executionResultsBridge.js').handoffFromClosure;
  let CLOSURE_HANDOFF_SOURCE: string;

  beforeEach(async () => {
    resetStore();
    vi.clearAllMocks();
    const mod = await import('../../../server/src/services/executionResultsBridge.js');
    handoffFromClosure = mod.handoffFromClosure;
    CLOSURE_HANDOFF_SOURCE = mod.CLOSURE_HANDOFF_SOURCE;
  });

  it('(1) initiative with 2 planned KPIs → creates 2 benefits tagged M14_CLOSURE_HANDOFF', async () => {
    store.kpis.push(
      { id: 'kpi-a', initiative_id: INIT, name: 'Cycle time', unit: 'days', target_value: 5, description: 'faster' },
      { id: 'kpi-b', initiative_id: INIT, name: 'Cost', unit: 'PLN', target_value: 1000, description: null }
    );

    const result = await handoffFromClosure(ORG, INIT, ACTOR);

    expect(result.created).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.considered).toBe(2);

    const rows = store.benefits;
    expect(rows).toHaveLength(2);
    expect(rows.every((b) => b.source_tag === 'M14_CLOSURE_HANDOFF')).toBe(true);
    expect(CLOSURE_HANDOFF_SOURCE).toBe('M14_CLOSURE_HANDOFF');
    expect(rows.every((b) => b.organization_id === ORG)).toBe(true);
    expect(rows.every((b) => b.initiative_id === INIT)).toBe(true);
    expect(rows.every((b) => b.status === 'tracking')).toBe(true);
    expect(rows.map((b) => b.name).sort()).toEqual(['Cost', 'Cycle time']);
    expect(rows.find((b) => b.kpi_id === 'kpi-a')?.target_value).toBe(5);
    expect(rows.every((b) => b.created_by === ACTOR)).toBe(true);
  });

  it('(2) initiative with NO KPIs → DONE passes, zero benefits, no error', async () => {
    const result = await handoffFromClosure(ORG, INIT, ACTOR);
    expect(result.created).toBe(0);
    expect(result.considered).toBe(0);
    expect(store.benefits).toHaveLength(0);
    expect(dbRunMock).not.toHaveBeenCalled();
  });

  it('(2b) KPIs without target_value are ignored (no measurable benefit)', async () => {
    store.kpis.push({
      id: 'kpi-null',
      initiative_id: INIT,
      name: 'Vague',
      unit: null,
      target_value: null,
      description: null,
    });
    const result = await handoffFromClosure(ORG, INIT, ACTOR);
    expect(result.considered).toBe(0);
    expect(result.created).toBe(0);
    expect(store.benefits).toHaveLength(0);
  });

  it('(3) idempotency — a second DONE does not duplicate benefits (DONE→revert→DONE)', async () => {
    store.kpis.push({
      id: 'kpi-a',
      initiative_id: INIT,
      name: 'Cycle time',
      unit: 'days',
      target_value: 5,
      description: null,
    });

    const first = await handoffFromClosure(ORG, INIT, ACTOR);
    expect(first.created).toBe(1);
    expect(store.benefits).toHaveLength(1);

    // Second close (e.g. DONE reverted then re-closed) — same KPI already handed off.
    const second = await handoffFromClosure(ORG, INIT, ACTOR);
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(1);
    expect(store.benefits).toHaveLength(1); // no duplicate
  });

  it('(4) benefits-service failure (DB insert throws) → error surfaces to caller', async () => {
    store.kpis.push({
      id: 'kpi-a',
      initiative_id: INIT,
      name: 'Cycle time',
      unit: 'days',
      target_value: 5,
      description: null,
    });
    store.failInsert = true;

    await expect(handoffFromClosure(ORG, INIT, ACTOR)).rejects.toThrow(/simulated benefits-service DB failure/);
    // The controller wraps this call in try/catch so the status change is not blocked
    // (covered by benefits-closure-controller-wiring.test.ts). Here we assert the
    // service itself does surface the failure rather than swallowing it.
    expect(store.benefits).toHaveLength(0);
  });
});
