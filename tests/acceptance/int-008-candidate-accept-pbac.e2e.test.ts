/**
 * INT-08 acceptance: verifies the PRODUCTION PBAC read path for
 * `INITIATIVE_CANDIDATE_MANAGE` — not just the role-fallback branch that
 * tests/acceptance/int-008-candidate-accept-standing-protections.e2e.test.ts
 * already covers.
 *
 * Code-review follow-up (2026-08-02): the prior fix packet wired
 * `INITIATIVE_CANDIDATE_MANAGE` into `FALLBACK_ROLE_PERMISSIONS` in
 * server/src/services/permissionService.ts (ADMIN + PROJECT_MANAGER) but
 * never proved the fallback interacts correctly with the DB-backed layers
 * that sit in front of it: the explicit per-user `org_user_permissions`
 * override (checked FIRST, before any role table or fallback) and the
 * `builtin_role_permissions` role table (checked SECOND, before falling
 * through to the fallback map). This suite proves:
 *
 *   1. An explicit REVOKE override on an ADMIN wins over the role fallback
 *      -> 403, even though ADMIN's fallback entry would otherwise grant it.
 *   2. An explicit GRANT override on a plain USER (no ADMIN/PROJECT_MANAGER
 *      role, so the fallback map contributes nothing) is sufficient on its
 *      own -> 200.
 *   3. The "permission tables are missing / migration not applied" branch
 *      (permissionService.ts catch-block `looksLikeMissingTable` check) is
 *      NOT exercised here — see the "documented limitation" test below for
 *      why that can't be done safely against the shared acceptance
 *      container.
 *   4. The plain "no role, no override -> 403" case is already covered by
 *      int-008-candidate-accept-standing-protections.e2e.test.ts's
 *      'a same-org actor WITHOUT INITIATIVE_CANDIDATE_MANAGE gets 403 and
 *      creates nothing' — intentionally NOT duplicated here.
 *
 * Empirical basis for what "the production PBAC path" actually is (see
 * hasPermission() in server/src/services/permissionService.ts): it queries
 * `org_user_permissions` (override, `fallback: false` so real DB errors
 * reject instead of silently falling through) FIRST, then
 * `builtin_role_permissions` (the role table it actually reads — NOT the
 * differently-shaped `role_permissions` table some other migrations seed),
 * and only falls through to FALLBACK_ROLE_PERMISSIONS when neither produces
 * a row. Confirmed empirically against the live acceptance DB
 * (consultify-int008-pg): `builtin_role_permissions` has ZERO rows for
 * INITIATIVE_CANDIDATE_MANAGE (or for its sibling fallback-only permissions
 * MANAGE_ROLLOUT / INTERVIEW_TEMPLATE_VIEW / INTERVIEW_ASSIGN_MANAGE /
 * INTERVIEW_REMIND / INTERVIEW_INSIGHTS_VIEW / INTERVIEW_INSIGHTS_CREATE) —
 * the fallback map is genuinely the sole live mechanism for this permission,
 * not a stand-in for an unapplied migration. See the accompanying report for
 * the full proof (no new migration was added — see rationale there).
 *
 * Mirrors the harness/style of
 * int-008-candidate-accept-standing-protections.e2e.test.ts: real Express
 * app mounting the actual production router behind the real
 * auth/permission middleware, real local Postgres, reversible `odbior--` id
 * prefix cleaned up in afterAll.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { mintToken, pgClient } from './harness.js';
import { SEED, seed } from './seed.mjs';

const PREFIX = 'odbior--int008pbac--';

const DENY_ADMIN_USER_ID = `${PREFIX}deny-admin`;
const DENY_ADMIN_EMAIL = `${PREFIX}deny-admin@acceptance.local`;
const GRANTED_MEMBER_USER_ID = `${PREFIX}granted-member`;
const GRANTED_MEMBER_EMAIL = `${PREFIX}granted-member@acceptance.local`;

const CAND = {
  revokedAdmin: `${PREFIX}cand-revoked-admin`,
  grantedMember: `${PREFIX}cand-granted-member`,
};

let app: Express;
let denyAdminToken: string; // SEED org, role ADMIN, but explicit org_user_permissions REVOKE override
let grantedMemberToken: string; // SEED org, role USER (no fallback entry), explicit GRANT override

async function insertCandidate(
  client: ReturnType<typeof pgClient>,
  fields: { id: string; orgId: string; title: string }
) {
  await client.query(
    `INSERT INTO initiative_candidates
       (id, organization_id, source_type, source_id, title, rationale, fit_score, status, created_by)
     VALUES ($1, $2, 'manual', NULL, $3, $4, 0.7, 'pending', $5)`,
    [
      fields.id,
      fields.orgId,
      fields.title,
      `PBAC test fixture for ${fields.id}`,
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

    // Actor A: role ADMIN (which, via the fallback map, WOULD get
    // INITIATIVE_CANDIDATE_MANAGE) but with an explicit per-user REVOKE
    // override — must lose to the override.
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'unused', 'ADMIN', 'active', 'DenyAdmin', 'INT008PBAC', $4)
       ON CONFLICT (id) DO NOTHING`,
      [DENY_ADMIN_USER_ID, SEED.ORG_ID, DENY_ADMIN_EMAIL, now]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE', $4) ON CONFLICT (id) DO NOTHING`,
      [`${PREFIX}deny-admin-membership`, SEED.ORG_ID, DENY_ADMIN_USER_ID, now]
    );
    await client.query(
      `INSERT INTO org_user_permissions
         (id, user_id, organization_id, permission_key, grant_type, granted_by, created_at)
       VALUES ($1, $2, $3, 'INITIATIVE_CANDIDATE_MANAGE', 'REVOKE', $4, $5)
       ON CONFLICT (user_id, organization_id, permission_key) DO UPDATE SET
         grant_type = EXCLUDED.grant_type`,
      [`${PREFIX}deny-admin-override`, DENY_ADMIN_USER_ID, SEED.ORG_ID, SEED.USER_ID, now]
    );

    // Actor B: role USER (fallback map contributes NOTHING for USER/
    // TEAM_MEMBER/VIEWER) but with an explicit per-user GRANT override —
    // must be sufficient on its own.
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
       VALUES ($1, $2, $3, 'unused', 'USER', 'active', 'GrantedMember', 'INT008PBAC', $4)
       ON CONFLICT (id) DO NOTHING`,
      [GRANTED_MEMBER_USER_ID, SEED.ORG_ID, GRANTED_MEMBER_EMAIL, now]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status, created_at)
       VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE', $4) ON CONFLICT (id) DO NOTHING`,
      [`${PREFIX}granted-member-membership`, SEED.ORG_ID, GRANTED_MEMBER_USER_ID, now]
    );
    await client.query(
      `INSERT INTO org_user_permissions
         (id, user_id, organization_id, permission_key, grant_type, granted_by, created_at)
       VALUES ($1, $2, $3, 'INITIATIVE_CANDIDATE_MANAGE', 'GRANT', $4, $5)
       ON CONFLICT (user_id, organization_id, permission_key) DO UPDATE SET
         grant_type = EXCLUDED.grant_type`,
      [`${PREFIX}granted-member-override`, GRANTED_MEMBER_USER_ID, SEED.ORG_ID, SEED.USER_ID, now]
    );

    await insertCandidate(client, {
      id: CAND.revokedAdmin,
      orgId: SEED.ORG_ID,
      title: 'Harmonizacja cenników regionalnych dystrybutorów',
    });
    await insertCandidate(client, {
      id: CAND.grantedMember,
      orgId: SEED.ORG_ID,
      title: 'Automatyzacja raportowania zużycia materiałów produkcyjnych',
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

  denyAdminToken = mintToken({ id: DENY_ADMIN_USER_ID, email: DENY_ADMIN_EMAIL, role: 'ADMIN' });
  grantedMemberToken = mintToken({
    id: GRANTED_MEMBER_USER_ID,
    email: GRANTED_MEMBER_EMAIL,
    role: 'USER',
  });
}, 60_000);

afterAll(async () => {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `DELETE FROM initiatives WHERE id IN (
         SELECT initiative_id FROM initiative_candidates
          WHERE id = ANY($1::text[]) AND initiative_id IS NOT NULL
       )`,
      [Object.values(CAND)]
    );
    await client.query(`DELETE FROM initiative_candidates WHERE id = ANY($1::text[])`, [
      Object.values(CAND),
    ]);
    await client.query(`DELETE FROM org_user_permissions WHERE id LIKE $1`, [`${PREFIX}%`]);
    await client.query(`DELETE FROM organization_members WHERE id LIKE $1`, [`${PREFIX}%`]);
    await client.query(`DELETE FROM users WHERE id IN ($1, $2)`, [
      DENY_ADMIN_USER_ID,
      GRANTED_MEMBER_USER_ID,
    ]);
  } finally {
    await client.end();
  }
}, 30_000);

describe('INT-08 — INITIATIVE_CANDIDATE_MANAGE: explicit org_user_permissions override precedence', () => {
  it('an ADMIN with an explicit REVOKE override gets 403 despite the role fallback granting ADMIN this permission', async () => {
    const res = await request(app)
      .post(`/api/initiatives/candidates/${CAND.revokedAdmin}/accept`)
      .set('Authorization', `Bearer ${denyAdminToken}`)
      .send({ fill: false });
    expect(res.status, JSON.stringify(res.body)).toBe(403);
    expect(res.body.code).toBe('PERMISSION_DENIED');

    const client = pgClient();
    await client.connect();
    try {
      const row = await client.query(
        `SELECT status, initiative_id FROM initiative_candidates WHERE id = $1`,
        [CAND.revokedAdmin]
      );
      expect(row.rows[0].status).toBe('pending');
      expect(row.rows[0].initiative_id).toBeNull();
    } finally {
      await client.end();
    }
  });

  it('a plain USER (no ADMIN/PROJECT_MANAGER role, no fallback entry) with an explicit GRANT override gets 200', async () => {
    const res = await request(app)
      .post(`/api/initiatives/candidates/${CAND.grantedMember}/accept`)
      .set('Authorization', `Bearer ${grantedMemberToken}`)
      .send({ fill: false });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.accepted).toBe(true);
    expect(res.body.initiativeId).toBeTruthy();

    const client = pgClient();
    await client.connect();
    try {
      const row = await client.query(
        `SELECT status, initiative_id FROM initiative_candidates WHERE id = $1`,
        [CAND.grantedMember]
      );
      expect(row.rows[0].status).toBe('accepted');
      expect(row.rows[0].initiative_id).toBe(res.body.initiativeId);
    } finally {
      await client.end();
    }
  });
});

describe('INT-08 — INITIATIVE_CANDIDATE_MANAGE: documented test-coverage limitations', () => {
  // Not exercised: the "permission tables are missing / migration not
  // applied" branch of hasPermission()'s catch block
  // (looksLikeMissingTable -> allowFallbackPermission). Proving it would
  // require dropping/renaming `builtin_role_permissions` and/or
  // `org_user_permissions` on `consultify-int008-pg` — a container SHARED
  // with every other acceptance suite (and possibly concurrent runs). Doing
  // that would either corrupt other suites' permission checks mid-run or
  // require a full schema reload afterwards, which is a much larger blast
  // radius than this one permission's coverage justifies. This is the same
  // trade-off CLAUDE.md's "zero residue on shared containers" rule is
  // protecting against. If this branch needs direct coverage, it belongs in
  // a throwaway/ephemeral Postgres instance (own container, own port),
  // never the shared int-008 acceptance DB.
  it.skip('missing permission tables -> narrow fallback only (requires an isolated DB, not the shared acceptance container)', () => {
    // Intentionally skipped — see comment above.
  });
});
