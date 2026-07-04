/**
 * ANTI-FALSE-GREEN regression for the M15/M16 Rezultaty↔Finanse SPLIT-BRAIN.
 *
 * Root cause: `getReconciliationOverview` joined the reconciliation row's
 * `kpi_id` (a LEGACY `initiative_kpis.id`, written by POST /reconciliations →
 * initiateReconciliation) against the ORPHAN `v8_kpi_definitions` read model.
 * That table is populated only by the synthetic, self-cleaning healthProbe — no
 * live flow, seed, or customer org writes it. So for every REAL reconciliation
 * the KPI name / unit / target hydrated as NULL and the dashboard read zeros,
 * even though the initiative closure was live and correct.
 *
 * Fidelity: unlike the sibling reconciliationOverview.test.ts (which feeds
 * pre-joined canned rows), this test drives the REAL reader against a fake DB
 * that models the JOIN semantics — the KPI store lives ONLY in `initiative_kpis`
 * (never in v8_kpi_definitions). The fake inspects the reader's actual SQL to
 * decide which table it joined and hydrates KPI metadata ONLY from the joined
 * table. Result:
 *   - OLD reader (JOIN v8_kpi_definitions)  → no matching KPI → NULL/zero surface.
 *   - NEW reader (JOIN initiative_kpis)     → KPI hydrated  → NON-ZERO variance.
 * The test therefore fails on the pre-fix code and passes on the fixed code
 * WITHOUT requiring a real Postgres FK (this repo's CI test lanes run mocked DB).
 *
 * Mirrors resultsROIService.test.ts (mocked DbPromise, no real DB).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── In-memory stores modelling the two KPI families ───────────────────────────
// The demo/closure family: the KPI EXISTS here (canonical).
interface LegacyKpiRow {
  id: string;
  organization_id: string;
  initiative_id: string | null;
  name: string;
  unit: string | null;
  target_value: number | null;
}
const initiativeKpis: LegacyKpiRow[] = [];
// The orphan v8 read-model: DELIBERATELY empty (nothing live writes it).
const v8KpiDefinitions: LegacyKpiRow[] = [];
// Reconciliation rows (written by initiateReconciliation, key on a legacy id).
interface ReconRow {
  reconciliation_id: string;
  organization_id: string;
  kpi_id: string;
  finance_ref: string;
  reconciliation_status: string;
  initiated_by: string;
  created_at: string;
  updated_at: string;
}
const reconRows: ReconRow[] = [];
// Realized ROI entries keyed on the SAME kpi_id the reconciliation carries.
interface RealizedRow {
  organization_id: string;
  kpi_id: string;
  realized_value: number;
}
const realizedRows: RealizedRow[] = [];

function paramList(params?: unknown[]): unknown[] {
  return Array.isArray(params) ? params : [];
}

// Last SQL the reconciliation reader emitted (for the SQL-shape assertion).
let lastReconSql = '';

// Fake `dbAll`: services only ever route getReconciliationOverview's SELECT here.
// We reproduce the JOIN by reading which table the reader chose from its SQL.
async function fakeAll(sql: string, params?: unknown[]): Promise<unknown[]> {
  const q = String(sql);
  const p = paramList(params);

  // The reconciliation overview SELECT (FROM v8_kpi_finance_reconciliations r).
  if (q.includes('FROM v8_kpi_finance_reconciliations r')) {
    lastReconSql = q;
    const org = p[0] as string;

    // Which KPI family did the reader join? This is the split-brain seam.
    const joinsLegacy = /JOIN\s+initiative_kpis\s+k\b/i.test(q);
    const joinsOrphan = /JOIN\s+v8_kpi_definitions\s+k\b/i.test(q);
    const kpiStore = joinsLegacy ? initiativeKpis : joinsOrphan ? v8KpiDefinitions : [];

    return reconRows
      .filter((r) => r.organization_id === org)
      .map((r) => {
        const kpi = kpiStore.find((k) => k.id === r.kpi_id) ?? null;
        const realized = realizedRows
          .filter((e) => e.organization_id === r.organization_id && e.kpi_id === r.kpi_id)
          .reduce((sum, e) => sum + e.realized_value, 0);
        const hasRealized = realizedRows.some(
          (e) => e.organization_id === r.organization_id && e.kpi_id === r.kpi_id
        );
        return {
          reconciliation_id: r.reconciliation_id,
          kpi_id: r.kpi_id,
          finance_ref: r.finance_ref,
          reconciliation_status: r.reconciliation_status,
          initiated_by: r.initiated_by,
          created_at: r.created_at,
          updated_at: r.updated_at,
          // Hydrated ONLY from the joined family — NULL when the KPI isn't there.
          kpi_name: kpi?.name ?? null,
          initiative_id: kpi?.initiative_id ?? null,
          unit: kpi?.unit ?? null,
          projected_value: kpi?.target_value ?? null,
          realized_value: hasRealized ? realized : null,
        };
      });
  }
  return [];
}

vi.mock('../../../utils/DbPromise.js', () => ({
  run: vi.fn().mockResolvedValue({ success: true }),
  get: vi.fn().mockResolvedValue(null),
  all: (...args: unknown[]) => fakeAll(args[0] as string, args[1] as unknown[]),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Engine columns off (recon table not in the mock fallback map) → legacy monetary
// branch, exactly the display path the demo uses. Keep getTableColumns → empty.
vi.mock('../../../utils/dbSchema.js', () => ({
  getTableColumns: vi.fn().mockResolvedValue(new Set<string>()),
  hasColumn: vi.fn().mockResolvedValue(false),
  clearSchemaCache: vi.fn(),
}));

import { getReconciliationOverview } from '../resultsROIService.js';

const ORG = 'aaa00000-0000-4000-8000-000000000001';
const LEGACY_KPI_ID = 'ik-demo-lead-time-cost'; // an initiative_kpis.id, NOT a v8 kpi_id

describe('M15/M16 split-brain: reconciliation reader hydrates from LEGACY initiative_kpis', () => {
  beforeEach(() => {
    initiativeKpis.length = 0;
    v8KpiDefinitions.length = 0;
    reconRows.length = 0;
    realizedRows.length = 0;

    // A demo-shape KPI that exists ONLY in the legacy family (the real world:
    // closure handoff + demo seed write initiative_kpis; v8_kpi_definitions stays
    // empty for every non-probe org).
    initiativeKpis.push({
      id: LEGACY_KPI_ID,
      organization_id: ORG,
      initiative_id: 'init-atelier-1',
      name: 'Roczna oszczędność kosztów',
      unit: '€',
      target_value: 100000,
    });
    // Finance opened a reconciliation on that KPI (POST /reconciliations).
    reconRows.push({
      reconciliation_id: 'rec-splitbrain-1',
      organization_id: ORG,
      kpi_id: LEGACY_KPI_ID,
      finance_ref: 'finance:GL-100',
      reconciliation_status: 'disputed',
      initiated_by: 'finance',
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-02T00:00:00.000Z',
    });
    // A realized delta booked against the same KPI id.
    realizedRows.push({ organization_id: ORG, kpi_id: LEGACY_KPI_ID, realized_value: 80000 });
  });

  it('returns a NON-ZERO, fully-hydrated reconciliation for a demo (legacy) KPI', async () => {
    const overview = await getReconciliationOverview(ORG);

    expect(overview.items).toHaveLength(1);
    const rec = overview.items[0];

    // Split-brain symptom would leave these NULL/zero. After the fix they hydrate.
    expect(rec.kpiName).toBe('Roczna oszczędność kosztów');
    expect(rec.unit).toBe('€');
    expect(rec.initiativeId).toBe('init-atelier-1');
    expect(rec.projectedValue).toBe(100000);
    expect(rec.realizedValue).toBe(80000);

    // Real money variance computed → the dashboard lights up (non-zero).
    expect(rec.varianceAbsolute).toBe(-20000);
    expect(rec.variancePercent).toBe(-20);
    expect(rec.hasMismatch).toBe(true);
    expect(overview.summary.mismatchCount).toBe(1);
    expect(overview.summary.total).toBe(1);
  });

  it('joins LEGACY initiative_kpis on its TEXT id and NOT the orphan v8_kpi_definitions', async () => {
    lastReconSql = '';
    await getReconciliationOverview(ORG);
    // GREEN-after: joins the canonical legacy family on its TEXT id PK.
    expect(lastReconSql).toMatch(/JOIN\s+initiative_kpis\s+k\s+ON\s+k\.id\s*=\s*r\.kpi_id/i);
    // RED-before: must NOT reference the orphan v8 definitions read model.
    expect(lastReconSql).not.toMatch(/v8_kpi_definitions/i);
  });
});
