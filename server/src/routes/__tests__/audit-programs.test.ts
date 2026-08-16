/**
 * M12 — Audit Programs route tests (Bramka D: testy fundamentu M12).
 *
 * Covers:
 *   - AUD-MVP-OWNER-001: the ENTIRE legacy write surface — CRUD
 *     (POST/PATCH/DELETE) AND generate-surveys's bookkeeping UPDATE — is
 *     retired. All of it refuses with 410 AUDIT_PROGRAM_LEGACY_WRITE_DISABLED
 *     and never touches dbGet/dbRun/the assignment-create seam, by default
 *     (isLegacyProgramWriteEnabled()=false); flipping the
 *     AUDIT_PROGRAM_LEGACY_WRITES_ENABLED env var restores the old behavior
 *     (proven per-endpoint below — this is the rollback story).
 *   - Read org-scoping: GET/GET-list keep working (unaffected by the retirement)
 *   - generate-surveys fan-out (flag ON only, see the dedicated describe
 *     block): creates one assignment per template × assignee
 *   - SEC-3: generate-surveys filters foreign assignees via organization_members check
 *   - generate-surveys idempotency: alreadyGenerated=true skips re-fan-out
 *   - completion rollup endpoint (read-only, unaffected)
 *
 * Call graph notes:
 *   getProgram()     → dbGet (single row lookup)
 *   listPrograms()   → dbGet (count) + dbAll (rows)
 *   createProgram()  → dbRun (INSERT) + dbGet (return)  — NOT reached from the
 *                      route while the legacy-write flag is OFF (default)
 *   updateProgram()  → dbGet (existing) + dbRun (UPDATE) + dbGet (return) — NOT
 *                      reached from PATCH, nor from generate-surveys's
 *                      bookkeeping call, while the legacy-write flag is OFF
 *   deleteProgram()  → dbGet (exist-check) + dbRun (DELETE) — NOT reached from
 *                      the route while the legacy-write flag is OFF (default)
 *   generateSurveys()→ dbGet (get) + dbAll (org_members) + create() +
 *                      updateProgram() — the WHOLE function is unreached
 *                      while the legacy-write flag is OFF (route refuses
 *                      before calling it)
 */

import express, { type Express, type NextFunction, type Request } from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock fns (hoisted) ────────────────────────────────────────────────────────

const { mockDbAll, mockDbGet, mockDbRun } = vi.hoisted(() => ({
  mockDbAll: vi.fn(),
  mockDbGet: vi.fn(),
  mockDbRun: vi.fn(),
}));

const mockCreate = vi.fn();

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: any[]) => mockDbAll(...args),
  get: (...args: any[]) => mockDbGet(...args),
  run: (...args: any[]) => mockDbRun(...args),
}));

vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (_req: any, _res: any, next: any) => next(),
  isAuthenticated: (_req: any, _res: any, next: any) => next(),
  validateOrgMembership: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: any) => next(),
}));

