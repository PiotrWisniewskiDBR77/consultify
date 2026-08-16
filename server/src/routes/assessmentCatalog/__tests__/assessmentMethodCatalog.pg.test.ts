/** @vitest-environment node */

/**
 * ASM-METHOD-CATALOG-001 — proves the fail-closed method catalog gate on the
 * V8 assessment surface against REAL PostgreSQL.
 *
 * Owner decision this enforces: DRD is the only assessment methodology with
 * cleared content provenance/rights. SIRI / ADMA / CMMI / LEAN and any other
 * type are BLOCKED at the server (not just hidden by a disabled client
 * button) until an explicit Product + Methodology/Rights owner decision.
 * See docs/program/evidence/closure/a/ASM-METHOD-CATALOG-001/DECISION_PACKET.md.
 *
 * This suite intentionally mounts `assessment.routes.js` (from the sibling
 * `server/src/routes/v8/` directory) directly — same pattern as
 * `assessment.accepted-freeze.pg.test.ts` — bypassing `v8FeatureGate`/
 * `v8OrgGate` (owned by Gateway.ts, outside this lane's allowlist). That
 * means a 404 from the global `ENABLE_V8_GLOBAL` gate is structurally
 * impossible in this suite — there is no gate in the request path to
 * produce one. Every governance-denial assertion below additionally checks
 * the status is 403 (not 404) and the code is the real governance code
 * (`ASSESSMENT_METHOD_NOT_ENABLED`, never `V8_DISABLED`/`V8_ORG_DISABLED`),
 * so a gate-shaped false negative would be caught even if that changed.
 *
 * Status/code matrix this suite proves (server/src/routes/v8/assessment.routes.ts):
 *   DRD                        -> 201 (created)
 *   SIRI / ADMA / CMMI / LEAN  -> 403 ASSESSMENT_METHOD_NOT_ENABLED  (known type, not governed)
 *   unknown/garbage type       -> 400 ASSESSMENT_INVALID_TYPE        (malformed request, pre-existing check)
 * Both non-201 branches are fail-closed: neither persists a row.
 */

import { randomUUID } from 'crypto';

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { dbGet } from '../../../database/db.js';
import { assertRealDatabase, fromAppDb } from '../../../testing/assertRealDatabase.js';

const SUFFIX = randomUUID().slice(0, 8);
const ORG_A = `org-methcat-a-${SUFFIX}`;
const ORG_B = `org-methcat-b-${SUFFIX}`;
const USER = `user-methcat-${SUFFIX}`;

const run = async (sql: string, params: unknown[] = []) => {
  const { getDatabaseAsync } = await import('../../../database/Database.js');
  const db: any = await getDatabaseAsync();
  return db.run(sql, params);
};

// Mutable so individual tests can switch tenant context without a second
// mock/app instance — mirrors the real request lifecycle (getV8Context is
// re-evaluated on every request).
let currentV8Context: { organizationId: string; userId: string; userRole: string } = {
  organizationId: ORG_A,
  userId: USER,
  userRole: 'ADMIN',
};

vi.mock('../../../middleware/v8Auth.middleware.js', () => ({
  getV8Context: (_req: unknown) => currentV8Context,
}));

vi.mock('../../../controllers/AssessmentController.js', () => ({
  ensureAssessmentSchema: vi.fn().mockResolvedValue(undefined),
  normalizeStatus: (status: string | null | undefined) => String(status || 'DRAFT').toUpperCase(),
}));

vi.mock('../../../services/assessmentPermissionService.js', () => ({
  default: {
    getUserRole: vi.fn().mockResolvedValue({
      role: 'editor',
      permissions: { canView: true, canEdit: true },
      assignedAreas: [],
      isOwner: false,
    }),
    getDefaultPermissions: vi.fn().mockReturnValue({ canView: true, canEdit: true }),
  },
}));

vi.mock('../../../utils/AssessmentAuditLogger.js', () => ({
  assessmentAuditLogger: {
    logCreation: vi.fn().mockResolvedValue(undefined),
    logUpdate: vi.fn().mockResolvedValue(undefined),
  },
}));

async function countAssessments(organizationId: string): Promise<number> {
  const row = await dbGet<{ count: string }>(
    `SELECT count(*) as count FROM assessments WHERE organization_id = ?`,
    [organizationId]
  );
  return Number(row?.count || 0);
}

