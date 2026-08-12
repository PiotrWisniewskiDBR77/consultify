/**
 * OKR-E002 — visibility-join regression, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E002_DESIGN.md §5: "every join
 * casts `::text`. This exact cast has already been missed 7 times in one
 * KPI epic and is the single most-repeated real bug in this program."
 *
 * Proves `listOkrSets`/`getOkrSet`/`listOkrSetApprovedSnapshots`/
 * `getOkrSetApprovedSnapshot` (`okrSetRepository.ts`) actually execute
 * their `s.set_id::text` / `snap.set_id::text` joins against real rows
 * (Postgres 42883 "operator does not exist: text = uuid" would fire on the
 * first visible row otherwise) AND that OPEN_ORG/RESTRICTED_ACL/PRIVATE
 * visibility is each enforced correctly. Also proves the SAME `::text`
 * cast pattern works against the THIRD table this epic introduces,
 * `okr_vnext_set_versions` — that table has no shipped repository function
 * of its own (no AC/route in this epic reads it), so this is a direct,
 * ad-hoc `buildVisibilityScopedCte` join executed in the test itself,
 * proving the pattern is ready for whichever future epic builds that
 * reader.
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
const ORG_ID = `okr-e002-vis-join-org-${tag}`;
const USER_GRANTEE = `okr-e002-vis-join-grantee-${tag}`; // ACL-granted / owner
const USER_OUTSIDER = `okr-e002-vis-join-outsider-${tag}`; // no ACL, no owner, no RBAC override
const USER_ADMIN = `okr-e002-vis-join-admin-${tag}`;

let client: Client;
let reachable = false;

type ProgramCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetRepositoryModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetRepository.js');
type VisibilityScopedQueryModule = typeof import('../../../server/src/services/resultsVnext/platform/visibilityScopedQuery.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let listOkrSets: SetRepositoryModule['listOkrSets'];
let getOkrSet: SetRepositoryModule['getOkrSet'];
let listOkrSetApprovedSnapshots: SetRepositoryModule['listOkrSetApprovedSnapshots'];
let getOkrSetApprovedSnapshot: SetRepositoryModule['getOkrSetApprovedSnapshot'];
let buildVisibilityScopedCte: VisibilityScopedQueryModule['buildVisibilityScopedCte'];
let closePgPool: (() => Promise<void>) | undefined;

let programId: string;
let cycleId: string;
let policyId: string;

function baseCycleTimes() {
  return {
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    draftOpenAt: '2025-12-15T00:00:00.000Z',
    submissionDueAt: '2025-12-28T00:00:00.000Z',
    activeStartAt: '2026-01-01T00:00:00.000Z',
    finalUpdateDueAt: '2026-03-20T00:00:00.000Z',
    reviewOpenAt: '2026-03-21T00:00:00.000Z',
    reflectionDueAt: '2026-03-25T00:00:00.000Z',
    closeAt: '2026-03-31T00:00:00.000Z',
  };
}

/** Direct fixture INSERT (bypassing `createOkrSet`) so each scenario can
 * pin an arbitrary `visibility_mode` regardless of what the org's active
 * `domain='okr'` policy currently says — same technique
 * `roiVisibilityJoin.realdb.test.ts` uses for `rvn_roi_cases`.
 *
 * D3's real partial unique index is `(organization_id, program_id,
 * cycle_id, scope_type, scope_id, owner_user_id) WHERE status <>
 * 'cancelled'` — every `it` block below reuses the SAME
 * program_id/cycle_id (module-level fixture), so `scope_id` must be
 * distinct PER FIXTURE SET (keyed off `setId`, not `ownerUserId`, since
 * several scenarios below deliberately reuse `USER_GRANTEE` as the owner). */
async function insertFixtureSet(setId: string, ownerUserId: string): Promise<void> {
  await client.query(
    `INSERT INTO okr_vnext_sets
       (set_id, organization_id, program_id, cycle_id, scope_type, scope_id, owner_user_id, title, created_by)
     VALUES ($1, $2, $3, $4, 'individual', $5, $6, 'Visibility-join fixture Set', $6)`,
    [setId, ORG_ID, programId, cycleId, setId, ownerUserId]
  );
}

