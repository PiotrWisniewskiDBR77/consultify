/**
 * Contract test: M14 (Execution) → M15 (Results) feed-forward.
 *
 * Proves the full vertical slice connects:
 *   POST /api/v8/execution-control/realizations  (M14 write)
 *      → INSERT INTO roi_realized_values (source='execution')
 *      → getROIPortfolioSummary (M15 reader) returns the realized value.
 *
 * Plus org-scope (foreign-org initiative → 404) and the execution write role gate
 * (VIEWER → 403, no write). The route's real handler + the real
 * executionRealizationService run; only DbPromise is replaced with a tiny
 * in-memory `roi_realized_values` store shared by writer and reader so the read
 * back is an end-to-end assertion, not a mock echo.
 */
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── In-memory store shared by writer (route→service) and reader (M15) ──────────
interface RealizedRow {
  id: string;
  initiative_id: string;
  organization_id: string;
  period_month: string;
  realized_revenue_delta: number | null;
  realized_cost_delta: number | null;
  realized_savings: number | null;
  source: string;
  variance_notes: string | null;
  recorded_by: string;
}

const realizedRows: RealizedRow[] = [];
// Initiatives that the org-scope guard (SELECT id FROM initiatives ...) resolves.
const initiatives: Array<{
  id: string;
  organization_id: string;
  name: string;
  status: string;
  priority: string;
}> = [];
// roi_assumptions rows so getROIPortfolioSummary has a portfolio item to attach realized to.
const assumptions: Array<Record<string, unknown>> = [];

function paramList(params?: unknown[]): unknown[] {
  return Array.isArray(params) ? params : [];
}

// Minimal SQL router: matches on the table/keywords the route + service + reader use.
async function fakeRun(sql: string, params?: unknown[]): Promise<{ changes: number }> {
  const p = paramList(params);
  if (sql.includes('INSERT INTO roi_realized_values')) {
    const [
      id,
      initiative_id,
      organization_id,
      period_month,
      realized_revenue_delta,
      realized_cost_delta,
      realized_savings,
      source,
      variance_notes,
      recorded_by,
    ] = p as [
      string,
      string,
      string,
      string,
      number | null,
      number | null,
      number | null,
      string,
      string | null,
      string,
    ];
    realizedRows.push({
      id,
      initiative_id,
      organization_id,
      period_month,
      realized_revenue_delta,
      realized_cost_delta,
      realized_savings,
      source,
      variance_notes,
      recorded_by,
    });
    return { changes: 1 };
  }
  // execution_audit_log + anything else → no-op
  return { changes: 0 };
}

async function fakeGet<T = unknown>(sql: string, params?: unknown[]): Promise<T | null> {
  const p = paramList(params);
  if (
    sql.includes('FROM initiatives') &&
    sql.includes('id = ?') &&
    sql.includes('organization_id = ?')
  ) {
    const [id, orgId] = p as [string, string];
    const found = initiatives.find((i) => i.id === id && i.organization_id === orgId);
    return found ? ({ id: found.id } as unknown as T) : null;
  }
  return null;
}

async function fakeAll<T = unknown>(sql: string, params?: unknown[]): Promise<T[]> {
  const p = paramList(params);
  // getROIPortfolioSummary: assumptions JOIN initiatives
  if (sql.includes('FROM roi_assumptions ra') && sql.includes('JOIN initiatives i')) {
    const [orgId] = p as [string];
    return assumptions
      .filter((a) => a.organization_id === orgId)
      .map((a) => {
        const init = initiatives.find((i) => i.id === a.initiative_id);
        return {
          initiative_id: a.initiative_id,
          initiative_name: init?.name ?? a.initiative_id,
          status: init?.status ?? 'EXECUTING',
          priority: init?.priority ?? 'HIGH',
          capex: a.capex ?? 0,
          opex_annual: a.opex_annual ?? 0,
          expected_revenue_delta: a.expected_revenue_delta ?? 0,
          expected_cost_delta: a.expected_cost_delta ?? 0,
          confidence: a.confidence ?? 'medium',
        } as unknown as T;
      });
  }
  // getROIPortfolioSummary: realized aggregate from roi_realized_values
  if (sql.includes('FROM roi_realized_values') && sql.includes('GROUP BY initiative_id')) {
    const [orgId] = p as [string];
    const byInit = new Map<
      string,
      { total_rev: number; total_cost: number; total_savings: number }
    >();
    for (const r of realizedRows.filter((r) => r.organization_id === orgId)) {
      const acc = byInit.get(r.initiative_id) || { total_rev: 0, total_cost: 0, total_savings: 0 };
      acc.total_rev += r.realized_revenue_delta ?? 0;
      acc.total_cost += r.realized_cost_delta ?? 0;
      acc.total_savings += r.realized_savings ?? 0;
      byInit.set(r.initiative_id, acc);
    }
    return Array.from(byInit.entries()).map(
      ([initiative_id, v]) =>
        ({
          initiative_id,
          total_rev: v.total_rev,
          total_cost: v.total_cost,
          total_savings: v.total_savings,
        }) as unknown as T
    );
  }
  return [];
}

vi.mock('../../../utils/DbPromise.js', () => ({
  run: (...args: unknown[]) => fakeRun(args[0] as string, args[1] as unknown[]),
  get: (...args: unknown[]) => fakeGet(args[0] as string, args[1] as unknown[]),
  all: (...args: unknown[]) => fakeAll(args[0] as string, args[1] as unknown[]),
}));

