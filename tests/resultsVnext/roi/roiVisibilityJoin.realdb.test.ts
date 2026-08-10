/**
 * ROI-E001 — visibility-join regression, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E001_DESIGN.md §5: "every join must
 * cast `::text` on the UUID side (`vr.resource_id = rc.case_id::text`) —
 * this exact cast was missed in 7 places across 3 files in the KPI domain
 * and only caught by a dedicated realDB join-regression test after the
 * fact (EXECUTION_LEDGER §24) — write `roiVisibilityJoin.realdb.test.ts`
 * (§8) before, not after, shipping this."
 *
 * Proves `listRoiCases`/`getRoiCase`/`getRoiBaseline` (`roiRepository.ts`)
 * actually execute their `rc.case_id::text` / `rb.case_id::text` joins
 * against real rows (Postgres 42883 "operator does not exist: text = uuid"
 * would fire on the first visible row otherwise) AND that RESTRICTED_ACL
 * visibility is enforced correctly: the ACL-granted owner sees the case (and
 * its baseline, which inherits visibility via case_id, per design §5), a
 * non-granted outsider does not.
 *
 * SKIP POLICY (same convention as every other `*.realdb.test.ts` in this
 * program): if no database is configured (no DATABASE_URL/DB_HOST), every
 * scenario below is a silent no-op and this file reports green — that is
 * NOT evidence the behavior works. If a database IS configured but
 * unreachable, `beforeAll` throws so this run is never silently green.
 *
 * HOW TO RUN FOR REAL: point DATABASE_URL (or DB_HOST/DB_PORT/DB_NAME/
 * DB_USER/DB_PASSWORD) at a Postgres 16/17 that already has the full
 * `rvn_platform_*` schema plus `server/migrations/20260815_rvn_roi_core.sql`
 * applied, and a minimal `initiatives(id TEXT PRIMARY KEY, organization_id
 * TEXT, name TEXT)` fixture table (same stand-in
 * `initiativeKpiImpactBaselineFreeze.realdb.test.ts` uses — the real
 * `initiatives` table lives in the legacy core baseline migration, out of
 * this program's migration chain) — env vars are read once, at
 * `server/src/config/DatabaseConfig.ts`'s module-load time.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ensureRoiFixtureOrganization } from './roiRealdbOrgFixture.js';

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
const ORG_ID = `roi-vis-join-it-org-${tag}`;
const USER_A = `roi-vis-join-it-grantee-${tag}`; // ACL-granted on the case
const USER_B = `roi-vis-join-it-outsider-${tag}`; // no ACL grant, no RBAC override
const INITIATIVE_ID = `roi-vis-join-it-initiative-${tag}`;

let client: Client;
let reachable = false;

type RepositoryModule = typeof import('../../../server/src/services/resultsVnext/roi/roiRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let listRoiCases: RepositoryModule['listRoiCases'];
let getRoiCase: RepositoryModule['getRoiCase'];
let getRoiBaseline: RepositoryModule['getRoiBaseline'];
let closePgPool: (() => Promise<void>) | undefined;

let policyId: string;

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<string> {
  const result = await client.query<{ policy_id: string }>(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)
     RETURNING policy_id`,
    [ORG_ID, domain, mode, createdBy]
  );
  return result.rows[0]!.policy_id;
}

/** Each fixture case needs its OWN initiative — `ux_rvn_roi_cases_one_active_per_initiative`
 * allows only one non-cancelled/closed case per (organization_id,
 * initiative_id), and this file's `it` blocks each create at least one
 * fixture case, so a single shared `INITIATIVE_ID` across blocks would
 * collide on the second block with a real 23505. */
async function insertFixtureInitiative(initiativeId: string): Promise<void> {
  await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
    initiativeId,
    ORG_ID,
    'Visibility-join fixture initiative',
  ]);
}

