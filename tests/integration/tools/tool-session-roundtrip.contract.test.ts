/**
 * HARVARD H3 — Tool session round-trip contract (SWOT reference chain).
 *
 * Proves the full consulting-tool mechanics against a REAL SQL store:
 *   create → save answers → partial (wizard-style) save → resume (GET)
 *   → DoD → review → approve → promote to output (+ dedupe).
 *
 * The persistence seam (`queryHelpers` queryOne/queryAll/queryRun/
 * getTableColumns) is backed by an in-memory SQLite database, so the
 * controller's ACTUAL SQL executes and rows genuinely persist between
 * requests. Anti-false-green: the resume GET is a separate request reading
 * physically stored rows — not an echo of the request payload.
 *
 * Regression coverage for real chain breaks found in runtime code:
 *   1. PUT /tools/:id with a partial payload (only wizardState/missingItems/
 *      status — exactly what wizard auto-save sends) used to unconditionally
 *      overwrite answers_json/context_snapshot with '{}' and zero
 *      completion_percent/confidence_avg → resumed sessions came back empty
 *      and the DoD gate (confidence >= 3) was permanently blocked.
 *   2. GET /tools/:id used raw JSON.parse on answers_json/context_snapshot →
 *      a corrupt blob produced an uncaught 500 instead of a fail-soft {}.
 *   3. ensureToolsSchema did not create output_json although the Conclusions
 *      sync SELECTs it (silent empty conclusions on fresh DBs).
 */

import express, { type Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// ---- Real in-memory SQLite behind the queryHelpers seam --------------------
const sqliteCtx = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sqlite3 = require('sqlite3') as typeof import('sqlite3');
  return { db: new sqlite3.Database(':memory:') };
});

const sqlAll = <T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> =>
  new Promise((resolve, reject) => {
    sqliteCtx.db.all(sql, params, (err: Error | null, rows: unknown[]) =>
      err ? reject(err) : resolve((rows || []) as T[])
    );
  });
const sqlGet = <T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> =>
  new Promise((resolve, reject) => {
    sqliteCtx.db.get(sql, params, (err: Error | null, row: unknown) =>
      err ? reject(err) : resolve((row || null) as T | null)
    );
  });
const sqlRun = (sql: string, params: unknown[] = []): Promise<{ changes: number }> =>
  new Promise((resolve, reject) => {
    sqliteCtx.db.run(sql, params, function (this: { changes: number }, err: Error | null) {
      if (err) return reject(err);
      resolve({ changes: this.changes });
    });
  });

vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: (sql: string, params: unknown[] = []) => sqlAll(sql, params),
  queryOne: (sql: string, params: unknown[] = []) => sqlGet(sql, params),
  queryRun: (sql: string, params: unknown[] = []) => sqlRun(sql, params),
  getTableColumns: async (tableName: string) => {
    // SQLite PRAGMA gives the same { name } shape the PG implementation returns.
    const safe = String(tableName).replace(/[^a-zA-Z0-9_]/g, '');
    return sqlAll<{ name: string }>(`PRAGMA table_info(${safe})`);
  },
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ---- Auth / middleware: deterministic user, no network ----------------------
const ORG_A = 'org-roundtrip-a';
const USER_A = 'user-roundtrip-a';
const mockUser = {
  id: USER_A,
  role: 'ADMIN',
  organizationId: ORG_A,
  isSuperAdmin: false,
  firstName: 'Round',
  lastName: 'Trip',
  email: 'roundtrip@example.com',
};

vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  default: (req: any, _res: any, next: () => void) => {
    req.user = mockUser;
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    next();
  },
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = mockUser;
    req.userId = mockUser.id;
    req.organizationId = mockUser.organizationId;
    next();
  },
}));
vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: any, _res: any, next: () => void) => next(),
}));

