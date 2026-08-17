/**
 * CROSS-FLOW segment 04 — Tools/SWOT: freeze → approval → promotion.
 *
 * Runs against a REAL disposable Postgres and a REAL signed JWT through the
 * REAL `tools.routes.ts` router (which applies `verifyToken` + `requireOrgAccess`
 * itself), so authentication, tenancy and RBAC are exercised, not simulated.
 *
 * WHY THIS FILE DOES NOT REUSE THE EXISTING EXE-09 STYLE
 * -----------------------------------------------------
 * `tests/integration/exe009-closure-delivery-receipt.realdb.test.ts:52-58` sets
 * `E2E_MODE='true'` and mints an `{alg:'none'}` token carrying `e2e:true`.
 * `server/src/middleware/auth.middleware.ts:1191-1293` then attaches the user
 * "without signature verification / revocation checks" AND auto-seeds
 * organization membership. Every RBAC/tenant claim made under that mode is a
 * claim about the bypass, not about production auth. This lane's DoD requires
 * a real JWT, so this suite never sets E2E_MODE. Test A1 proves that an unsigned
 * token is rejected in the production-like mode used by this suite; it does
 * not claim that the separate E2E_MODE bypass has been removed.
 *
 * RUN:
 *   DATABASE_URL="postgresql://cfq:cfq@127.0.0.1:56901/cfq" NODE_ENV=test \
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *   npx vitest run tests/integration/crossflow/cf-04-tools-swot-governance.realdb.test.ts \
 *     --no-file-parallelism --maxWorkers=1 --retry=0
 *
 * `--retry=0` is mandatory: `vitest.config.ts:311` is `retry: CI ? 3 : 1`, so a
 * flaky-looking pass would otherwise be a silently retried pass.
 */
// flowFixture MUST be first: it pins JWT_SECRET before any server module loads
// Config.ts and computes a different deterministic default.
import {
  ALL_TENANTS,
  TENANT_A,
  TENANT_B,
  bearer,
  cfId,
  coldRead,
  dbReachable,
  dropTenants,
  newClient,
  raceExactly,
  seedTenants,
} from './flowFixture.js';

import type { Express } from 'express';
import express from 'express';
import type pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const SWOT_SESSION_DRAFT = cfId('tool', 'swot-draft');
const SWOT_SESSION_B = cfId('tool', 'swot-tenant-b');
const NONEXISTENT_SESSION = cfId('tool', 'never-created');

let client: pg.Client;
let app: Express;
/**
 * Fail-closed, never a vacuous pass. `RUN_DB_TESTS=1` is an explicit promise
 * that a database exists; if it then does not, that is a FAILURE, not a
 * "clean skip". The `expect(true).toBe(true)` idiom used by 33 of this repo's
 * 218 realdb suites reports green with zero assertions executed — this lane
 * refuses that pattern.
 */
let unreachableReason: string | null = null;

beforeAll(async () => {
  if (!(await dbReachable())) {
    if (process.env.RUN_DB_TESTS === '1') {
      throw new Error(
        'RUN_DB_TESTS=1 was set but the disposable Postgres at DATABASE_URL is unreachable. ' +
          'Refusing to report a vacuous pass.'
      );
    }
    unreachableReason = 'no DATABASE_URL / Postgres unreachable and RUN_DB_TESTS not set';
    return;
  }

  client = newClient();
  await client.connect();
  await seedTenants(client);

  // A DRAFT SWOT session in tenant A: never reviewed, never approved, never
  // frozen. This is the object the governance chain must refuse to promote.
  await client.query(
    `INSERT INTO tool_sessions (id, organization_id, tool_type, name, status, created_by)
     VALUES ($1, $2, 'dynamic-swot', 'Crossflow SWOT (DRAFT)', 'DRAFT', $3)
     ON CONFLICT (id) DO UPDATE SET status = 'DRAFT'`,
    [SWOT_SESSION_DRAFT, TENANT_A.id, TENANT_A.owner.id]
  );
  await client.query(
    `INSERT INTO tool_sessions (id, organization_id, tool_type, name, status, created_by)
     VALUES ($1, $2, 'dynamic-swot', 'Crossflow SWOT (tenant B)', 'DRAFT', $3)
     ON CONFLICT (id) DO UPDATE SET status = 'DRAFT'`,
    [SWOT_SESSION_B, TENANT_B.id, TENANT_B.owner.id]
  );

  const toolsRouter = (await import('../../../server/src/routes/tools.routes.js')).default;
  app = express();
  app.use(express.json());
  app.use('/api/tools', toolsRouter);
}, 120_000);