vi.mock('../../utils/Logger.js', () => ({
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock('../../services/InterviewAssignmentService.js', () => ({
  default: { create: (...args: any[]) => mockCreate(...args) },
}));

// auditProgramService.js itself is NOT mocked — isLegacyProgramWriteEnabled()
// reads live process.env, so tests toggle it with vi.stubEnv and this
// file-wide afterEach guarantees the stub never leaks into another test.
afterEach(() => {
  vi.unstubAllEnvs();
});

// ── Test constants ────────────────────────────────────────────────────────────

const ORG_A = 'org-aaa-111';
const ORG_B = 'org-bbb-222';
const USER_A = 'user-a-1';
const PROG_ID = 'prog-x-1';
const TMPL_ID = 'tmpl-y-1';
const OWN_ASSIGNEE = 'user-own-1';
const FOREIGN_ASSIGNEE = 'user-foreign-2';

/** Raw DB row as returned by dbGet (config as JSON string). */
function baseRow(extra: Record<string, any> = {}) {
  return {
    id: PROG_ID,
    organization_id: ORG_A,
    name: 'ISO 27001 Audit',
    description: null,
    objective: null,
    status: 'draft',
    preset: null,
    config: JSON.stringify({ templateIds: [TMPL_ID], assigneeIds: [OWN_ASSIGNEE] }),
    created_by: USER_A,
    created_at: '2026-06-11T00:00:00.000Z',
    updated_at: '2026-06-11T00:00:00.000Z',
    ...extra,
  };
}

function updatedRow(extra: Record<string, any> = {}) {
  return baseRow({
    config: JSON.stringify({
      templateIds: [TMPL_ID],
      assigneeIds: [OWN_ASSIGNEE],
      surveysGenerated: true,
      generatedAssignmentIds: ['ia-1'],
    }),
    status: 'active',
    ...extra,
  });
}

// ── App factory ───────────────────────────────────────────────────────────────

async function makeApp(orgId = ORG_A) {
  const { default: router } = await import('../audit-programs.routes.js');
  const app: Express = express();
  app.use(express.json());
  app.use((req: Request, _res: any, next: NextFunction) => {
    (req as any).user = { id: USER_A, organizationId: orgId };
    (req as any).organizationId = orgId;
    (req as any).userId = USER_A;
    next();
  });
  app.use('/api/audit', router);
  return app;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('audit-programs CRUD org-scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue(undefined);
    mockDbRun.mockResolvedValue({ success: true, changes: 1 });
  });

  it('GET /programs returns empty list when no programs', async () => {
    mockDbGet.mockResolvedValueOnce({ total: 0 }); // count
    mockDbAll.mockResolvedValueOnce([]); // rows
    const app = await makeApp();
    const res = await request(app).get('/api/audit/programs');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('programs');
    expect(Array.isArray(res.body.programs)).toBe(true);
  });

  it('GET /programs?search&status applies server-side filter (L-02) while keeping org-scope', async () => {
    mockDbGet.mockResolvedValueOnce({ total: 1 }); // count
    mockDbAll.mockResolvedValueOnce([baseRow()]); // rows
    const app = await makeApp();
    const res = await request(app).get('/api/audit/programs?search=iso&status=active');
    expect(res.status).toBe(200);

    // Both the COUNT (dbGet) and the row SELECT (dbAll) must carry the search +
    // status predicates AND keep organization_id as the leading bound param.
    const countSql = String(mockDbGet.mock.calls[0][0]);
    const countParams = mockDbGet.mock.calls[0][1] as unknown[];
    expect(countSql).toContain('name LIKE ?');
    expect(countSql).toContain('status = ?');
    expect(countParams[0]).toBe(ORG_A); // org-scope stays first
    expect(countParams).toContain('%iso%');
    expect(countParams).toContain('active');

    const rowsSql = String(mockDbAll.mock.calls[0][0]);
    const rowsParams = mockDbAll.mock.calls[0][1] as unknown[];
    expect(rowsSql).toContain('name LIKE ?');
    expect(rowsSql).toContain('status = ?');
    expect(rowsParams[0]).toBe(ORG_A);
    expect(rowsParams).toContain('%iso%');
    expect(rowsParams).toContain('active');
  });

  it('GET /programs without filters keeps a bare org-scoped query (no search predicate)', async () => {
    mockDbGet.mockResolvedValueOnce({ total: 0 });
    mockDbAll.mockResolvedValueOnce([]);
    const app = await makeApp();
    const res = await request(app).get('/api/audit/programs');
    expect(res.status).toBe(200);
    const countSql = String(mockDbGet.mock.calls[0][0]);
    expect(countSql).not.toContain('LIKE');
    expect(countSql).not.toContain('status = ?');
  });

  // ── AUD-MVP-OWNER-001: legacy POST is retired by default ─────────────────────
  it('POST /programs — default (flag unset): 410 AUDIT_PROGRAM_LEGACY_WRITE_DISABLED, never touches dbRun', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/api/audit/programs')
      .send({ name: 'ISO 27001', status: 'draft' });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('AUDIT_PROGRAM_LEGACY_WRITE_DISABLED');
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('POST /programs — repeated attempts while disabled are refused every time (stale/replay negative)', async () => {
    const app = await makeApp();
    for (let i = 0; i < 3; i++) {
      // eslint-disable-next-line no-await-in-loop
      const res = await request(app)
        .post('/api/audit/programs')
        .send({ name: `ISO 27001 attempt ${i}`, status: 'draft' });
      expect(res.status).toBe(410);
      expect(res.body.code).toBe('AUDIT_PROGRAM_LEGACY_WRITE_DISABLED');
    }
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  // ── Rollback story: AUDIT_PROGRAM_LEGACY_WRITES_ENABLED=true restores the
  // pre-retirement behavior without a code revert. These are the ORIGINAL
  // pre-retirement assertions, now gated behind the explicit opt-in. ─────────
  it('POST /programs — flag ON (AUDIT_PROGRAM_LEGACY_WRITES_ENABLED=true): creates with org scope', async () => {
    vi.stubEnv('AUDIT_PROGRAM_LEGACY_WRITES_ENABLED', 'true');
    mockDbGet.mockResolvedValueOnce(baseRow()); // createProgram → getProgram returns created row
    const app = await makeApp();
    const res = await request(app)
      .post('/api/audit/programs')
      .send({ name: 'ISO 27001', status: 'draft' });
    expect(res.status).toBe(201);
    expect(res.body.program.id).toBe(PROG_ID);
    expect(mockDbRun).toHaveBeenCalled();
  });

  it('POST /programs — flag ON: still returns 400 when name is missing (validation preserved)', async () => {
    vi.stubEnv('AUDIT_PROGRAM_LEGACY_WRITES_ENABLED', 'true');
    const app = await makeApp();
    const res = await request(app).post('/api/audit/programs').send({ status: 'draft' });
    expect(res.status).toBe(400);
  });

  it('GET /programs/:id returns 404 for unknown program', async () => {
    mockDbGet.mockResolvedValueOnce(undefined); // getProgram → not found
    const app = await makeApp();
    const res = await request(app).get(`/api/audit/programs/${PROG_ID}`);
    expect(res.status).toBe(404);
  });

  it('GET /programs/:id returns program when it belongs to the requesting org', async () => {
    mockDbGet.mockResolvedValueOnce(baseRow());
    const app = await makeApp(ORG_A);
    const res = await request(app).get(`/api/audit/programs/${PROG_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.program.id).toBe(PROG_ID);
  });

  it('GET /programs/:id returns 404 when program belongs to a different org (cross-org scope)', async () => {
    // ORG_B requests — dbGet returns undefined because the real query uses WHERE organization_id = ORG_B
    mockDbGet.mockResolvedValueOnce(undefined);
    const app = await makeApp(ORG_B);
    const res = await request(app).get(`/api/audit/programs/${PROG_ID}`);
    expect(res.status).toBe(404);
  });

  // ── AUD-MVP-OWNER-001: legacy PATCH is retired by default ────────────────────
  it('PATCH /programs/:id — default (flag unset): 410 AUDIT_PROGRAM_LEGACY_WRITE_DISABLED, never touches dbRun/dbGet', async () => {
    const app = await makeApp(ORG_A);
    const res = await request(app)
      .patch(`/api/audit/programs/${PROG_ID}`)
      .send({ name: 'Changed' });
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('AUDIT_PROGRAM_LEGACY_WRITE_DISABLED');
    expect(mockDbRun).not.toHaveBeenCalled();
    // No lookup happens either — org-scoping is moot when the write path never runs.
    expect(mockDbGet).not.toHaveBeenCalled();
  });

  it('PATCH /programs/:id — default: refuses identically for a wrong-org id too (tenant negative on the write surface)', async () => {
    const app = await makeApp(ORG_B);
    const res = await request(app)
      .patch(`/api/audit/programs/${PROG_ID}`)
      .send({ name: 'Changed' });
    expect(res.status).toBe(410);
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  // ── Rollback story (flag ON): original pre-retirement assertions ────────────
  it('PATCH /programs/:id — flag ON: returns 404 for wrong-org program (org-scoping preserved)', async () => {
    // updateProgram calls getProgram first — returns null for ORG_B
    vi.stubEnv('AUDIT_PROGRAM_LEGACY_WRITES_ENABLED', 'true');
    mockDbGet.mockResolvedValueOnce(undefined);
    const app = await makeApp(ORG_B);
    const res = await request(app)
      .patch(`/api/audit/programs/${PROG_ID}`)
      .send({ name: 'Changed' });
    expect(res.status).toBe(404);
  });

  it('PATCH /programs/:id — flag ON: returns 400 when name is empty string (validation preserved)', async () => {
    vi.stubEnv('AUDIT_PROGRAM_LEGACY_WRITES_ENABLED', 'true');
    const app = await makeApp(ORG_A);
    const res = await request(app).patch(`/api/audit/programs/${PROG_ID}`).send({ name: '' });
    expect(res.status).toBe(400);
  });

  // ── AUD-MVP-OWNER-001: legacy DELETE is retired by default ───────────────────
  it('DELETE /programs/:id — default (flag unset): 410 AUDIT_PROGRAM_LEGACY_WRITE_DISABLED, never touches dbRun', async () => {
    const app = await makeApp(ORG_A);
    const res = await request(app).delete(`/api/audit/programs/${PROG_ID}`);
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('AUDIT_PROGRAM_LEGACY_WRITE_DISABLED');
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  it('DELETE /programs/:id — default: refuses identically for a wrong-org id too (tenant negative on the write surface)', async () => {
    const app = await makeApp(ORG_B);
    const res = await request(app).delete(`/api/audit/programs/${PROG_ID}`);
    expect(res.status).toBe(410);
    expect(mockDbRun).not.toHaveBeenCalled();
  });

  // ── Rollback story (flag ON): original pre-retirement assertions ────────────
  it('DELETE /programs/:id — flag ON: returns 404 for wrong-org program (org-scoping preserved)', async () => {
    vi.stubEnv('AUDIT_PROGRAM_LEGACY_WRITES_ENABLED', 'true');
    mockDbGet.mockResolvedValueOnce(undefined);
    const app = await makeApp(ORG_B);
    const res = await request(app).delete(`/api/audit/programs/${PROG_ID}`);
    expect(res.status).toBe(404);
  });

  it('DELETE /programs/:id — flag ON: returns 200 for own-org program (legacy delete restored)', async () => {
    vi.stubEnv('AUDIT_PROGRAM_LEGACY_WRITES_ENABLED', 'true');
    mockDbGet.mockResolvedValueOnce(baseRow()); // deleteProgram → getProgram exist-check
    const app = await makeApp(ORG_A);
    const res = await request(app).delete(`/api/audit/programs/${PROG_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockDbRun).toHaveBeenCalled();
  });

  // ── Mass-assignment: server-managed `config` bookkeeping keys (flag ON only —
  // PATCH is retired by default; this exercises the restored path) ────────────
  // surveysGenerated / generatedAssignmentIds / generation are written ONLY by
  // generateSurveys(). A client PATCH must not forge them (a forged
  // surveysGenerated=true would permanently block the program's survey fan-out;
  // a forged generatedAssignmentIds would inflate completion %). The route strips
  // them from the incoming config and re-seeds them from the existing row.
  it('PATCH /programs/:id — flag ON: ignores client-forged surveysGenerated/generatedAssignmentIds; server values win', async () => {
    vi.stubEnv('AUDIT_PROGRAM_LEGACY_WRITES_ENABLED', 'true');
    // Route flow when body.config is present:
    //   1: getProgram (route sanitization — read existing server-owned keys)
    //   2: updateProgram → getProgram (existence check)
    //   3: updateProgram → dbRun (UPDATE)
    //   4: updateProgram → getProgram (return)
    const existing = baseRow({
      // existing row has NOT generated surveys (server truth = false/empty)
      config: JSON.stringify({ templateIds: [TMPL_ID], assigneeIds: [OWN_ASSIGNEE] }),
    });
    mockDbGet
      .mockResolvedValueOnce(existing) // 1: route sanitization read
      .mockResolvedValueOnce(existing) // 2: updateProgram exist-check
      .mockResolvedValueOnce(existing); // 4: updateProgram return

    const app = await makeApp(ORG_A);
    const res = await request(app)
      .patch(`/api/audit/programs/${PROG_ID}`)
      .send({
        config: {
          templateIds: [TMPL_ID],
          assigneeIds: [OWN_ASSIGNEE],
          // forged server-managed keys — must be ignored
          surveysGenerated: true,
          generatedAssignmentIds: ['forged-1', 'forged-2'],
          generation: { requested: 99, created: 99, failed: 0, at: 'forged' },
        },
      });

    expect(res.status).toBe(200);
    // The UPDATE dbRun must have persisted config WITHOUT the forged values.
    const updateCall = mockDbRun.mock.calls.find((c) =>
      String(c[0]).includes('UPDATE audit_programs')
    );
    expect(updateCall).toBeDefined();
    const params = updateCall![1] as unknown[];
    const persistedConfigJson = params.find(
      (p) => typeof p === 'string' && p.includes('templateIds')
    ) as string;
    const persistedConfig = JSON.parse(persistedConfigJson);
    // client wizard state preserved
    expect(persistedConfig.templateIds).toEqual([TMPL_ID]);
    // forged server-owned keys stripped → fall back to existing (undefined/false)
    expect(persistedConfig.surveysGenerated).toBeUndefined();
    expect(persistedConfig.generatedAssignmentIds).toBeUndefined();
    expect(persistedConfig.generation).toBeUndefined();
  });
});

// ── AUD-MVP-OWNER-001 (lead decision 2026-08-16): generate-surveys's
// bookkeeping updateProgram() call is now retired by default too — leaving it
// reachable kept the legacy service as a second writer of audit_programs
// (inventory=2, not 1), and there is no legitimate way to reach it anymore
// once create/update/delete already refuse. Same flag, same 410 shape. ──────
describe('audit-programs generate-surveys — retired by default (AUD-MVP-OWNER-001)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue(undefined);
    mockDbRun.mockResolvedValue({ success: true, changes: 1 });
    mockCreate.mockResolvedValue({ id: 'ia-1' });
  });

  it('POST .../generate-surveys — default (flag unset): 410 AUDIT_PROGRAM_LEGACY_WRITE_DISABLED, never touches dbGet/dbRun/mockCreate', async () => {
    const app = await makeApp();
    const res = await request(app).post(`/api/audit/programs/${PROG_ID}/generate-surveys`);
    expect(res.status).toBe(410);
    expect(res.body.code).toBe('AUDIT_PROGRAM_LEGACY_WRITE_DISABLED');
    expect(mockDbGet).not.toHaveBeenCalled();
    expect(mockDbRun).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('POST .../generate-surveys — default: refused identically regardless of program state (nothing is ever read to decide)', async () => {
    // No mockDbGet.mockResolvedValueOnce() queued here on purpose: the whole
    // point is that dbGet is NEVER called, so nothing is ever consumed — the
    // refusal is unconditional, before the DB is touched at all. (An unused
    // queued once-value would otherwise leak into the next describe block's
    // mockDbGet queue, since vi.clearAllMocks() clears call history but not
    // queued mockResolvedValueOnce values — only vi.resetAllMocks() does.)
    const app = await makeApp();
    const res = await request(app).post(`/api/audit/programs/${PROG_ID}/generate-surveys`);
    expect(res.status).toBe(410);
    expect(mockDbGet).not.toHaveBeenCalled();
  });
});

describe('audit-programs generate-surveys fan-out — flag ON (AUDIT_PROGRAM_LEGACY_WRITES_ENABLED=true, rollback path)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('AUDIT_PROGRAM_LEGACY_WRITES_ENABLED', 'true');
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue(undefined);
    mockDbRun.mockResolvedValue({ success: true, changes: 1 });
    mockCreate.mockResolvedValue({ id: 'ia-1' });
  });

  it('returns 404 when program not found', async () => {
    mockDbGet.mockResolvedValueOnce(undefined);
    const app = await makeApp();
    const res = await request(app).post(`/api/audit/programs/${PROG_ID}/generate-surveys`);
    expect(res.status).toBe(404);
  });

  it('fans out one assignment per template × assignee', async () => {
    // generateSurveys: getProgram (1) → org_members (all) → create() → updateProgram: getProgram (2), dbRun, getProgram (3)
    mockDbGet
      .mockResolvedValueOnce(baseRow()) // 1: initial getProgram
      .mockResolvedValueOnce(baseRow()) // 2: updateProgram existence check
      .mockResolvedValueOnce(updatedRow()); // 3: post-update getProgram return
    mockDbAll
      .mockResolvedValueOnce([{ user_id: OWN_ASSIGNEE }]) // org_members check
      .mockResolvedValueOnce([{ id: TMPL_ID }]); // template org-validation (SEC-3 templates)

    const app = await makeApp(ORG_A);
    const res = await request(app).post(`/api/audit/programs/${PROG_ID}/generate-surveys`);
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ assigneeUserIds: [OWN_ASSIGNEE], templateId: TMPL_ID })
    );
    expect(res.body.created).toBe(1);
  });

  it('normalizes persisted membership status when validating assignees', async () => {
    mockDbGet
      .mockResolvedValueOnce(baseRow())
      .mockResolvedValueOnce(baseRow())
      .mockResolvedValueOnce(updatedRow());
    mockDbAll
      .mockResolvedValueOnce([{ user_id: OWN_ASSIGNEE }])
      .mockResolvedValueOnce([{ id: TMPL_ID }]);

    const app = await makeApp(ORG_A);
    const res = await request(app).post(`/api/audit/programs/${PROG_ID}/generate-surveys`);

    expect(res.status).toBe(200);
    expect(mockDbAll).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("LOWER(status) = 'active'"),
      [ORG_A, OWN_ASSIGNEE],
      { fallback: true }
    );
  });

  it('SEC-3: filters foreign assignees — does not create assignment for non-members', async () => {
    const rowWithForeign = baseRow({
      config: JSON.stringify({
        templateIds: [TMPL_ID],
        assigneeIds: [FOREIGN_ASSIGNEE, OWN_ASSIGNEE],
      }),
    });

    mockDbGet
      .mockResolvedValueOnce(rowWithForeign) // 1: getProgram
      .mockResolvedValueOnce(rowWithForeign) // 2: updateProgram exist-check
      .mockResolvedValueOnce(updatedRow()); // 3: post-update return
    // org_members: only OWN_ASSIGNEE is a member (foreign filtered)
    mockDbAll
      .mockResolvedValueOnce([{ user_id: OWN_ASSIGNEE }]) // org_members
      .mockResolvedValueOnce([{ id: TMPL_ID }]); // template org-validation

    const app = await makeApp(ORG_A);
    const res = await request(app).post(`/api/audit/programs/${PROG_ID}/generate-surveys`);
    expect(res.status).toBe(200);
    // Only own-user assignment created — foreign user silently dropped
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArg = mockCreate.mock.calls[0][0];
    expect(callArg.assigneeUserIds).toEqual([OWN_ASSIGNEE]);
    expect(callArg.assigneeUserIds).not.toContain(FOREIGN_ASSIGNEE);
  });

  it('SEC-3 (templates): filters foreign templates — no assignment for a non-org template', async () => {
    const rowWithForeignTemplate = baseRow({
      config: JSON.stringify({
        templateIds: [TMPL_ID, 'tmpl-foreign-org'],
        assigneeIds: [OWN_ASSIGNEE],
      }),
    });

    mockDbGet
      .mockResolvedValueOnce(rowWithForeignTemplate) // 1: getProgram
      .mockResolvedValueOnce(rowWithForeignTemplate) // 2: updateProgram exist-check
      .mockResolvedValueOnce(updatedRow()); // 3: post-update return
    mockDbAll
      .mockResolvedValueOnce([{ user_id: OWN_ASSIGNEE }]) // org_members
      // template org-validation: only the own-org template survives; foreign dropped
      .mockResolvedValueOnce([{ id: TMPL_ID }]);

    const app = await makeApp(ORG_A);
    const res = await request(app).post(`/api/audit/programs/${PROG_ID}/generate-surveys`);
    expect(res.status).toBe(200);
    // Exactly one assignment — only the org's own template fanned out
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ templateId: TMPL_ID }));
    expect(mockCreate).not.toHaveBeenCalledWith(
      expect.objectContaining({ templateId: 'tmpl-foreign-org' })
    );
  });

  it('SEC-3 (templates): no assignments when the only template is foreign', async () => {
    const rowAllForeignTemplate = baseRow({
      config: JSON.stringify({
        templateIds: ['tmpl-foreign-org'],
        assigneeIds: [OWN_ASSIGNEE],
      }),
    });

    mockDbGet.mockResolvedValueOnce(rowAllForeignTemplate);
    mockDbAll
      .mockResolvedValueOnce([{ user_id: OWN_ASSIGNEE }]) // org_members
      .mockResolvedValueOnce([]); // template org-validation: foreign template not accessible

    const app = await makeApp(ORG_A);
    const res = await request(app).post(`/api/audit/programs/${PROG_ID}/generate-surveys`);
    expect(res.status).toBe(200);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(res.body.created).toBe(0);
  });

  it('SEC-3: no assignments created when all assignees are foreign', async () => {
    const rowWithForeign = baseRow({
      config: JSON.stringify({
        templateIds: [TMPL_ID],
        assigneeIds: [FOREIGN_ASSIGNEE],
      }),
    });

    mockDbGet.mockResolvedValueOnce(rowWithForeign);
    mockDbAll
      .mockResolvedValueOnce([]) // org_members: empty — foreign user is not a member
      .mockResolvedValueOnce([{ id: TMPL_ID }]); // template is valid — isolates the assignee filter

    const app = await makeApp(ORG_A);
    const res = await request(app).post(`/api/audit/programs/${PROG_ID}/generate-surveys`);
    expect(res.status).toBe(200);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(res.body.created).toBe(0);
  });

  // ── INFO-DISCLOSURE: per-pair failures must not leak raw error text ──────────
  // When the shared interviewAssignmentService.create() throws an error whose
  // message carries internal schema / DB-driver detail, the generate-surveys
  // result's errors[] entry must surface a GENERIC client-safe message + a
  // STABLE code — never the raw text. The real error is logged server-side only.
  it('does not leak raw assignment-service error text in generate-surveys errors[]', async () => {
    const LEAKY = 'duplicate key value violates unique constraint "interview_assignments_pkey"';
    mockCreate.mockRejectedValueOnce(new Error(LEAKY));

    mockDbGet
      .mockResolvedValueOnce(baseRow()) // 1: initial getProgram
      .mockResolvedValueOnce(baseRow()) // 2: updateProgram existence check
      .mockResolvedValueOnce(updatedRow()); // 3: post-update getProgram return
    mockDbAll
      .mockResolvedValueOnce([{ user_id: OWN_ASSIGNEE }]) // org_members check
      .mockResolvedValueOnce([{ id: TMPL_ID }]); // template org-validation

    const app = await makeApp(ORG_A);
    const res = await request(app).post(`/api/audit/programs/${PROG_ID}/generate-surveys`);

    expect(res.status).toBe(200);
    expect(res.body.failed).toBe(1);
    // Shape preserved: errors[] with { templateId, assigneeId, message } + new code.
    expect(Array.isArray(res.body.errors)).toBe(true);
    expect(res.body.errors).toHaveLength(1);
    const entry = res.body.errors[0];
    expect(entry.templateId).toBe(TMPL_ID);
    expect(entry.assigneeId).toBe(OWN_ASSIGNEE);
    // Generic message + stable code — and crucially NO raw driver/schema text.
    expect(entry.code).toBe('AUDIT_SURVEY_PAIR_FAILED');
    expect(entry.message).toBe('Failed to generate survey for this template/assignee');
    const serialized = JSON.stringify(res.body);
    expect(serialized).not.toContain('unique constraint');
    expect(serialized).not.toContain('interview_assignments_pkey');
  });

  it('idempotent: returns alreadyGenerated=true on second call', async () => {
    const generated = baseRow({
      config: JSON.stringify({
        templateIds: [TMPL_ID],
        assigneeIds: [OWN_ASSIGNEE],
        surveysGenerated: true,
        generatedAssignmentIds: ['ia-existing'],
      }),
    });

    mockDbGet.mockResolvedValueOnce(generated);
    const app = await makeApp(ORG_A);
    const res = await request(app).post(`/api/audit/programs/${PROG_ID}/generate-surveys`);
    expect(res.status).toBe(200);
    expect(res.body.alreadyGenerated).toBe(true);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('audit-programs completion rollup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDbAll.mockResolvedValue([]);
    mockDbGet.mockResolvedValue(undefined);
    mockDbRun.mockResolvedValue({ success: true, changes: 1 });
  });

  it('returns 404 when program not found', async () => {
    mockDbGet.mockResolvedValueOnce(undefined);
    const app = await makeApp();
    const res = await request(app).get(`/api/audit/programs/${PROG_ID}/completion`);
    expect(res.status).toBe(404);
  });

  it('returns generated=false when no surveys have been generated yet', async () => {
    mockDbGet.mockResolvedValueOnce(baseRow());
    const app = await makeApp(ORG_A);
    const res = await request(app).get(`/api/audit/programs/${PROG_ID}/completion`);
    expect(res.status).toBe(200);
    expect(res.body.completion.generated).toBe(false);
    expect(res.body.completion.total).toBe(0);
  });
});