describe('ASM-METHOD-CATALOG-001 — method catalog fail-closed gate — real PostgreSQL', () => {
  let app: express.Express;

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || process.env.RUN_DB_TESTS !== '1') {
      throw new Error('Requires NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false and a real DATABASE_URL.');
    }

    // Fail-closed proof this suite is on a real connection, not the app
    // mock DB — env vars alone only state intent (see assertRealDatabase.ts).
    const { getDatabaseAsync } = await import('../../../database/Database.js');
    const db = await getDatabaseAsync();
    await assertRealDatabase(fromAppDb(db as unknown as { all: (sql: string) => Promise<unknown> }));

    await run(`INSERT INTO organizations (id, name) VALUES (?, ?) ON CONFLICT (id) DO NOTHING`, [
      ORG_A,
      'ASM-METHOD-CATALOG-001 org A',
    ]);
    await run(`INSERT INTO organizations (id, name) VALUES (?, ?) ON CONFLICT (id) DO NOTHING`, [
      ORG_B,
      'ASM-METHOD-CATALOG-001 org B',
    ]);

    const { default: assessmentRoutes } = await import('../../v8/assessment.routes.js');
    app = express();
    app.use(express.json());
    app.use('/api/v8/assessment', assessmentRoutes);
  });

  afterAll(async () => {
    await run(`DELETE FROM assessment_sessions WHERE assessment_id IN (SELECT id FROM assessments WHERE organization_id IN (?, ?))`, [
      ORG_A,
      ORG_B,
    ]);
    await run(`DELETE FROM assessments WHERE organization_id IN (?, ?)`, [ORG_A, ORG_B]);
    await run(`DELETE FROM organizations WHERE id IN (?, ?)`, [ORG_A, ORG_B]);
  });

  it('1) POSITIVE control: DRD create still works — a row is actually persisted', async () => {
    currentV8Context = { organizationId: ORG_A, userId: USER, userRole: 'ADMIN' };

    const res = await request(app)
      .post('/api/v8/assessment')
      .send({ assessmentType: 'DRD', name: 'ASM-METHOD-CATALOG-001 positive control' });

    expect(res.status).toBe(201);
    expect(res.body.data?.assessment?.assessmentType).toBe('DRD');
    const id = res.body.data?.id as string;
    expect(id).toBeTruthy();

    const row = await dbGet<{ assessment_type: string; organization_id: string }>(
      `SELECT assessment_type, organization_id FROM assessments WHERE id = ?`,
      [id]
    );
    expect(row?.assessment_type).toBe('DRD');
    expect(row?.organization_id).toBe(ORG_A);
  });

  it('2) SIRI is refused with the exact governance status + code, real 403 not gate 404', async () => {
    currentV8Context = { organizationId: ORG_A, userId: USER, userRole: 'ADMIN' };
    const before = await countAssessments(ORG_A);

    const res = await request(app)
      .post('/api/v8/assessment')
      .send({ assessmentType: 'SIRI', name: 'Should be refused' });

    expect(res.status).toBe(403);
    expect(res.status).not.toBe(404); // rules out a gate-shaped false negative
    expect(res.body.code).toBe('ASSESSMENT_METHOD_NOT_ENABLED');
    expect(res.body.code).not.toBe('V8_DISABLED');
    expect(res.body.assessmentType).toBe('SIRI');
    expect(res.body.allowedTypes).toEqual(['DRD']);

    const after = await countAssessments(ORG_A);
    expect(after).toBe(before);
  });

  it('3) ADMA is refused with the exact governance status + code, real 403 not gate 404', async () => {
    currentV8Context = { organizationId: ORG_A, userId: USER, userRole: 'ADMIN' };
    const before = await countAssessments(ORG_A);

    const res = await request(app)
      .post('/api/v8/assessment')
      .send({ assessmentType: 'ADMA', name: 'Should be refused' });

    expect(res.status).toBe(403);
    expect(res.status).not.toBe(404);
    expect(res.body.code).toBe('ASSESSMENT_METHOD_NOT_ENABLED');
    expect(res.body.code).not.toBe('V8_DISABLED');
    expect(res.body.assessmentType).toBe('ADMA');

    const after = await countAssessments(ORG_A);
    expect(after).toBe(before);
  });

  it('4) fail-closed (not fail-open): an unknown/garbage type is refused as a malformed request (400 ASSESSMENT_INVALID_TYPE) — distinct from the 403 governance denial, but equally fail-closed: nothing is persisted', async () => {
    currentV8Context = { organizationId: ORG_A, userId: USER, userRole: 'ADMIN' };
    const before = await countAssessments(ORG_A);

    const res = await request(app)
      .post('/api/v8/assessment')
      .send({ assessmentType: 'TOTALLY_MADE_UP_METHOD_XYZ', name: 'Should be refused' });

    // Pre-existing shape-validation contract (matches
    // tests/integration/assessment/drd-assessment-roundtrip.contract.test.ts:189-195,
    // which asserts this exact status+code for an unrecognized type) — NOT
    // the ASM-METHOD-CATALOG-001 governance code, because this type was
    // never recognized in the first place, so it never reaches the
    // governance check.
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ASSESSMENT_INVALID_TYPE');
    expect(res.body.code).not.toBe('ASSESSMENT_METHOD_NOT_ENABLED');

    // Fail-closed regardless of which of the two branches refused it:
    // nothing is ever persisted for an unapproved/unrecognized type.
    const after = await countAssessments(ORG_A);
    expect(after).toBe(before);
  });

  it('5) nothing is persisted on a refused CMMI/LEAN request (SELECT count(*) unchanged for both)', async () => {
    currentV8Context = { organizationId: ORG_A, userId: USER, userRole: 'ADMIN' };
    const before = await countAssessments(ORG_A);

    const cmmi = await request(app)
      .post('/api/v8/assessment')
      .send({ assessmentType: 'CMMI', name: 'Should be refused' });
    const lean = await request(app)
      .post('/api/v8/assessment')
      .send({ assessmentType: 'LEAN', name: 'Should be refused' });

    expect(cmmi.status).toBe(403);
    expect(lean.status).toBe(403);
    expect(cmmi.body.code).toBe('ASSESSMENT_METHOD_NOT_ENABLED');
    expect(lean.body.code).toBe('ASSESSMENT_METHOD_NOT_ENABLED');

    const after = await countAssessments(ORG_A);
    expect(after).toBe(before);
  });

  it('6) tenant negative: denial applies regardless of organization, and the definitions endpoint does not leak a non-governed catalog cross-org', async () => {
    // Org A: refused for SIRI on create.
    currentV8Context = { organizationId: ORG_A, userId: USER, userRole: 'ADMIN' };
    const createA = await request(app)
      .post('/api/v8/assessment')
      .send({ assessmentType: 'SIRI', name: 'Org A should be refused' });
    expect(createA.status).toBe(403);
    expect(createA.body.code).toBe('ASSESSMENT_METHOD_NOT_ENABLED');

    // Org B: independently refused for SIRI on create — the gate is not
    // keyed off organization at all, so both orgs must see the identical
    // denial (no org-specific allowlist bypass).
    currentV8Context = { organizationId: ORG_B, userId: USER, userRole: 'ADMIN' };
    const createB = await request(app)
      .post('/api/v8/assessment')
      .send({ assessmentType: 'SIRI', name: 'Org B should be refused' });
    expect(createB.status).toBe(403);
    expect(createB.body.code).toBe('ASSESSMENT_METHOD_NOT_ENABLED');

    // The read path (definitions catalog) is consistent with the write
    // path for both orgs — same denial, no org sees a different (leaked)
    // SIRI catalog.
    currentV8Context = { organizationId: ORG_A, userId: USER, userRole: 'ADMIN' };
    const defsA = await request(app).get('/api/v8/assessment/definitions/SIRI');
    expect(defsA.status).toBe(403);
    expect(defsA.body.code).toBe('ASSESSMENT_METHOD_NOT_ENABLED');

    currentV8Context = { organizationId: ORG_B, userId: USER, userRole: 'ADMIN' };
    const defsB = await request(app).get('/api/v8/assessment/definitions/SIRI');
    expect(defsB.status).toBe(403);
    expect(defsB.body.code).toBe('ASSESSMENT_METHOD_NOT_ENABLED');

    expect(defsA.body).toEqual(defsB.body);

    // Cross-org read isolation on the underlying assessment: a DRD
    // assessment created under org A is not readable through org B's
    // context (pre-existing org scoping on GET /:id — reverified here as
    // part of the tenant-negative evidence for this task).
    currentV8Context = { organizationId: ORG_A, userId: USER, userRole: 'ADMIN' };
    const created = await request(app)
      .post('/api/v8/assessment')
      .send({ assessmentType: 'DRD', name: 'Org A only' });
    expect(created.status).toBe(201);
    const createdId = created.body.data?.id as string;

    currentV8Context = { organizationId: ORG_B, userId: USER, userRole: 'ADMIN' };
    const crossOrgRead = await request(app).get(`/api/v8/assessment/${createdId}`);
    expect(crossOrgRead.status).toBe(404);
    expect(crossOrgRead.body.code).toBe('ASSESSMENT_NOT_FOUND');
  });

  it('7) cold readback: after a successful DRD create, a fresh query still returns exactly one row of the expected type', async () => {
    currentV8Context = { organizationId: ORG_A, userId: USER, userRole: 'ADMIN' };
    const uniqueName = `ASM-METHOD-CATALOG-001 cold readback ${randomUUID()}`;

    const res = await request(app)
      .post('/api/v8/assessment')
      .send({ assessmentType: 'DRD', name: uniqueName });
    expect(res.status).toBe(201);
    const id = res.body.data?.id as string;

    // Fresh, independent query (not reusing anything from the response body)
    // against the real database.
    const rows = await new Promise<Array<Record<string, unknown>>>((resolve, reject) => {
      import('../../../database/Database.js').then(async ({ getDatabaseAsync }) => {
        const db: any = await getDatabaseAsync();
        db.all(
          `SELECT id, assessment_type, name FROM assessments WHERE organization_id = ? AND name = ?`,
          [ORG_A, uniqueName],
          (err: Error | null, result: unknown[]) => {
            if (err) reject(err);
            else resolve(result as Array<Record<string, unknown>>);
          }
        );
      });
    });

    expect(rows.length).toBe(1);
    expect(rows[0].id).toBe(id);
    expect(rows[0].assessment_type).toBe('DRD');
  });
});