vi.mock('../../../utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../middleware/validation.middleware.js', () => ({
  validateBody:
    (schema: { parse: (b: unknown) => unknown }) =>
    (req: Request, res: Response, next: NextFunction) => {
      try {
        req.body = schema.parse(req.body);
        next();
      } catch (err: any) {
        res.status(400).json({ error: 'Validation failed', details: err?.errors ?? String(err) });
      }
    },
}));

// requirePermission gate for /manager surface — pass through (not under test here).
vi.mock('../../../middleware/permission.middleware.js', () => ({
  requirePermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAnyPermission: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAllPermissions: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import { getROIPortfolioSummary } from '../../../services/v8/resultsROIService.js';
import executionControlRoutes from '../execution-control.routes.js';

const ORG = '00000000-0000-4000-8000-000000000088';
const OTHER_ORG = '00000000-0000-4000-8000-000000000099';
const UID = 'user-realization-contract';

let currentUser: { id: string; role: string; organizationId: string } | null = null;

function createApp(): Express {
  const app = express();
  app.use(express.json());
  // Inject v8 context + user that the route's getV8Context / checkInterventionPermission read.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    if (currentUser) {
      (req as any).v8Context = {
        organizationId: currentUser.organizationId,
        userId: currentUser.id,
        userRole: currentUser.role,
        isSuperAdmin: false,
      };
      (req as any).user = { id: currentUser.id, role: currentUser.role };
      (req as any).userRole = currentUser.role;
      (req as any).userId = currentUser.id;
      (req as any).organizationId = currentUser.organizationId;
    }
    next();
  });
  app.use('/api/v8/execution-control', executionControlRoutes);
  return app;
}

describe('M14 → M15 realization feed-forward (contract)', () => {
  beforeEach(() => {
    realizedRows.length = 0;
    initiatives.length = 0;
    assumptions.length = 0;
    currentUser = { id: UID, role: 'ADMIN', organizationId: ORG };
  });

  it('records a realization (source=execution) that M15 getROIPortfolioSummary reads back', async () => {
    initiatives.push({
      id: 'init-1',
      organization_id: ORG,
      name: 'Init One',
      status: 'EXECUTING',
      priority: 'HIGH',
    });
    // A portfolio item must exist for the realized value to attach in the rollup.
    assumptions.push({
      initiative_id: 'init-1',
      organization_id: ORG,
      capex: 1000,
      opex_annual: 0,
      expected_revenue_delta: 5000,
      expected_cost_delta: 0,
      confidence: 'high',
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/execution-control/realizations').send({
      initiativeId: 'init-1',
      periodMonth: '2026-06-01',
      realizedSavings: 4200,
      varianceNotes: 'Q2 verified savings',
    });

    expect(res.status).toBe(200);
    expect(res.body.data?.success).toBe(true);
    expect(res.body.data?.entry?.source).toBe('execution');
    expect(res.body.data?.entry?.recordedBy).toBe(UID);

    // Persisted with execution provenance.
    expect(realizedRows).toHaveLength(1);
    expect(realizedRows[0].source).toBe('execution');
    expect(realizedRows[0].realized_savings).toBe(4200);
    expect(realizedRows[0].organization_id).toBe(ORG);

    // M15 reader returns the realized value end-to-end.
    const summary = await getROIPortfolioSummary(ORG);
    const item = summary.items.find((i) => i.initiativeId === 'init-1');
    expect(item).toBeTruthy();
    expect(item?.hasRealized).toBe(true);
    expect(item?.realizedBenefit).toBe(4200);
    expect(summary.summary.totalRealized).toBe(4200);
  });

  it('returns 404 when the initiative belongs to another org (no write)', async () => {
    // Initiative exists only in OTHER_ORG; caller is in ORG.
    initiatives.push({
      id: 'init-foreign',
      organization_id: OTHER_ORG,
      name: 'Foreign',
      status: 'EXECUTING',
      priority: 'HIGH',
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/execution-control/realizations').send({
      initiativeId: 'init-foreign',
      periodMonth: '2026-06-01',
      realizedSavings: 999,
    });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe('INITIATIVE_NOT_FOUND');
    expect(realizedRows).toHaveLength(0);
  });

  it('returns 403 for a VIEWER role (write gate, no write)', async () => {
    currentUser = { id: UID, role: 'VIEWER', organizationId: ORG };
    initiatives.push({
      id: 'init-1',
      organization_id: ORG,
      name: 'Init One',
      status: 'EXECUTING',
      priority: 'HIGH',
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/execution-control/realizations').send({
      initiativeId: 'init-1',
      periodMonth: '2026-06-01',
      realizedSavings: 100,
    });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('EXECUTION_WRITE_DENIED');
    expect(realizedRows).toHaveLength(0);
  });

  it('rejects an empty realization (no realized value supplied) with 400', async () => {
    initiatives.push({
      id: 'init-1',
      organization_id: ORG,
      name: 'Init One',
      status: 'EXECUTING',
      priority: 'HIGH',
    });

    const app = createApp();
    const res = await request(app).post('/api/v8/execution-control/realizations').send({
      initiativeId: 'init-1',
      periodMonth: '2026-06-01',
    });

    expect(res.status).toBe(400);
    expect(realizedRows).toHaveLength(0);
  });
});
