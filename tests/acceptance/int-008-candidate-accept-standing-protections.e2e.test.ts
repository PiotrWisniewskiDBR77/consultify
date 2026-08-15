/**
 * INT-08 acceptance: standing protections on the F2 candidate-inbox mutating
 * endpoints (`server/src/routes/initiativeCandidates.routes.ts`) — the
 * "jawna akceptacja uprawnionego aktora" step of the canonical
 * Interview/finding → Candidate → Initiative golden flow (CLAUDE.md:
 * Interview submission/finding must never create an Initiative directly).
 *
 * Fix packet 2026-08-02: a read-only audit found `POST
 * /api/initiatives/candidates/:id/accept` had ONLY `verifyToken` — any
 * authenticated org member (not just a manager) could accept a pending
 * candidate and mint a real Initiative from it. Fixed by gating
 * scan/accept/dismiss with a new `INITIATIVE_CANDIDATE_MANAGE` permission
 * (server/src/services/permissionService.ts FALLBACK_ROLE_PERMISSIONS —
 * ADMIN + PROJECT_MANAGER). This suite proves the fix AND the other standing
 * protections the golden flow depends on:
 *   1. capability check on accept (403 without, 200 with)
 *   2. actor/org resolved from the session, never from the request body
 *   3. cross-tenant candidate read/write is blocked with 404 (never 403 —
 *      existence must not leak)
 *   4. accept is idempotent — a retried accept never creates a second
 *      Initiative
 *   5. concurrent accepts on the SAME candidate never create two Initiatives
 *      (2026-08-02 concurrency fix in initiativeCandidateService.acceptCandidate
 *      — see its `ACCEPT_CLAIM_POLL_*` comments)
 *   6. a candidate whose inherited project no longer exists never 500s
 *
 * Mirrors the harness/style of tests/acceptance/int-008-negative-controls.e2e.test.ts
 * and int-008-candidate-handoff.e2e.test.ts: real Express app mounting the
 * actual production router behind the real auth/permission middleware, real
 * local Postgres, reversible `odbior--` id prefix cleaned up in afterAll.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--int008accept--';
const FOREIGN_ORG_ID = `${PREFIX}foreign-org`;
const FOREIGN_USER_ID = `${PREFIX}foreign-user`;
const FOREIGN_EMAIL = `${PREFIX}foreign@acceptance.local`;
const NO_PERM_USER_ID = `${PREFIX}no-perm-user`;
const NO_PERM_EMAIL = `${PREFIX}no-perm@acceptance.local`;

const CAND = {
  capabilityDenied: `${PREFIX}cand-cap-denied`,
  capabilityGranted: `${PREFIX}cand-cap-granted`,
  crossTenant: `${PREFIX}cand-cross-tenant`,
  actorOrgSpoof: `${PREFIX}cand-actor-org-spoof`,
  idempotent: `${PREFIX}cand-idempotent`,
  concurrency: `${PREFIX}cand-concurrency`,
  missingProject: `${PREFIX}cand-missing-project`,
};
// Deliberately never inserted anywhere — simulates "the discovery artifact
// this candidate was proposed from (and therefore its inherited project) was
// deleted after the candidate was created." `assessments.project_id` carries
// a real FK to `projects` (ON DELETE CASCADE), so a genuinely dangling
// project_id cannot exist while the assessment row survives — the realistic
// shape of this failure mode IS "the referenced assessment/source is gone",
// which resolveProjectIdFromSource (server/src/services/initiative/
// sourceProjectResolver.ts) already treats as fail-soft-null-project.
const MISSING_PROJECT_ASSESSMENT_ID = `${PREFIX}assessment-does-not-exist`;

let app: Express;
let adminToken: string; // SEED org, role ADMIN -> HAS INITIATIVE_CANDIDATE_MANAGE (fallback map)
let noPermToken: string; // SEED org, role USER -> lacks INITIATIVE_CANDIDATE_MANAGE
let foreignToken: string; // org B, role ADMIN in org B

async function insertCandidate(
  client: ReturnType<typeof pgClient>,
  fields: {
    id: string;
    orgId: string;
    title: string;
    sourceType?: string;
    sourceId?: string | null;
  }
) {
  await client.query(
    `INSERT INTO initiative_candidates
       (id, organization_id, source_type, source_id, title, rationale, fit_score, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, 0.7, 'pending', $7)`,
    [
      fields.id,
      fields.orgId,
      fields.sourceType ?? 'manual',
      fields.sourceId ?? null,
      fields.title,
      `Standing-protections test fixture for ${fields.id}`,
      SEED.USER_ID,
    ]
  );
}

beforeAll(async () => {
  await seed();
  const client = pgClient();
  await client.connect();
  try {
    const now = new Date().toISOString();

    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, $3) ON CONFLICT (id) DO NOTHING`,
      [FOREIGN_ORG_ID, 'INT-08 accept standing-protections foreign org', now]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'unused', 'ADMIN', 'active', 'Foreign', 'INT008ACCEPT', $4)
       ON CONFLICT (id) DO NOTHING`,
      [FOREIGN_USER_ID, FOREIGN_ORG_ID, FOREIGN_EMAIL, now]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'OWNER', 'ACTIVE', $4) ON CONFLICT (id) DO NOTHING`,
      [`${PREFIX}foreign-membership`, FOREIGN_ORG_ID, FOREIGN_USER_ID, now]
    );

    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'unused', 'USER', 'active', 'NoPerm', 'INT008ACCEPT', $4)
       ON CONFLICT (id) DO NOTHING`,
      [NO_PERM_USER_ID, SEED.ORG_ID, NO_PERM_EMAIL, now]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE', $4) ON CONFLICT (id) DO NOTHING`,
      [`${PREFIX}no-perm-membership`, SEED.ORG_ID, NO_PERM_USER_ID, now]
    );

    // Fixture candidates — each with a completely UNRELATED topic title (no
    // shared significant words, and deliberately NOT embedding the shared
    // `${PREFIX}` string, which the service's title-similarity de-dup would
    // otherwise treat as one large shared "word" and falsely match fixtures
    // against each other via findDuplicateInitiative/titleSimilarity).
    await insertCandidate(client, {
      id: CAND.capabilityDenied,
      orgId: SEED.ORG_ID,
      title: 'Redukcja czasu dostawy zamówień magazynowych',
    });
    await insertCandidate(client, {
      id: CAND.capabilityGranted,
      orgId: SEED.ORG_ID,
      title: 'Konsolidacja licencji oprogramowania księgowego',
    });
    await insertCandidate(client, {
      id: CAND.crossTenant,
      orgId: SEED.ORG_ID,
      title: 'Wdrożenie portalu samoobsługowego dla klientów B2B',
    });
    await insertCandidate(client, {
      id: CAND.actorOrgSpoof,
      orgId: SEED.ORG_ID,
      title: 'Migracja archiwum dokumentów papierowych do skanów',
    });
    await insertCandidate(client, {
      id: CAND.idempotent,
      orgId: SEED.ORG_ID,
      title: 'Standaryzacja procesu rekrutacji pracowników sezonowych',
    });
    await insertCandidate(client, {
      id: CAND.concurrency,
      orgId: SEED.ORG_ID,
      title: 'Optymalizacja tras dostaw floty serwisowej',
    });

    // Missing-project fixture: candidate whose source (an `assessment` row)
    // was deleted/never existed — resolveProjectIdFromSource's lookup finds
    // no row and degrades to null; acceptCandidate must not 500 on it.
    await insertCandidate(client, {
      id: CAND.missingProject,
      orgId: SEED.ORG_ID,
      title: 'Centralizacja zamówień części zamiennych serwisu',
      sourceType: 'assessment',
      sourceId: MISSING_PROJECT_ASSESSMENT_ID,
    });
  } finally {
    await client.end();
  }

  const initiativeCandidatesRouter = (
    await import('../../server/src/routes/initiativeCandidates.routes.js')
  ).default;

  app = express();
  app.use(express.json());
  app.use('/api/initiatives', initiativeCandidatesRouter);

  adminToken = mintToken({ role: 'ADMIN' });
  noPermToken = mintToken({ id: NO_PERM_USER_ID, email: NO_PERM_EMAIL, role: 'USER' });
  foreignToken = mintToken({
    id: FOREIGN_USER_ID,
    email: FOREIGN_EMAIL,
    organizationId: FOREIGN_ORG_ID,
    organization_id: FOREIGN_ORG_ID,
    role: 'ADMIN',
  });
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    // Delete Initiatives created FROM these candidates (via initiative_id
    // back-reference, and via source_id for the assessment-sourced one)
    // before the candidates/assessment/org rows they reference.
    await client.query(
      `DELETE FROM initiatives WHERE id IN (
         SELECT initiative_id FROM initiative_candidates
          WHERE id = ANY($1::text[]) AND initiative_id IS NOT NULL
       )`,
      [Object.values(CAND)]
    );
    await client.query(`DELETE FROM initiatives WHERE source_id = $1`, [
      MISSING_PROJECT_ASSESSMENT_ID,
    ]);
    await client.query(`DELETE FROM initiative_candidates WHERE id = ANY($1::text[])`, [
      Object.values(CAND),
    ]);
    await client.query('DELETE FROM organization_members WHERE id LIKE $1', [`${PREFIX}%`]);
    // A DB trigger backfills organizations.owner_id from the first OWNER
    // membership, so FOREIGN_ORG_ID <-> FOREIGN_USER_ID form a two-way FK
    // cycle (organizations.owner_id -> users, users.organization_id ->
    // organizations). Break it by nulling owner_id first, then users, then
    // the org row.
    await client.query('UPDATE organizations SET owner_id = NULL WHERE id = $1', [
      FOREIGN_ORG_ID,
    ]);
    await client.query('DELETE FROM users WHERE id IN ($1, $2)', [
      FOREIGN_USER_ID,
      NO_PERM_USER_ID,
    ]);
    await client.query('DELETE FROM organizations WHERE id = $1', [FOREIGN_ORG_ID]);
  } finally {
    await client.end();
  }
}, 30_000);

describe('INT-08 — initiative-candidate accept: capability gate', () => {
  it('a same-org actor WITHOUT INITIATIVE_CANDIDATE_MANAGE gets 403 and creates nothing', async () => {
    const res = await request(app)
      .post(`/api/initiatives/candidates/${CAND.capabilityDenied}/accept`)
      .set('Authorization', `Bearer ${noPermToken}`)
      .send({ fill: false });
    expect(res.status, JSON.stringify(res.body)).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');

    const client = pgClient();
    await client.connect();
    try {
      const row = await client.query(
        `SELECT status, initiative_id FROM initiative_candidates WHERE id = $1`,
        [CAND.capabilityDenied]
      );
      expect(row.rows[0].status).toBe('pending');
      expect(row.rows[0].initiative_id).toBeNull();
    } finally {
      await client.end();
    }
  });

  it('a same-org actor WITHOUT INITIATIVE_CANDIDATE_MANAGE also cannot dismiss', async () => {
    const res = await request(app)
      .post(`/api/initiatives/candidates/${CAND.capabilityDenied}/dismiss`)
      .set('Authorization', `Bearer ${noPermToken}`)
      .send({});
    expect(res.status, JSON.stringify(res.body)).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');
  });

  it('an ADMIN (has INITIATIVE_CANDIDATE_MANAGE via the role fallback) gets 200 and the candidate becomes accepted', async () => {
    const res = await request(app)
      .post(`/api/initiatives/candidates/${CAND.capabilityGranted}/accept`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fill: false });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.accepted).toBe(true);
    expect(res.body.initiativeId).toBeTruthy();

    const client = pgClient();
    await client.connect();
    try {
      const row = await client.query(
        `SELECT status, initiative_id FROM initiative_candidates WHERE id = $1`,
        [CAND.capabilityGranted]
      );
      expect(row.rows[0].status).toBe('accepted');
      expect(row.rows[0].initiative_id).toBe(res.body.initiativeId);
    } finally {
      await client.end();
    }
  });
});

describe('INT-08 — initiative-candidate accept: tenant isolation', () => {
  it('cross-org accept returns 404, never 403, and creates nothing', async () => {
    const res = await request(app)
      .post(`/api/initiatives/candidates/${CAND.crossTenant}/accept`)
      .set('Authorization', `Bearer ${foreignToken}`)
      .send({ fill: false });
    expect(res.status, JSON.stringify(res.body)).toBe(404);
    expect(res.status).not.toBe(403);

    const client = pgClient();
    await client.connect();
    try {
      const row = await client.query(
        `SELECT status, initiative_id FROM initiative_candidates WHERE id = $1`,
        [CAND.crossTenant]
      );
      expect(row.rows[0].status).toBe('pending');
      expect(row.rows[0].initiative_id).toBeNull();
    } finally {
      await client.end();
    }
  });

  it('cross-org dismiss returns 404, never 403, and leaves the candidate pending', async () => {
    const res = await request(app)
      .post(`/api/initiatives/candidates/${CAND.crossTenant}/dismiss`)
      .set('Authorization', `Bearer ${foreignToken}`)
      .send({});
    expect(res.status, JSON.stringify(res.body)).toBe(404);
    expect(res.status).not.toBe(403);
  });

  it('cross-org list never returns the other org\'s pending candidates', async () => {
    const res = await request(app)
      .get(`/api/initiatives/candidates?status=pending`)
      .set('Authorization', `Bearer ${foreignToken}`);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const ids = (res.body.candidates || []).map((c: { id: string }) => c.id);
    expect(ids).not.toContain(CAND.crossTenant);
  });
});

describe('INT-08 — initiative-candidate accept: actor/org come from the session, not the request body', () => {
  it('a forged organizationId/actorId in the body is ignored — org resolves from the token, actor from the session', async () => {
    const res = await request(app)
      .post(`/api/initiatives/candidates/${CAND.actorOrgSpoof}/accept`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fill: false,
        organizationId: 'odbior--org-does-not-exist-spoofed',
        actorId: 'spoofed-actor-id-not-the-real-session-user',
      });
    // Succeeds against the REAL session org's own candidate — a body-driven
    // org override would either 404 (wrong org) or silently misattribute
    // ownership; neither happens.
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.initiativeId).toBeTruthy();

    const client = pgClient();
    await client.connect();
    try {
      const row = await client.query(`SELECT created_by, organization_id FROM initiatives WHERE id = $1`, [
        res.body.initiativeId,
      ]);
      expect(row.rows).toHaveLength(1);
      // Real session org (SEED.ORG_ID), never the spoofed one.
      expect(row.rows[0].organization_id).toBe(SEED.ORG_ID);
      // Real session actor (SEED.USER_ID, the ADMIN token's id), never the
      // spoofed actorId from the body.
      expect(row.rows[0].created_by).toBe(SEED.USER_ID);
      expect(row.rows[0].created_by).not.toBe('spoofed-actor-id-not-the-real-session-user');
    } finally {
      await client.end();
    }
  });
});

describe('INT-08 — initiative-candidate accept: idempotency and concurrency', () => {
  it('a retried accept on an already-accepted candidate is idempotent — no second Initiative', async () => {
    const first = await request(app)
      .post(`/api/initiatives/candidates/${CAND.idempotent}/accept`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fill: false });
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    const initiativeId = first.body.initiativeId;
    expect(initiativeId).toBeTruthy();

    const second = await request(app)
      .post(`/api/initiatives/candidates/${CAND.idempotent}/accept`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fill: false });
    expect(second.status, JSON.stringify(second.body)).toBe(200);
    expect(second.body.initiativeId).toBe(initiativeId);

    const client = pgClient();
    await client.connect();
    try {
      const count = await client.query(
        `SELECT count(*)::int AS n FROM initiatives WHERE id = $1`,
        [initiativeId]
      );
      expect(count.rows[0].n).toBe(1);
      // No OTHER initiative carries this candidate's distinctive title either.
      const byTitle = await client.query(
        `SELECT count(*)::int AS n FROM initiatives WHERE organization_id = $1 AND title = $2`,
        [SEED.ORG_ID, 'Standaryzacja procesu rekrutacji pracowników sezonowych']
      );
      expect(byTitle.rows[0].n).toBe(1);
    } finally {
      await client.end();
    }
  });

  it('two CONCURRENT accept calls on the same pending candidate never create two Initiatives', async () => {
    const [r1, r2] = await Promise.all([
      request(app)
        .post(`/api/initiatives/candidates/${CAND.concurrency}/accept`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ fill: false }),
      request(app)
        .post(`/api/initiatives/candidates/${CAND.concurrency}/accept`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ fill: false }),
    ]);

    expect(r1.status, JSON.stringify(r1.body)).toBe(200);
    expect(r2.status, JSON.stringify(r2.body)).toBe(200);
    expect(r1.body.initiativeId).toBeTruthy();
    expect(r2.body.initiativeId).toBeTruthy();
    expect(r1.body.initiativeId).toBe(r2.body.initiativeId);

    const client = pgClient();
    await client.connect();
    try {
      const byTitle = await client.query(
        `SELECT count(*)::int AS n FROM initiatives WHERE organization_id = $1 AND title = $2`,
        [SEED.ORG_ID, 'Optymalizacja tras dostaw floty serwisowej']
      );
      expect(byTitle.rows[0].n).toBe(1);

      const candidateRow = await client.query(
        `SELECT initiative_id FROM initiative_candidates WHERE id = $1`,
        [CAND.concurrency]
      );
      expect(candidateRow.rows[0].initiative_id).toBe(r1.body.initiativeId);
    } finally {
      await client.end();
    }
  }, 20_000);
});

describe('INT-08 — initiative-candidate accept: missing/deleted project never 500s', () => {
  it('accepting a candidate whose inherited project no longer exists degrades gracefully (never 5xx)', async () => {
    const res = await request(app)
      .post(`/api/initiatives/candidates/${CAND.missingProject}/accept`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fill: false });

    expect(res.status, JSON.stringify(res.body)).toBeLessThan(500);
  });
});