/**
 * FK-safe teardown, children first. The accept-candidate funnel creates rows
 * this suite never asked for (a `projects` row, initiative child records), so
 * a naive "delete my three tables" teardown leaves the tenant undeletable —
 * which is itself useful information about the blast radius of one accept.
 */
const TEARDOWN_ORDER = [
  'swot_candidate_handoffs',
  'tool_decisions',
  'initiative_candidates',
  'initiative_cards',
  'initiative_card_values',
  'initiatives',
  'tool_sessions',
  'decisions',
  'projects',
];

afterAll(async () => {
  if (!client) return;
  const orgs = ALL_TENANTS.map((t) => t.id);
  for (const table of TEARDOWN_ORDER) {
    const exists = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
      [table]
    );
    if (exists.rowCount === 0) continue;
    const hasOrg = await client.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema='public' AND table_name=$1 AND column_name='organization_id'`,
      [table]
    );
    if (hasOrg.rowCount === 0) continue;
    await client
      .query(`DELETE FROM "${table}" WHERE organization_id = ANY($1::text[])`, [orgs])
      .catch(() => undefined);
  }
  await dropTenants(client);
  await client.end();
}, 60_000);

/** Guards against a run that silently did nothing. */
function requireHarness(): void {
  if (unreachableReason) throw new Error(`harness unavailable: ${unreachableReason}`);
}

function handoffBody(recId: string, title: string) {
  return { id: recId, title, rationale: 'Crossflow deterministic rationale' };
}

describe('CF-04 Tools/SWOT governance on real Postgres with a real signed JWT', () => {
  describe('A. auth is real, not bypassed', () => {
    it('A1: with E2E_MODE off, an unsigned {alg:none} token carrying e2e:true is rejected', async () => {
      requireHarness();
      const b64 = (o: unknown) =>
        Buffer.from(JSON.stringify(o))
          .toString('base64')
          .replace(/=/g, '')
          .replace(/\+/g, '-')
          .replace(/\//g, '_');
      const forged = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
        e2e: true,
        id: TENANT_A.owner.id,
        email: TENANT_A.owner.email,
        role: 'OWNER',
        organizationId: TENANT_A.id,
        exp: Math.floor(Date.UTC(2030, 0, 1) / 1000),
      })}.e2e`;

      const res = await request(app)
        .post(`/api/tools/${SWOT_SESSION_DRAFT}/swot-candidates`)
        .set('Authorization', `Bearer ${forged}`)
        .send(handoffBody('rec-99', 'forged'));

      expect(process.env.E2E_MODE).not.toBe('true');
      expect(res.status).toBe(401);
    });

    it('A2: a properly signed token for tenant A is ACCEPTED (harness hermeticity)', async () => {
      requireHarness();
      // Deliberately a READ, not the handoff POST: this probe must not create
      // the very candidate row that test B1 asserts the absence of.
      const res = await request(app)
        .get(`/api/tools/${SWOT_SESSION_DRAFT}`)
        .set('Authorization', bearer(TENANT_A.owner));

      expect(res.status).toBe(200);
      expect(res.body?.status ?? res.body?.data?.status).toBe('DRAFT');
    });
  });

  describe('B. the freeze → approval → promotion sequence', () => {
    it('B1: MEASURED DEFECT (gate OFF, shipped default) — a DRAFT SWOT session is promotable to an initiative candidate', async () => {
      requireHarness();
      expect(process.env.TOOLS_SWOT_HANDOFF_REQUIRE_APPROVAL).not.toBe('true');

      const before = await coldRead((c) =>
        c.query(`SELECT status FROM tool_sessions WHERE id = $1`, [SWOT_SESSION_DRAFT])
      );
      expect(before.rows[0]?.status).toBe('DRAFT');

      const res = await request(app)
        .post(`/api/tools/${SWOT_SESSION_DRAFT}/swot-candidates`)
        .set('Authorization', bearer(TENANT_A.owner))
        .send(handoffBody('rec-1', 'Crossflow candidate from DRAFT SWOT'));

      const candidates = await coldRead((c) =>
        c.query(`SELECT id FROM initiative_candidates WHERE organization_id = $1 AND source_id = $2`, [
          TENANT_A.id,
          `${SWOT_SESSION_DRAFT}:rec-1`,
        ])
      );

      // This is the DEFECT, asserted as fact so it cannot silently change:
      // the governed sequence requires freeze + approval before promotion, yet
      // an unapproved session promotes successfully.
      expect({
        httpStatus: res.status,
        candidateRows: candidates.rowCount,
        sessionStatus: before.rows[0]?.status,
      }).toEqual({ httpStatus: 201, candidateRows: 1, sessionStatus: 'DRAFT' });
    });

    it('B2: FIX (gate ON) — the same DRAFT session is refused with 409 and creates nothing', async () => {
      requireHarness();
      process.env.TOOLS_SWOT_HANDOFF_REQUIRE_APPROVAL = 'true';
      try {
        const res = await request(app)
          .post(`/api/tools/${SWOT_SESSION_DRAFT}/swot-candidates`)
          .set('Authorization', bearer(TENANT_A.owner))
          .send(handoffBody('rec-5', 'gate-on probe'));

        const candidates = await coldRead((c) =>
          c.query(
            `SELECT id FROM initiative_candidates WHERE organization_id = $1 AND source_id = $2`,
            [TENANT_A.id, `${SWOT_SESSION_DRAFT}:rec-5`]
          )
        );
        const receipts = await coldRead((c) =>
          c.query(
            `SELECT id FROM swot_candidate_handoffs
              WHERE organization_id = $1 AND tool_session_id = $2 AND recommendation_id = 'rec-5'`,
            [TENANT_A.id, SWOT_SESSION_DRAFT]
          )
        );

        expect({
          httpStatus: res.status,
          code: res.body?.code,
          candidateRows: candidates.rowCount,
          receiptRows: receipts.rowCount,
        }).toEqual({
          httpStatus: 409,
          code: 'SWOT_SESSION_NOT_APPROVED',
          candidateRows: 0,
          receiptRows: 0,
        });
      } finally {
        delete process.env.TOOLS_SWOT_HANDOFF_REQUIRE_APPROVAL;
      }
    });

    it('B3: FIX (gate ON) — an APPROVED session still passes, so the gate blocks only the ungoverned path', async () => {
      requireHarness();
      const approved = cfId('tool', 'swot-approved');
      await client.query(
        `INSERT INTO tool_sessions (id, organization_id, tool_type, name, status, approved_at, created_by)
         VALUES ($1, $2, 'dynamic-swot', 'Crossflow SWOT (APPROVED)', 'APPROVED', NOW(), $3)
         ON CONFLICT (id) DO UPDATE SET status = 'APPROVED'`,
        [approved, TENANT_A.id, TENANT_A.owner.id]
      );

      process.env.TOOLS_SWOT_HANDOFF_REQUIRE_APPROVAL = 'true';
      try {
        const res = await request(app)
          .post(`/api/tools/${approved}/swot-candidates`)
          .set('Authorization', bearer(TENANT_A.owner))
          .send(handoffBody('rec-6', 'approved-session probe'));

        const candidates = await coldRead((c) =>
          c.query(
            `SELECT id FROM initiative_candidates WHERE organization_id = $1 AND source_id = $2`,
            [TENANT_A.id, `${approved}:rec-6`]
          )
        );
        expect({ httpStatus: res.status, candidateRows: candidates.rowCount }).toEqual({
          httpStatus: 201,
          candidateRows: 1,
        });
      } finally {
        delete process.env.TOOLS_SWOT_HANDOFF_REQUIRE_APPROVAL;
      }
    });
  });

  describe('E. the end-to-end governance bypass this segment exists to measure', () => {
    it('E1: DRAFT SWOT → candidate → accepted Initiative completes with NO freeze and NO approval anywhere in the chain', async () => {
      requireHarness();

      // Step 1 — hand a recommendation off from a session that was never
      // reviewed, never approved and therefore never frozen.
      const handoff = await request(app)
        .post(`/api/tools/${SWOT_SESSION_DRAFT}/swot-candidates`)
        .set('Authorization', bearer(TENANT_A.owner))
        .send(handoffBody('rec-7', 'Bypass chain probe'));
      expect(handoff.status).toBe(201);
      const candidateId = handoff.body?.candidate?.id as string;
      expect(candidateId).toBeTruthy();

      // Step 2 — accept the candidate through the real canonical funnel.
      // `fill:false` skips the F1 card generator, which calls a model and would
      // make this assertion non-deterministic.
      const candidatesRouter = (
        await import('../../../server/src/routes/initiativeCandidates.routes.js')
      ).default;
      const funnel = express();
      funnel.use(express.json());
      funnel.use('/api/initiatives', candidatesRouter);

      const accept = await request(funnel)
        .post(`/api/initiatives/candidates/${candidateId}/accept`)
        .set('Authorization', bearer(TENANT_A.owner))
        .send({ fill: false });

      // Step 3 — read the whole lineage back COLD and assert what governance
      // artefacts exist. The point is not that an Initiative appeared; it is
      // that it appeared while the source tool session is still DRAFT, has
      // no approved_at, and no APPROVE_TOOL decision was ever recorded.
      const proof = await coldRead(async (c) => {
        const session = await c.query(
          `SELECT status, approved_at, context_snapshot FROM tool_sessions WHERE id = $1`,
          [SWOT_SESSION_DRAFT]
        );
        const initiatives = await c.query(
          `SELECT id, source_type FROM initiatives
            WHERE organization_id = $1 AND source_type = 'swot_recommendation'`,
          [TENANT_A.id]
        );
        const toolDecisions = await c.query(
          `SELECT decision_type, status FROM tool_decisions WHERE tool_session_id = $1`,
          [SWOT_SESSION_DRAFT]
        );
        return {
          sessionStatus: session.rows[0]?.status ?? null,
          approvedAt: session.rows[0]?.approved_at ?? null,
          initiativeCount: initiatives.rowCount,
          approveDecisions: toolDecisions.rows.filter(
            (r: any) => String(r.decision_type).toUpperCase() === 'APPROVE_TOOL'
          ).length,
        };
      });

      // MEASURED STATE with the gate at its shipped default (OFF): a registered
      // Initiative exists whose entire provenance is an unapproved SWOT. This
      // is the finding, recorded as an assertion so it cannot regress silently.
      expect({
        acceptStatus: accept.status,
        sessionStatus: proof.sessionStatus,
        approvedAt: proof.approvedAt,
        approveDecisions: proof.approveDecisions,
        initiativeCount: proof.initiativeCount,
      }).toEqual({
        acceptStatus: 200,
        sessionStatus: 'DRAFT',
        approvedAt: null,
        approveDecisions: 0,
        initiativeCount: 1,
      });
    }, 60_000);

    it('E2: with the gate ON the chain cannot even start — no candidate, therefore no Initiative', async () => {
      requireHarness();
      process.env.TOOLS_SWOT_HANDOFF_REQUIRE_APPROVAL = 'true';
      try {
        const handoff = await request(app)
          .post(`/api/tools/${SWOT_SESSION_DRAFT}/swot-candidates`)
          .set('Authorization', bearer(TENANT_A.owner))
          .send(handoffBody('rec-8', 'gate-on bypass probe'));

        const after = await coldRead((c) =>
          c.query(
            `SELECT id FROM initiative_candidates WHERE organization_id = $1 AND source_id = $2`,
            [TENANT_A.id, `${SWOT_SESSION_DRAFT}:rec-8`]
          )
        );
        expect({ handoffStatus: handoff.status, candidateRows: after.rowCount }).toEqual({
          handoffStatus: 409,
          candidateRows: 0,
        });
      } finally {
        delete process.env.TOOLS_SWOT_HANDOFF_REQUIRE_APPROVAL;
      }
    }, 60_000);
  });

  describe('C. tenancy — denial must not leak existence', () => {
    it('C1: tenant B asking for tenant A’s session and for a nonexistent id get the SAME status', async () => {
      requireHarness();
      const foreign = await request(app)
        .post(`/api/tools/${SWOT_SESSION_DRAFT}/swot-candidates`)
        .set('Authorization', bearer(TENANT_B.owner))
        .send(handoffBody('rec-2', 'cross-tenant attempt'));

      const missing = await request(app)
        .post(`/api/tools/${NONEXISTENT_SESSION}/swot-candidates`)
        .set('Authorization', bearer(TENANT_B.owner))
        .send(handoffBody('rec-2', 'nonexistent attempt'));

      expect(foreign.status).toBe(missing.status);
      expect(foreign.status).toBe(404);
      expect(JSON.stringify(foreign.body)).not.toContain(TENANT_A.id);
    });

    it('C2: no candidate row leaked into tenant B from the cross-tenant attempt', async () => {
      requireHarness();
      const rows = await coldRead((c) =>
        c.query(`SELECT id FROM initiative_candidates WHERE organization_id = $1`, [TENANT_B.id])
      );
      expect(rows.rowCount).toBe(0);
    });
  });

  describe('D. idempotency and concurrency with an exact denominator', () => {
    it('D1: the same recommendation handed off twice yields exactly one candidate', async () => {
      requireHarness();
      const first = await request(app)
        .post(`/api/tools/${SWOT_SESSION_DRAFT}/swot-candidates`)
        .set('Authorization', bearer(TENANT_A.owner))
        .send(handoffBody('rec-3', 'idempotency probe'));
      const second = await request(app)
        .post(`/api/tools/${SWOT_SESSION_DRAFT}/swot-candidates`)
        .set('Authorization', bearer(TENANT_A.owner))
        .send(handoffBody('rec-3', 'idempotency probe'));

      const rows = await coldRead((c) =>
        c.query(
          `SELECT id FROM initiative_candidates WHERE organization_id = $1 AND source_id = $2`,
          [TENANT_A.id, `${SWOT_SESSION_DRAFT}:rec-3`]
        )
      );

      // Recorded as a triple so a failure shows WHICH half broke.
      expect({
        firstCreated: first.body?.created,
        secondCreated: second.body?.created,
        candidateRows: rows.rowCount,
      }).toEqual({ firstCreated: true, secondCreated: false, candidateRows: 1 });
    });

    it('D2: 8 concurrent handoffs of one recommendation yield exactly one candidate', async () => {
      requireHarness();
      const ATTEMPTS = 8;
      const race = await raceExactly(ATTEMPTS, () =>
        request(app)
          .post(`/api/tools/${SWOT_SESSION_DRAFT}/swot-candidates`)
          .set('Authorization', bearer(TENANT_A.owner))
          .send(handoffBody('rec-4', 'concurrency probe'))
      );

      const rows = await coldRead((c) =>
        c.query(
          `SELECT id FROM initiative_candidates WHERE organization_id = $1 AND source_id = $2`,
          [TENANT_A.id, `${SWOT_SESSION_DRAFT}:rec-4`]
        )
      );
      const receipts = await coldRead((c) =>
        c.query(
          `SELECT id FROM swot_candidate_handoffs
            WHERE organization_id = $1 AND tool_session_id = $2 AND recommendation_id = 'rec-4'`,
          [TENANT_A.id, SWOT_SESSION_DRAFT]
        )
      );

      const created = race.fulfilled.filter((r: any) => r.status === 201).length;
      const replayed = race.fulfilled.filter((r: any) => r.status === 200).length;
      const failed = race.fulfilled.filter((r: any) => r.status >= 400).length;

      // Exact denominator, not "at least one succeeded".
      expect({
        attempts: race.attempts,
        transportRejected: race.rejected.length,
        created,
        replayed,
        failed,
        candidateRows: rows.rowCount,
        receiptRows: receipts.rowCount,
      }).toEqual({
        attempts: ATTEMPTS,
        transportRejected: 0,
        created: 1,
        replayed: ATTEMPTS - 1,
        failed: 0,
        candidateRows: 1,
        receiptRows: 1,
      });
    }, 60_000);
  });
});