async function insertFixtureCase(caseId: string, initiativeId: string, ownerUserId: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_roi_cases (case_id, organization_id, initiative_id, title, owner_user_id, currency, created_by)
     VALUES ($1, $2, $3, 'IT fixture case', $4, 'USD', $4)`,
    [caseId, ORG_ID, initiativeId, ownerUserId]
  );
  await client.query(
    `INSERT INTO rvn_roi_baselines (case_id, organization_id, created_by)
     VALUES ($1, $2, $3)`,
    [caseId, ORG_ID, ownerUserId]
  );
}

async function insertCaseVisibility(caseId: string, ownerUserId: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_resource_visibility
       (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
     VALUES ('roi_case', $1, $2, 'RESTRICTED_ACL', $3, $4)`,
    [caseId, ORG_ID, policyId, ownerUserId]
  );
}

/** `rvn_platform_resource_acl` (server/migrations/20260809_rvn_platform_visibility_core.sql)
 * has NO `organization_id` column — PRIMARY KEY is
 * `(resource_type, resource_id, grantee_type, grantee_id)` — same real bug
 * `roiCaseCommands.ts`'s own ACL INSERT hit first (see that file's
 * "DEVIATION FROM AN EARLIER DRAFT" comment). */
async function grantAcl(caseId: string, granteeUserId: string, grantedBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_resource_acl
       (resource_type, resource_id, grantee_type, grantee_id, access_level, granted_by)
     VALUES ('roi_case', $1, 'user', $2, 'contribute', $3)`,
    [caseId, granteeUserId, grantedBy]
  );
}

describe('ROI visibility-join regression — TEXT/UUID cast forces real join execution (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — ROI visibility-join regression tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_cases LIMIT 0');
      await client.query('SELECT 1 FROM rvn_roi_baselines LIMIT 0');
      // buildVisibilityScopedCte's SCOPE branch (visibilityScopedQuery.ts)
      // unconditionally references `team_members` regardless of which
      // visibility_mode this file's fixtures actually use — the query fails
      // to PARSE without the table existing. Same minimal stand-in every
      // other realdb test in this program uses.
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL,
           user_id TEXT NOT NULL,
           role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id)
         )`
      );
      // rvn_roi_cases.initiative_id REFERENCES initiatives(id) — the real
      // `initiatives` table lives in the legacy core baseline migration,
      // out of this program's own migration chain (design §2). Same
      // minimal fixture stand-in `initiativeKpiImpactBaselineFreeze
      // .realdb.test.ts` already established for KPI-E005's identical FK.
      // `initiatives.organization_id` carries a real FK to `organizations(id)`
      // on a fully-migrated schema, which makes the defensive
      // `CREATE TABLE IF NOT EXISTS initiatives` below a no-op rather than the
      // stub it looks like — so the organization row has to exist first.
      await ensureRoiFixtureOrganization(client, ORG_ID, 'roiVisibilityJoin realdb fixture org');
      await client.query(
        `CREATE TABLE IF NOT EXISTS initiatives (
           id TEXT PRIMARY KEY,
           organization_id TEXT NOT NULL,
           name TEXT NOT NULL
         )`
      );
      // Each `it` block below inserts its OWN initiative fixture (see
      // insertFixtureInitiative's own comment) — no shared row here.
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the ROI schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const repository: RepositoryModule = await import('../../../server/src/services/resultsVnext/roi/roiRepository.js');
    listRoiCases = repository.listRoiCases;
    getRoiCase = repository.getRoiCase;
    getRoiBaseline = repository.getRoiBaseline;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    // USER_B never appears as an owner/grantee/team-member anywhere, and
    // effectiveAccessService.ts defaults an unregistered user to plain
    // 'USER' (no wildcard/roi_case.view RBAC override) — same reasoning
    // every other realdb test in this program documents for its own
    // outsider fixture user.
    policyId = await insertVisibilityPolicy('roi', 'RESTRICTED_ACL', USER_A);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    // resource_acl has no organization_id column — scope the delete via a
    // subquery over this org's own case ids instead (must run BEFORE the
    // rvn_roi_cases delete below, while those rows still exist to join
    // against).
    await client.query(
      `DELETE FROM rvn_platform_resource_acl
        WHERE resource_type = 'roi_case'
          AND resource_id IN (SELECT case_id::text FROM rvn_roi_cases WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [ORG_ID]);
    // ROI-E002: createRoiCase now also inserts a rvn_roi_calculation_policy
    // shell row (FK to rvn_roi_cases) — must be deleted before rvn_roi_cases.
    await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
    await client.end();
    if (closePgPool) await closePgPool();
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

  itDB(
    'listRoiCases/getRoiCase: a RESTRICTED_ACL case is visible to its ACL grantee and invisible to an outsider — ' +
      'proves the `vr.resource_id = rc.case_id::text` join executes against real rows instead of throwing 42883 ' +
      '(text = uuid) or silently matching nothing',
    async () => {
      const caseId = randomUUID();
      const initiativeId = `${INITIATIVE_ID}-1`;
      await insertFixtureInitiative(initiativeId);
      await insertFixtureCase(caseId, initiativeId, USER_A);
      await insertCaseVisibility(caseId, USER_A);
      await grantAcl(caseId, USER_A, USER_A);

      const granteeList = await listRoiCases({ userId: USER_A, organizationId: ORG_ID });
      expect(granteeList.map((c) => c.caseId)).toContain(caseId);

      const granteeGet = await getRoiCase({ userId: USER_A, organizationId: ORG_ID, caseId });
      expect(granteeGet).not.toBeNull();
      expect(granteeGet?.caseId).toBe(caseId);

      // Outsider: listRoiCases excludes it, getRoiCase returns null — NOT a
      // thrown 42883 (which would fail the whole call) and NOT a
      // false-positive leak.
      const outsiderList = await listRoiCases({ userId: USER_B, organizationId: ORG_ID });
      expect(outsiderList.map((c) => c.caseId)).not.toContain(caseId);

      const outsiderGet = await getRoiCase({ userId: USER_B, organizationId: ORG_ID, caseId });
      expect(outsiderGet).toBeNull();
    }
  );

  itDB(
    'getRoiBaseline: inherits the case\'s RESTRICTED_ACL visibility via `rb.case_id::text` — visible to the ' +
      'ACL grantee, invisible to an outsider, even though the baseline row itself has no visibility row of its own',
    async () => {
      const caseId = randomUUID();
      const initiativeId = `${INITIATIVE_ID}-2`;
      await insertFixtureInitiative(initiativeId);
      await insertFixtureCase(caseId, initiativeId, USER_A);
      await insertCaseVisibility(caseId, USER_A);
      await grantAcl(caseId, USER_A, USER_A);

      const granteeBaseline = await getRoiBaseline({ userId: USER_A, organizationId: ORG_ID, caseId });
      expect(granteeBaseline).not.toBeNull();
      expect(granteeBaseline?.caseId).toBe(caseId);

      const outsiderBaseline = await getRoiBaseline({ userId: USER_B, organizationId: ORG_ID, caseId });
      expect(outsiderBaseline).toBeNull();
    }
  );

  itDB(
    'listRoiCases: archived cases are excluded by default and included with includeArchived:true',
    async () => {
      const caseId = randomUUID();
      const initiativeId = `${INITIATIVE_ID}-3`;
      await insertFixtureInitiative(initiativeId);
      await insertFixtureCase(caseId, initiativeId, USER_A);
      await insertCaseVisibility(caseId, USER_A);
      await grantAcl(caseId, USER_A, USER_A);
      await client.query(`UPDATE rvn_roi_cases SET archived_at = now(), archived_by = $1 WHERE case_id = $2`, [
        USER_A,
        caseId,
      ]);

      const defaultList = await listRoiCases({ userId: USER_A, organizationId: ORG_ID });
      expect(defaultList.map((c) => c.caseId)).not.toContain(caseId);

      const includeArchivedList = await listRoiCases({
        userId: USER_A,
        organizationId: ORG_ID,
        includeArchived: true,
      });
      expect(includeArchivedList.map((c) => c.caseId)).toContain(caseId);
    }
  );
});