// ---- Service collaborators outside the persistence chain -------------------
vi.mock('../../../server/src/services/KnownToolsService.js', () => ({
  default: {
    getKnownToolAvailability: vi.fn().mockResolvedValue({ exists: false, isActive: false }),
    listKnownTools: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  },
}));
vi.mock(
  '../../../server/src/services/organizationContext/OrganizationContextService.js',
  () => ({
    default: { recordToolSession: vi.fn().mockResolvedValue(undefined) },
  })
);
vi.mock('../../../server/src/services/permissionService.js', () => ({
  hasPermission: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../../server/src/services/conclusions/toolConclusionBridge.js', () => ({
  safePersistToolSessionConclusion: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../server/src/services/ToolInitiativeService.js', () => ({
  default: {
    generateFromSession: vi.fn().mockResolvedValue([]),
    persistInitiatives: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('../../../server/src/services/initiative/createInitiativeService.js', () => ({
  createInitiative: vi.fn().mockResolvedValue({ id: 'funnel-initiative-1' }),
}));

// ---- App under test ---------------------------------------------------------
let app: Express;

const SWOT_ANSWERS = {
  signals: [
    { id: 's1', text: 'Strong brand recognition in EU mid-market', quadrant: 'strength' },
    { id: 's2', text: 'Legacy ERP slows order-to-cash', quadrant: 'weakness' },
  ],
  summary: {
    executiveSummary: 'Prioritize EU expansion while modernizing order-to-cash.',
    proposalStatus: 'accepted',
  },
};
const CONTEXT_SNAPSHOT = { org: { name: 'Acme Sp. z o.o.' }, initiatives: [] };

describe('H3 tool session round-trip (create → save → resume → output)', () => {
  let sessionId = '';

  beforeAll(async () => {
    // Tables outside ensureToolsSchema that the review/approve path INSERTs into.
    await sqlRun(
      `CREATE TABLE decisions (
        id TEXT PRIMARY KEY, organization_id TEXT, project_id TEXT, initiative_id TEXT,
        task_id TEXT, title TEXT, description TEXT, type TEXT, decision_maker_id TEXT,
        deadline TEXT, escalation_deadline TEXT, status TEXT, created_by TEXT,
        priority TEXT, impact TEXT, escalation_level TEXT, pmo_domain TEXT,
        required INTEGER, created_at TEXT, updated_at TEXT
      )`
    );
    await sqlRun(
      `CREATE TABLE decision_history (
        id TEXT PRIMARY KEY, decision_id TEXT, action TEXT, old_status TEXT,
        new_status TEXT, changed_by TEXT, details TEXT
      )`
    );
    await sqlRun(
      `CREATE TABLE permissions (key TEXT PRIMARY KEY, description TEXT, category TEXT)`
    );
    await sqlRun(
      `CREATE TABLE role_permissions (id TEXT PRIMARY KEY, role TEXT, permission_key TEXT)`
    );
    await sqlRun(
      `CREATE TABLE initiatives (
        id TEXT PRIMARY KEY, organization_id TEXT, project_id TEXT, name TEXT, title TEXT,
        summary TEXT, status TEXT, axis TEXT, source_type TEXT, source_id TEXT,
        priority_order INTEGER, created_at TEXT, updated_at TEXT
      )`
    );

    const { default: toolsRoutes } = await import('../../../server/src/routes/tools.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/tools', toolsRoutes);
  });

  it('creates a SWOT tool session (DRAFT)', async () => {
    const res = await request(app)
      .post('/api/tools')
      .send({ toolType: 'dynamic-swot', name: 'SWOT — Acme growth review' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
    expect(res.body.status).toBe('DRAFT');
    sessionId = res.body.id;
  });

  it('ensureToolsSchema provisions output_json (read by Conclusions sync)', async () => {
    const cols = await sqlAll<{ name: string }>(`PRAGMA table_info(tool_sessions)`);
    expect(cols.map((c) => c.name)).toContain('output_json');
  });

  it('saves answers + context + DoD metrics (full save)', async () => {
    // CAS (Sprint S1): a freshly created session starts at version 1 (see
    // createToolSession's response / tool_sessions.version's DB default) —
    // every PUT below threads expectedVersion through and bumps it by
    // exactly 1 on success, matching the sequence of successful writes.
    const res = await request(app).put(`/api/tools/${sessionId}`).send({
      answers: SWOT_ANSWERS,
      contextSnapshot: CONTEXT_SNAPSHOT,
      completionPercent: 40,
      confidenceAvg: 2,
      expectedVersion: 1,
    });
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(2);
  });

  it('a wizard-style PARTIAL save must NOT wipe answers/context/DoD metrics', async () => {
    // Exactly the payload the wizard auto-save sends: no answers, no context,
    // no completion/confidence. Before the H3 fix this reset everything.
    const res = await request(app)
      .put(`/api/tools/${sessionId}`)
      .send({
        status: 'IN_PROGRESS',
        wizardState: { currentStep: 'work', toolType: 'dynamic-swot' },
        missingItems: [
          { id: 'gap-1', label: 'Missing recommended moves', severity: 'blocker', resolved: false },
        ],
        expectedVersion: 2,
      });
    expect(res.status).toBe(200);
    expect(res.body.version).toBe(3);

    // Resume: a fresh GET must return the previously saved state.
    const resumed = await request(app).get(`/api/tools/${sessionId}`);
    expect(resumed.status).toBe(200);
    expect(resumed.body.status).toBe('IN_PROGRESS');
    expect(resumed.body.answers).toEqual(SWOT_ANSWERS);
    expect(resumed.body.contextSnapshot).toEqual(CONTEXT_SNAPSHOT);
    expect(resumed.body.progress).toBe(40);
    expect(resumed.body.confidenceAvg).toBe(2);
    expect(resumed.body.wizardState).toMatchObject({ currentStep: 'work' });
    expect(resumed.body.missingItems).toHaveLength(1);
    // CAS: GET now returns the real server version too (previously never
    // returned at all).
    expect(resumed.body.version).toBe(3);
  });

  it('resume is fail-soft on a corrupt answers blob (no 500 / white screen)', async () => {
    await sqlRun(`UPDATE tool_sessions SET answers_json = ? WHERE id = ?`, [
      '{corrupt json!!!',
      sessionId,
    ]);
    const res = await request(app).get(`/api/tools/${sessionId}`);
    expect(res.status).toBe(200);
    expect(res.body.answers).toEqual({});
    // Restore the real answers for the rest of the chain.
    await sqlRun(`UPDATE tool_sessions SET answers_json = ? WHERE id = ?`, [
      JSON.stringify(SWOT_ANSWERS),
      sessionId,
    ]);
  });

  it('DoD gate blocks review while completion/confidence are below threshold', async () => {
    const res = await request(app).post(`/api/tools/${sessionId}/request-review`).send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('DoD not satisfied');
  });

  it('completes DoD, passes review and approval', async () => {
    // Version is still 3 here — the corrupt-blob test above wrote directly
    // via raw SQL (bypassing the controller, and with it the version bump),
    // so it never advanced the counter.
    const save = await request(app).put(`/api/tools/${sessionId}`).send({
      answers: SWOT_ANSWERS,
      contextSnapshot: CONTEXT_SNAPSHOT,
      completionPercent: 100,
      confidenceAvg: 4,
      missingItems: [],
      expectedVersion: 3,
    });
    expect(save.status).toBe(200);
    expect(save.body.version).toBe(4);

    const review = await request(app).post(`/api/tools/${sessionId}/request-review`).send({});
    expect(review.status).toBe(200);
    expect(review.body.status).toBe('REVIEW');

    const approve = await request(app).post(`/api/tools/${sessionId}/approve`).send({});
    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe('APPROVED');
  });

  it('approval froze an immutable answers snapshot for the report trail', async () => {
    const res = await request(app).get(`/api/tools/${sessionId}`);
    expect(res.status).toBe(200);
    expect(res.body.contextSnapshot.approvedSnapshot).toMatchObject({
      toolSessionId: sessionId,
      toolType: 'dynamic-swot',
      completionPercent: 100,
    });
    expect(res.body.contextSnapshot.approvedSnapshot.answers).toEqual(SWOT_ANSWERS);
  });

  it('locks content edits after approval', async () => {
    const res = await request(app).put(`/api/tools/${sessionId}`).send({
      answers: { tampered: true },
    });
    expect(res.status).toBe(409);
  });

  it('promotes the approved session to an output and records traceability', async () => {
    const res = await request(app).post(`/api/tools/${sessionId}/promote`).send({
      outputType: 'idea',
      title: 'SWOT output — EU expansion focus',
      description: 'Prioritize EU expansion while modernizing order-to-cash.',
    });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeTruthy();
    expect(res.body.sourceSessionId).toBe(sessionId);
    expect(res.body.sourceToolType).toBe('dynamic-swot');

    const link = await sqlGet<{ initiative_id: string }>(
      `SELECT initiative_id FROM tool_initiative_links WHERE tool_session_id = ? AND batch_id = ?`,
      [sessionId, 'promote-idea']
    );
    expect(link?.initiative_id).toBe(res.body.id);
  });

  it('re-promotion is idempotent (deduplicated, same output id)', async () => {
    const first = await sqlGet<{ initiative_id: string }>(
      `SELECT initiative_id FROM tool_initiative_links WHERE tool_session_id = ? AND batch_id = ?`,
      [sessionId, 'promote-idea']
    );
    const res = await request(app).post(`/api/tools/${sessionId}/promote`).send({
      outputType: 'idea',
      title: 'SWOT output — EU expansion focus',
    });
    expect(res.status).toBe(200);
    expect(res.body.deduplicated).toBe(true);
    expect(res.body.id).toBe(first?.initiative_id);
  });
});
