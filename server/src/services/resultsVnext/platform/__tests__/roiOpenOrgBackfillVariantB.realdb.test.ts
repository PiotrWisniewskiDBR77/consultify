/**
 * AMD-FLOW-ROI-VISIBILITY-002, Variant B — the OPEN_ORG backfill gap, against
 * a REAL Postgres.
 *
 * RESOLVER-PATH PROOF, NOT A ROUTE TEST: every call in this file goes
 * straight to `listRoiCases`/`getRoiCase`/`createRoiCase`/
 * `publishRoiGovernedVisibilityPolicy` — no Express app, no `verifyToken`,
 * no `requireOrgAccess` middleware is instantiated anywhere in this file.
 * This is deliberate: `requireOrgAccess` (rbac.middleware.ts:211) only
 * validates the SHAPE of the organizationId claim (length, characters,
 * delimiters) — it has zero references to `organization_members` or
 * `ACTIVE` status, and per CTO decision 5 that weakness is a separate,
 * program-backlog finding this packet does not depend on for
 * authorization. The governed resolver (`resolveRoiGovernedVisibility`,
 * consumed transitively by every call below) must hold even if every
 * middleware above it were removed entirely — this file proves that by
 * never invoking any middleware in the first place.
 *
 * THE GAP (found by the parallel read-surface audit, closure-b F2 fan-in):
 * 20261021_rvn_platform_visibility_roi_governed_mode.sql adds the governed
 * mode and its enforcement, but ONLY for resources whose
 * `rvn_platform_resource_visibility.visibility_mode` already literally
 * reads 'ROI_GOVERNED'. A `roi_case` row created BEFORE this packet still
 * carries whatever mode existed then — historically 'OPEN_ORG', which has
 * NO membership/ACTIVE check at all (any caller whose JWT carries the
 * resource's organizationId sees it). Without a backfill, "the governed
 * policy is the real authority" is true only for brand-new cases.
 *
 * 20261022_backfill_roi_case_open_org_to_governed.sql closes this. This
 * file proves the closure end-to-end: seed a row exactly the way a
 * pre-packet `createRoiCase` call would have (OPEN_ORG), run the backfill,
 * then prove the READ-SIDE consequence through the real production
 * functions (`listRoiCases`/`getRoiCase`), not just the raw column value.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function buildClientConfig(): ClientConfig | null {
  const raw = process.env.DATABASE_URL;
  const url = typeof raw === 'string' && raw.trim() && !raw.includes('${{') ? raw.trim() : null;
  if (url) {
    return { connectionString: url, connectionTimeoutMillis: 5_000, statement_timeout: 30_000 };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: 5_000,
    statement_timeout: 30_000,
  };
}

const DB_CONFIGURED = buildClientConfig() !== null;

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `roi-backfill-org-${tag}`;
const INITIATIVE_ID = `roi-backfill-init-${tag}`;
const CASE_ID = randomUUID();
const USER_OWNER = `roi-backfill-owner-${tag}`;
const USER_ADMIN = `roi-backfill-admin-${tag}`;
const USER_FINANCE_GRANTEE = `roi-backfill-financegrantee-${tag}`;
const USER_MEMBER = `roi-backfill-member-${tag}`;
const USER_REVOKED = `roi-backfill-revoked-${tag}`;
const USER_UNMEMBERED = `roi-backfill-unmembered-${tag}`;
const FOREIGN_ORG_ID = `roi-backfill-foreign-org-${tag}`;
const USER_FOREIGN_TENANT = `roi-backfill-foreign-admin-${tag}`;

type VisibilityResolverModule =
  typeof import('../../../../services/resultsVnext/platform/visibilityResolver.js');
type RoiRepositoryModule = typeof import('../../../../services/resultsVnext/roi/roiRepository.js');
type RoiCaseCommandsModule = typeof import('../../../../services/resultsVnext/roi/roiCaseCommands.js');

let publishRoiGovernedVisibilityPolicy: VisibilityResolverModule['publishRoiGovernedVisibilityPolicy'];
let ROI_GOVERNED_VISIBILITY_POLICY: VisibilityResolverModule['ROI_GOVERNED_VISIBILITY_POLICY'];
let listRoiCases: RoiRepositoryModule['listRoiCases'];
let getRoiCase: RoiRepositoryModule['getRoiCase'];
let createRoiCase: RoiCaseCommandsModule['createRoiCase'];
let RoiCaseCreationNotAuthorizedError: RoiCaseCommandsModule['RoiCaseCreationNotAuthorizedError'];

let client: Client;
let reachable = false;
let legacyPolicyId: string;
let controlKpiPolicyId: string;

async function insertUserAndMembership(userId: string, role: string, status = 'ACTIVE'): Promise<void> {
  await client.query(
    `INSERT INTO users (id, email, organization_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
    [userId, `${userId}@roi-backfill.local`, ORG_ID]
  );
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status`,
    [`${userId}-membership`, ORG_ID, userId, role, status]
  );
}

async function runBackfillMigration(): Promise<void> {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const sql = fs.readFileSync(
    path.resolve(process.cwd(), 'server/migrations/20261022_backfill_roi_case_open_org_to_governed.sql'),
    'utf8'
  );
  await client.query(sql);
}

describe('AMD-FLOW-ROI-VISIBILITY-002 Variant B — OPEN_ORG backfill (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — roiOpenOrgBackfillVariantB realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_platform_resource_visibility LIMIT 0');
      const checkPermits = await client.query<{ ok: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM pg_constraint
            WHERE conrelid = 'rvn_platform_visibility_policies'::regclass
              AND contype = 'c'
              AND pg_get_constraintdef(oid) LIKE '%ROI_GOVERNED%'
         ) ok`
      );
      if (!checkPermits.rows[0]?.ok) {
        throw new Error(
          '20261021_rvn_platform_visibility_roi_governed_mode.sql has not run against this database — apply it before this suite'
        );
      }
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable, or is missing the ROI_GOVERNED migration; refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const visMod: VisibilityResolverModule = await import(
      '../../../../services/resultsVnext/platform/visibilityResolver.js'
    );
    publishRoiGovernedVisibilityPolicy = visMod.publishRoiGovernedVisibilityPolicy;
    ROI_GOVERNED_VISIBILITY_POLICY = visMod.ROI_GOVERNED_VISIBILITY_POLICY;
    const repoMod: RoiRepositoryModule = await import('../../../../services/resultsVnext/roi/roiRepository.js');
    listRoiCases = repoMod.listRoiCases;
    getRoiCase = repoMod.getRoiCase;
    const caseMod: RoiCaseCommandsModule = await import('../../../../services/resultsVnext/roi/roiCaseCommands.js');
    createRoiCase = caseMod.createRoiCase;
    RoiCaseCreationNotAuthorizedError = caseMod.RoiCaseCreationNotAuthorizedError;

    await client.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'ROI Backfill RealDB Org', 'enterprise', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [ORG_ID]
    );
    await client.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'ROI Backfill Foreign RealDB Org', 'enterprise', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [FOREIGN_ORG_ID]
    );
    await client.query(
      `INSERT INTO users (id, email, organization_id) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      [USER_FOREIGN_TENANT, `${USER_FOREIGN_TENANT}@roi-backfill.local`, FOREIGN_ORG_ID]
    );
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status) VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE')`,
      [`${USER_FOREIGN_TENANT}-membership`, FOREIGN_ORG_ID, USER_FOREIGN_TENANT]
    );
    await insertUserAndMembership(USER_OWNER, 'OWNER');
    await insertUserAndMembership(USER_ADMIN, 'ADMIN');
    await insertUserAndMembership(USER_FINANCE_GRANTEE, 'MEMBER');
    await insertUserAndMembership(USER_MEMBER, 'MEMBER');
    await insertUserAndMembership(USER_REVOKED, 'ADMIN', 'REVOKED');
    // USER_UNMEMBERED deliberately gets NO organization_members row.

    await client.query(
      `INSERT INTO rvn_finance_reconciliation_grant_events
         (organization_id, user_id, capability, grant_version, action, acted_by, policy_version, policy_digest)
       VALUES ($1,$2,$3,1,'granted',$4,'DEC-FIN-RESULTS-RECONCILIATION-001/v1',
               'sha256:a0b04a2bcd42d9fa8a2680f0dd35008f4226bc92db5ecc63756732d7a8854e6d')`,
      [ORG_ID, USER_FINANCE_GRANTEE, 'results.roi.finance_reconciliation.resolve', USER_OWNER]
    );

    // Seed a PRE-EXISTING roi_case exactly the way a pre-packet createRoiCase
    // call would have: an active domain='roi' policy row with the OLD
    // OPEN_ORG mode, a case, and its resource_visibility row stamped
    // OPEN_ORG from that policy — never touching the NEW governed path.
    const legacyPolicy = await client.query<{ policy_id: string }>(
      `INSERT INTO rvn_platform_visibility_policies (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
       VALUES ($1, 'roi', 1, 'OPEN_ORG', true, $2) RETURNING policy_id`,
      [ORG_ID, USER_OWNER]
    );
    legacyPolicyId = legacyPolicy.rows[0]!.policy_id;

    await client.query(
      `INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, $4)`,
      [INITIATIVE_ID, ORG_ID, 'Backfill fixture initiative', 'EXECUTING']
    );
    await client.query(
      `INSERT INTO rvn_roi_cases (case_id, organization_id, initiative_id, title, owner_user_id, currency, created_by)
       VALUES ($1, $2, $3, $4, $5, 'USD', $5)`,
      [CASE_ID, ORG_ID, INITIATIVE_ID, 'Pre-existing legacy case', USER_OWNER]
    );
    await client.query(
      `INSERT INTO rvn_platform_resource_visibility
         (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
       VALUES ('roi_case', $1, $2, 'OPEN_ORG', $3, $4)`,
      [CASE_ID, ORG_ID, legacyPolicyId, USER_OWNER]
    );

    // Control row: an UNRELATED resource_type also stamped OPEN_ORG, to
    // prove the backfill's WHERE clause is scoped and never touches it.
    const controlKpiPolicy = await client.query<{ policy_id: string }>(
      `INSERT INTO rvn_platform_visibility_policies (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
       VALUES ($1, 'kpi', 1, 'OPEN_ORG', true, $2) RETURNING policy_id`,
      [ORG_ID, USER_OWNER]
    );
    controlKpiPolicyId = controlKpiPolicy.rows[0]!.policy_id;
    await client.query(
      `INSERT INTO rvn_platform_resource_visibility (resource_type, resource_id, organization_id, visibility_mode, policy_id)
       VALUES ('kpi', $1, $2, 'OPEN_ORG', $3)`,
      [`control-kpi-${tag}`, ORG_ID, controlKpiPolicyId]
    );
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM users WHERE organization_id = $1`, [ORG_ID]);
    // rvn_finance_reconciliation_grant_events and organizations are left in
    // place, on purpose — append-only ledger residue, same measured,
    // permanent-by-design shape roiGovernedVisibility20.realdb.test.ts
    // already documents; not re-asserted here to avoid duplicating that
    // proof.
    await client.end();
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 30_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  itDB('BEFORE the backfill: the legacy case is stamped OPEN_ORG, exactly as a pre-packet createRoiCase left it', async () => {
    const row = await client.query<{ visibility_mode: string }>(
      `SELECT visibility_mode FROM rvn_platform_resource_visibility WHERE resource_type='roi_case' AND resource_id=$1`,
      [CASE_ID]
    );
    expect(row.rows[0]?.visibility_mode).toBe('OPEN_ORG');
  });

  itDB(
    'BEFORE the backfill: an ordinary member with no grant can see the legacy case — proving the gap is real, not assumed',
    async () => {
      const detail = await getRoiCase({ userId: USER_MEMBER, organizationId: ORG_ID, caseId: CASE_ID, includeArchived: true });
      expect(detail?.caseId).toBe(CASE_ID);
      const list = await listRoiCases({ userId: USER_MEMBER, organizationId: ORG_ID });
      expect(list.some((c) => c.caseId === CASE_ID)).toBe(true);
    }
  );

  itDB('running the backfill migration: scoped correctly, idempotent on repeat', async () => {
    await runBackfillMigration();
    const roiRow = await client.query<{ visibility_mode: string }>(
      `SELECT visibility_mode FROM rvn_platform_resource_visibility WHERE resource_type='roi_case' AND resource_id=$1`,
      [CASE_ID]
    );
    expect(roiRow.rows[0]?.visibility_mode).toBe('ROI_GOVERNED');

    const controlRow = await client.query<{ visibility_mode: string }>(
      `SELECT visibility_mode FROM rvn_platform_resource_visibility WHERE resource_type='kpi' AND resource_id=$1`,
      [`control-kpi-${tag}`]
    );
    expect(controlRow.rows[0]?.visibility_mode).toBe('OPEN_ORG');

    // Repeat: idempotent, no error, identical result.
    await runBackfillMigration();
    const roiRowAgain = await client.query<{ visibility_mode: string }>(
      `SELECT visibility_mode FROM rvn_platform_resource_visibility WHERE resource_type='roi_case' AND resource_id=$1`,
      [CASE_ID]
    );
    expect(roiRowAgain.rows[0]?.visibility_mode).toBe('ROI_GOVERNED');
  });

  itDB(
    'AFTER the backfill: the gap is closed — an ordinary member with no grant, a revoked member, an unmembered caller, and an ACTIVE ADMIN of a DIFFERENT (foreign) tenant are ALL denied the exact same case that was visible before — no existence leak (null/empty, never an error)',
    async () => {
      for (const userId of [USER_MEMBER, USER_REVOKED, USER_UNMEMBERED, USER_FOREIGN_TENANT]) {
        const detail = await getRoiCase({ userId, organizationId: ORG_ID, caseId: CASE_ID, includeArchived: true });
        expect(detail).toBeNull();
        const list = await listRoiCases({ userId, organizationId: ORG_ID });
        expect(list.some((c) => c.caseId === CASE_ID)).toBe(false);
      }
    }
  );

  itDB(
    'AFTER the backfill: same-tenant ACTIVE OWNER, ADMIN, and a current Finance-authority-grant holder all still see the legacy case — but ONLY once the governed policy is actually published for this org (fail-closed until then)',
    async () => {
      const beforePublish = await getRoiCase({ userId: USER_OWNER, organizationId: ORG_ID, caseId: CASE_ID, includeArchived: true });
      expect(beforePublish).toBeNull();

      const publish = await publishRoiGovernedVisibilityPolicy({
        organizationId: ORG_ID,
        actorUserId: USER_OWNER,
        policyKey: ROI_GOVERNED_VISIBILITY_POLICY.key,
        policyDigest: ROI_GOVERNED_VISIBILITY_POLICY.digest,
        idempotencyKey: `roi-backfill-publish-${tag}`,
      });
      expect(publish.outcome).toBe('applied');

      for (const userId of [USER_OWNER, USER_ADMIN, USER_FINANCE_GRANTEE]) {
        const detail = await getRoiCase({ userId, organizationId: ORG_ID, caseId: CASE_ID, includeArchived: true });
        expect(detail?.caseId).toBe(CASE_ID);
        const list = await listRoiCases({ userId, organizationId: ORG_ID });
        expect(list.some((c) => c.caseId === CASE_ID)).toBe(true);
      }
    }
  );

  itDB('createRoiCase: a denied actor (including a foreign-tenant ADMIN) produces a ZERO-WRITE delta, measured before and after — the resolver-path gate holds with no route/middleware in the call chain at all', async () => {
    const countBefore = await client.query<{ n: string }>(
      `SELECT count(*)::text n FROM rvn_roi_cases WHERE organization_id = $1`,
      [ORG_ID]
    );
    for (const userId of [USER_MEMBER, USER_REVOKED, USER_UNMEMBERED, USER_FOREIGN_TENANT]) {
      await expect(
        createRoiCase({
          organizationId: ORG_ID,
          initiativeId: INITIATIVE_ID,
          title: `Should not be created by ${userId}`,
          ownerUserId: userId,
          currency: 'USD',
          createdBy: userId,
          actorEffectiveRole: 'member',
          idempotencyKey: `roi-backfill-deny-${userId}-${tag}`,
        })
      ).rejects.toBeInstanceOf(RoiCaseCreationNotAuthorizedError);
    }
    const countAfter = await client.query<{ n: string }>(
      `SELECT count(*)::text n FROM rvn_roi_cases WHERE organization_id = $1`,
      [ORG_ID]
    );
    expect(countAfter.rows[0]?.n).toBe(countBefore.rows[0]?.n);
  });

  itDB('createRoiCase: a real OWNER succeeds and the new case is stamped ROI_GOVERNED (never OPEN_ORG)', async () => {
    const newInitiativeId = `${INITIATIVE_ID}-2`;
    await client.query(`INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, $4)`, [
      newInitiativeId,
      ORG_ID,
      'Second backfill fixture initiative',
      'EXECUTING',
    ]);
    const outcome = await createRoiCase({
      organizationId: ORG_ID,
      initiativeId: newInitiativeId,
      title: 'New case created by a real OWNER',
      ownerUserId: USER_OWNER,
      currency: 'USD',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'owner',
      idempotencyKey: `roi-backfill-owner-create-${tag}`,
    });
    expect(outcome.outcome).toBe('applied');
    const stamped = await client.query<{ visibility_mode: string }>(
      `SELECT visibility_mode FROM rvn_platform_resource_visibility WHERE resource_type='roi_case' AND resource_id=$1`,
      [outcome.result.case.caseId]
    );
    expect(stamped.rows[0]?.visibility_mode).toBe('ROI_GOVERNED');
  });
});