async function insertSetVisibility(setId: string, mode: string, ownerUserId: string | null): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_resource_visibility
       (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
     VALUES ('okr_set', $1, $2, $3, $4, $5)`,
    [setId, ORG_ID, mode, policyId, ownerUserId]
  );
}

/** `rvn_platform_resource_acl` has NO `organization_id` column — same
 * shape `roiVisibilityJoin.realdb.test.ts`'s own `grantAcl` uses. */
async function grantAcl(setId: string, granteeUserId: string, grantedBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_resource_acl
       (resource_type, resource_id, grantee_type, grantee_id, access_level, granted_by)
     VALUES ('okr_set', $1, 'user', $2, 'contribute', $3)`,
    [setId, granteeUserId, grantedBy]
  );
}

async function insertFixtureSnapshot(snapshotId: string, setId: string, sequenceNumber: number): Promise<void> {
  await client.query(
    `INSERT INTO okr_vnext_approved_snapshots
       (snapshot_id, set_id, organization_id, sequence_number, approved_by, content_hash, snapshot_payload)
     VALUES ($1, $2, $3, $4, $5, 'fixture-hash', '{"set":{},"objectives":[]}'::jsonb)`,
    [snapshotId, setId, ORG_ID, sequenceNumber, USER_ADMIN]
  );
}

async function insertFixtureSetVersion(versionId: string, setId: string): Promise<void> {
  await client.query(
    `INSERT INTO okr_vnext_set_versions
       (version_id, set_id, organization_id, version_number, field_name, before_value, after_value, reason, requested_by)
     VALUES ($1, $2, $3, 1, 'title', 'old', 'new', 'fixture reason', $4)`,
    [versionId, setId, ORG_ID, USER_ADMIN]
  );
}

describe('OKR-E002 Set visibility-join regression — TEXT/UUID cast forces real join execution (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — OKR Set visibility-join regression tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_sets LIMIT 0');
      await client.query('SELECT 1 FROM okr_vnext_approved_snapshots LIMIT 0');
      await client.query('SELECT 1 FROM okr_vnext_set_versions LIMIT 0');
      // buildVisibilityScopedCte's SCOPE branch unconditionally references
      // `team_members` regardless of which visibility_mode this file's
      // fixtures use — the query fails to PARSE without the table
      // existing. Same minimal stand-in every other realdb test uses.
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL,
           user_id TEXT NOT NULL,
           role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id)
         )`
      );
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR Set schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const programCommands: ProgramCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrProgramCommands.js'
    );
    createProgram = programCommands.createProgram;
    publishProgram = programCommands.publishProgram;

    const cycleCommands: CycleCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrCycleCommands.js'
    );
    createCycle = cycleCommands.createCycle;

    const setRepository: SetRepositoryModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrSetRepository.js'
    );
    listOkrSets = setRepository.listOkrSets;
    getOkrSet = setRepository.getOkrSet;
    listOkrSetApprovedSnapshots = setRepository.listOkrSetApprovedSnapshots;
    getOkrSetApprovedSnapshot = setRepository.getOkrSetApprovedSnapshot;

    const visibilityScopedQuery: VisibilityScopedQueryModule = await import(
      '../../../server/src/services/resultsVnext/platform/visibilityScopedQuery.js'
    );
    buildVisibilityScopedCte = visibilityScopedQuery.buildVisibilityScopedCte;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    // Real Program+Cycle via the command layer (correct FKs); this also
    // authors the domain='okr' active policy (irrelevant to the fixtures
    // below, which each pin their OWN visibility_mode directly).
    const created = await createProgram({
      organizationId: ORG_ID,
      name: 'Visibility-join fixture Program',
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const published = await publishProgram({
      programId: created.result.programId,
      organizationId: ORG_ID,
      expectedVersion: created.result.rowVersion,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `publish-program-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    programId = created.result.programId;
    const cycle = await createCycle({
      organizationId: ORG_ID,
      programId,
      name: 'Visibility-join fixture Cycle',
      ...baseCycleTimes(),
      createdBy: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `create-cycle-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    cycleId = cycle.result.cycleId;

    const policyRow = await client.query<{ policy_id: string }>(
      `SELECT policy_id FROM rvn_platform_visibility_policies WHERE organization_id = $1 AND domain = 'okr' AND is_active = true`,
      [ORG_ID]
    );
    policyId = policyRow.rows[0]!.policy_id;
    void published;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    const orgLike = `${ORG_ID}%`;
    await client.query(
      `DELETE FROM rvn_platform_resource_acl
        WHERE resource_type = 'okr_set'
          AND resource_id IN (SELECT set_id::text FROM okr_vnext_sets WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM okr_vnext_set_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`UPDATE okr_vnext_sets SET latest_approved_snapshot_id = NULL WHERE organization_id = $1`, [
      ORG_ID,
    ]);
    await client.query(`DELETE FROM okr_vnext_approved_snapshots WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1 AND resource_type = 'okr_set'`, [
      ORG_ID,
    ]);
    await client.query(`DELETE FROM okr_vnext_sets WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_checkin_occurrences WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_cycles WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`UPDATE okr_vnext_programs SET active_policy_version_id = NULL WHERE organization_id = $1`, [
      ORG_ID,
    ]);
    await client.query(`DELETE FROM okr_vnext_program_policy_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM okr_vnext_programs WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id LIKE $1)`,
      [orgLike]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
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

  // ==========================================
  // Table 1/3: okr_vnext_sets — OPEN_ORG / RESTRICTED_ACL / PRIVATE
  // ==========================================

  itDB('OPEN_ORG: every org member sees the Set via listOkrSets/getOkrSet, no ACL/ownership needed', async () => {
    const setId = randomUUID();
    await insertFixtureSet(setId, USER_GRANTEE);
    await insertSetVisibility(setId, 'OPEN_ORG', USER_GRANTEE);

    const outsiderList = await listOkrSets({ userId: USER_OUTSIDER, organizationId: ORG_ID });
    expect(outsiderList.map((s) => s.setId)).toContain(setId);

    const outsiderGet = await getOkrSet({ userId: USER_OUTSIDER, organizationId: ORG_ID, setId });
    expect(outsiderGet).not.toBeNull();
    expect(outsiderGet?.setId).toBe(setId);
  });

  itDB(
    'RESTRICTED_ACL: visible to its ACL grantee, invisible to an outsider — proves the ' +
      '`vr.resource_id = s.set_id::text` join executes against real rows instead of throwing 42883 (text = uuid) ' +
      'or silently matching nothing',
    async () => {
      const setId = randomUUID();
      await insertFixtureSet(setId, USER_GRANTEE);
      await insertSetVisibility(setId, 'RESTRICTED_ACL', USER_GRANTEE);
      await grantAcl(setId, USER_GRANTEE, USER_GRANTEE);

      const granteeList = await listOkrSets({ userId: USER_GRANTEE, organizationId: ORG_ID });
      expect(granteeList.map((s) => s.setId)).toContain(setId);

      const granteeGet = await getOkrSet({ userId: USER_GRANTEE, organizationId: ORG_ID, setId });
      expect(granteeGet).not.toBeNull();
      expect(granteeGet?.setId).toBe(setId);

      // Outsider: excluded from listing, null on direct get — NOT a thrown
      // 42883 (which would fail the whole call) and NOT a false-positive
      // leak.
      const outsiderList = await listOkrSets({ userId: USER_OUTSIDER, organizationId: ORG_ID });
      expect(outsiderList.map((s) => s.setId)).not.toContain(setId);

      const outsiderGet = await getOkrSet({ userId: USER_OUTSIDER, organizationId: ORG_ID, setId });
      expect(outsiderGet).toBeNull();
    }
  );

  itDB('PRIVATE: visible only to the owner, invisible to an outsider (no ACL grant at all)', async () => {
    const setId = randomUUID();
    await insertFixtureSet(setId, USER_GRANTEE);
    await insertSetVisibility(setId, 'PRIVATE', USER_GRANTEE);

    const ownerGet = await getOkrSet({ userId: USER_GRANTEE, organizationId: ORG_ID, setId });
    expect(ownerGet).not.toBeNull();
    expect(ownerGet?.setId).toBe(setId);

    const outsiderGet = await getOkrSet({ userId: USER_OUTSIDER, organizationId: ORG_ID, setId });
    expect(outsiderGet).toBeNull();

    const outsiderList = await listOkrSets({ userId: USER_OUTSIDER, organizationId: ORG_ID });
    expect(outsiderList.map((s) => s.setId)).not.toContain(setId);
  });

  // ==========================================
  // Table 2/3: okr_vnext_approved_snapshots — inherits via set_id::text
  // ==========================================

  itDB(
    'listOkrSetApprovedSnapshots/getOkrSetApprovedSnapshot inherit the Set\'s RESTRICTED_ACL visibility via ' +
      '`snap.set_id::text` — visible to the grantee, invisible to an outsider, even though the snapshot row ' +
      'has no visibility row of its own',
    async () => {
      const setId = randomUUID();
      const snapshotId = randomUUID();
      await insertFixtureSet(setId, USER_GRANTEE);
      await insertSetVisibility(setId, 'RESTRICTED_ACL', USER_GRANTEE);
      await grantAcl(setId, USER_GRANTEE, USER_GRANTEE);
      await insertFixtureSnapshot(snapshotId, setId, 1);

      const granteeList = await listOkrSetApprovedSnapshots({ userId: USER_GRANTEE, organizationId: ORG_ID, setId });
      expect(granteeList.map((s) => s.snapshotId)).toContain(snapshotId);

      const granteeGet = await getOkrSetApprovedSnapshot({
        userId: USER_GRANTEE,
        organizationId: ORG_ID,
        setId,
        snapshotId,
      });
      expect(granteeGet).not.toBeNull();
      expect(granteeGet?.snapshotId).toBe(snapshotId);

      const outsiderList = await listOkrSetApprovedSnapshots({ userId: USER_OUTSIDER, organizationId: ORG_ID, setId });
      expect(outsiderList).toHaveLength(0);

      const outsiderGet = await getOkrSetApprovedSnapshot({
        userId: USER_OUTSIDER,
        organizationId: ORG_ID,
        setId,
        snapshotId,
      });
      expect(outsiderGet).toBeNull();
    }
  );

  // ==========================================
  // Table 3/3: okr_vnext_set_versions — no shipped repository reader in
  // this epic (D17: the recommit workflow, and by extension any dedicated
  // read model for this table, is unbuilt). Direct, ad-hoc join proving the
  // SAME ::text cast pattern works here too, ready for whichever future
  // epic builds the real reader.
  // ==========================================

  itDB(
    'ad-hoc buildVisibilityScopedCte join against okr_vnext_set_versions via version.set_id::text: ' +
      'visible to the grantee, invisible to an outsider',
    async () => {
      const setId = randomUUID();
      const versionId = randomUUID();
      await insertFixtureSet(setId, USER_GRANTEE);
      await insertSetVisibility(setId, 'RESTRICTED_ACL', USER_GRANTEE);
      await grantAcl(setId, USER_GRANTEE, USER_GRANTEE);
      await insertFixtureSetVersion(versionId, setId);

      const runJoin = async (userId: string): Promise<string[]> => {
        const cte = await buildVisibilityScopedCte({ userId, organizationId: ORG_ID, resourceType: 'okr_set' });
        const sql = `${cte.sql}
          SELECT v.version_id
            FROM okr_vnext_set_versions v
            INNER JOIN rvn_visible_resources vr
                    ON vr.resource_type = 'okr_set' AND vr.resource_id = v.set_id::text
           WHERE v.organization_id = $${cte.values.length + 1}
             AND v.set_id = $${cte.values.length + 2}`;
        const result = await client.query<{ version_id: string }>(sql, [...cte.values, ORG_ID, setId]);
        return result.rows.map((r) => r.version_id);
      };

      const granteeVersionIds = await runJoin(USER_GRANTEE);
      expect(granteeVersionIds).toContain(versionId);

      const outsiderVersionIds = await runJoin(USER_OUTSIDER);
      expect(outsiderVersionIds).not.toContain(versionId);
    }
  );
});
