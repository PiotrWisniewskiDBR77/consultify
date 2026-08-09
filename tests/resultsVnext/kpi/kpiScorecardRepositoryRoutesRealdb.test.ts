/**
 * KPI-E004 Scorecards HTTP layer package — REPOSITORY-LEVEL real-Postgres
 * coverage for the read paths `kpiScorecard.routes.ts` newly exposes over
 * HTTP: `listScorecards`, `listScorecardItems`, `getScorecardStatusDistribution`,
 * `listReviewSnapshots`, plus this package's own local
 * `loadVisibleScorecard` helper (`GET /:scorecardId`).
 *
 * WHY THIS FILE EXISTS (the lesson this package was explicitly briefed on —
 * EXECUTION_LEDGER.md §24): `kpi.routes.test.ts`/`kpiDeviation.routes.test.ts`
 * mocked their ENTIRE repository module with `vi.mock(...)`, so their GET
 * endpoints never once executed the real
 * `INNER JOIN rvn_visible_resources vr ON ... vr.resource_id = <uuid column>`
 * join against Postgres — hiding a real TEXT/UUID type-mismatch bug (42883)
 * for three packages until a dedicated realDB test forced it. This file's
 * own sibling route test (`server/src/routes/resultsVnext/__tests__/
 * kpiScorecard.routes.test.ts`) makes the SAME mocking choice for the SAME
 * reason (an HTTP-boundary test's job is request validation/error mapping,
 * not the DB) — which means it is EXACTLY the kind of test §24 warns gives
 * false confidence about the join actually working. This file is the
 * required counterweight: every read function `kpiScorecard.routes.ts`
 * calls, exercised directly against a real Postgres 16, with a
 * PRIVATE/restricted KPI in the mix so the visibility filter is forced to
 * do real work, not just "return everything".
 *
 * `getPublishedSnapshot` already has dedicated realDB non-leak coverage
 * (`scorecardPublishNonLeak.realdb.test.ts`, §23) — not repeated here.
 * `loadVisibleScorecard` (this package's own local helper, not exported by
 * the repository) is exercised here via a direct query built the identical
 * way the routes file builds it, since importing an unexported function is
 * not possible — the query text is copied verbatim from
 * `kpiScorecard.routes.ts`'s own `loadVisibleScorecard`, so a drift between
 * the two would only ever be a copy-paste error, not a fundamentally
 * untested code path (the routes file's own query construction — CTE +
 * `wrapWithVisibilityScope` + one appended parameter — is architecturally
 * identical to every other query in this file, all proven to execute
 * correctly against Postgres below).
 *
 * SKIP POLICY (same convention as every other `*.realdb.test.ts` in this
 * directory): if no database is configured (no DATABASE_URL/DB_HOST), every
 * scenario below is a silent no-op and this file reports green — that is
 * expected in environments without a Postgres available and is NOT evidence
 * the behavior works. If a database IS configured but unreachable,
 * `beforeAll` throws so this run is never silently green.
 *
 * HOW TO RUN FOR REAL: point DATABASE_URL (or DB_HOST/DB_PORT/DB_NAME/
 * DB_USER/DB_PASSWORD) at a Postgres 16 that already has the full
 * `rvn_platform_*`/`rvn_kpi_*` schema applied (server/migrations/
 * 20260809_rvn_platform_*.sql, 20260810_rvn_kpi_core.sql,
 * 20260811_rvn_kpi_deviation_loop.sql, 20260811_rvn_platform_obligations.sql,
 * 20260812_rvn_kpi_scorecards.sql) before importing this file — env vars are
 * read once, at server/src/config/DatabaseConfig.ts's module-load time.
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
const ORG_ID = `kpi-e004-routes-it-org-${tag}`;
const USER_A = `kpi-e004-routes-it-user-a-${tag}`; // owner of every fixture KPI/scorecard
const USER_B = `kpi-e004-routes-it-user-b-${tag}`; // plain member — no override, no ownership

let client: Client;
let reachable = false;

type CommandsModule =
  typeof import('../../../server/src/services/resultsVnext/kpi/kpiScorecardCommands.js');
type RepositoryModule =
  typeof import('../../../server/src/services/resultsVnext/kpi/kpiScorecardRepository.js');
type VisibilityModule =
  typeof import('../../../server/src/services/resultsVnext/platform/visibilityScopedQuery.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createScorecard: CommandsModule['createScorecard'];
let addScorecardItem: CommandsModule['addScorecardItem'];
let createReviewSnapshot: CommandsModule['createReviewSnapshot'];
let publishReviewSnapshot: CommandsModule['publishReviewSnapshot'];
let listScorecards: RepositoryModule['listScorecards'];
let listScorecardItems: RepositoryModule['listScorecardItems'];
let getScorecardStatusDistribution: RepositoryModule['getScorecardStatusDistribution'];
let listReviewSnapshots: RepositoryModule['listReviewSnapshots'];
let wrapWithVisibilityScope: VisibilityModule['wrapWithVisibilityScope'];
let VISIBILITY_CTE_PARAM_COUNT: number;
let acquirePgClient: PgModule['acquirePgClient'];
let closePgPool: (() => Promise<void>) | undefined;

let sharedKpiPolicyId: string;

async function insertVisibilityPolicy(
  domain: string,
  mode: string,
  createdBy: string
): Promise<string> {
  const result = await client.query<{ policy_id: string }>(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)
     RETURNING policy_id`,
    [ORG_ID, domain, mode, createdBy]
  );
  return result.rows[0]!.policy_id;
}

async function insertFixtureKpi(
  kpiId: string,
  versionId: string,
  ownerUserId: string
): Promise<void> {
  await client.query(
    `INSERT INTO rvn_kpi_definitions (kpi_id, organization_id, kpi_code, status, owner_user_id, created_by)
     VALUES ($1, $2, $3, 'active', $4, $4)`,
    [kpiId, ORG_ID, `KPI-${kpiId.slice(0, 8)}`, ownerUserId]
  );
  await client.query(
    `INSERT INTO rvn_kpi_definition_versions
       (definition_version_id, kpi_id, organization_id, version_number, name, unit, target_geometry,
        target_min, approval_status, created_by, effective_from)
     VALUES ($1, $2, $3, 1, 'IT fixture KPI', 'unit', 'threshold_min', 100, 'approved', $4, now())`,
    [versionId, kpiId, ORG_ID, ownerUserId]
  );
  await client.query(
    `UPDATE rvn_kpi_definitions SET current_definition_version_id = $1 WHERE kpi_id = $2`,
    [versionId, kpiId]
  );
}

async function insertKpiVisibility(
  kpiId: string,
  policyId: string,
  mode: 'OPEN_ORG' | 'PRIVATE',
  ownerUserId: string
): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_resource_visibility
       (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
     VALUES ('kpi', $1, $2, $3, $4, $5)`,
    [kpiId, ORG_ID, mode, policyId, ownerUserId]
  );
}

/**
 * A scorecard row inserted directly (bypassing `createScorecard`) — needed
 * because `createScorecard` always resolves ONE shared active `'kpi'`-domain
 * policy per org (decision #1: "reuse 'kpi' domain policy for V1") and
 * writes ITS `visibility_mode` onto every scorecard's own visibility row.
 * `sharedKpiPolicyId` (this file's one 'kpi'-domain policy) is OPEN_ORG, so
 * every scorecard created THROUGH the command layer in this file is
 * OPEN_ORG — there is no way to get a PRIVATE scorecard out of
 * `createScorecard` without a second active 'kpi'-domain policy, which the
 * UNIQUE(organization_id, domain, policy_version) constraint (and "one
 * active policy" semantics) makes awkward to add mid-file. Instead, this
 * mirrors exactly how `scorecardPublishNonLeak.realdb.test.ts` gets a
 * PRIVATE *KPI* despite the same shared-policy setup: insert the resource's
 * own `rvn_platform_resource_visibility` row directly with whatever mode the
 * scenario needs — `visibility_mode` lives on the PER-RESOURCE row, not the
 * policy row, `policy_id` is just an FK reference. `loadScorecardForUpdate`/
 * `listScorecards`/etc. only ever read the `rvn_kpi_scorecards` row itself
 * plus this visibility row — neither cares whether the scorecard came from
 * `createScorecard` or a direct INSERT, so command-layer functions
 * (`addScorecardItem`/`createReviewSnapshot`/`publishReviewSnapshot`) work
 * unmodified against a row created this way.
 */
async function insertFixtureScorecard(
  scorecardId: string,
  ownerUserId: string,
  name: string
): Promise<void> {
  await client.query(
    `INSERT INTO rvn_kpi_scorecards
       (scorecard_id, organization_id, name, scope_type, owner_user_id, review_frequency, created_by)
     VALUES ($1, $2, $3, 'individual', $4, 'monthly', $4)`,
    [scorecardId, ORG_ID, name, ownerUserId]
  );
}

async function insertScorecardVisibility(
  scorecardId: string,
  policyId: string,
  mode: 'OPEN_ORG' | 'PRIVATE',
  ownerUserId: string
): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_resource_visibility
       (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
     VALUES ('kpi_scorecard', $1, $2, $3, $4, $5)`,
    [scorecardId, ORG_ID, mode, policyId, ownerUserId]
  );
}

async function insertMeasurement(
  measurementId: string,
  kpiId: string,
  versionId: string,
  periodStart: string,
  periodEnd: string,
  actualValue: number,
  performanceStatus: string,
  recordedBy: string
): Promise<void> {
  await client.query(
    `INSERT INTO rvn_kpi_measurements
       (measurement_id, kpi_id, definition_version_id, organization_id, period_start, period_end,
        actual_value, performance_status, source, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'manual', $9)`,
    [
      measurementId,
      kpiId,
      versionId,
      ORG_ID,
      periodStart,
      periodEnd,
      actualValue,
      performanceStatus,
      recordedBy,
    ]
  );
}

/** Copy of `kpiScorecard.routes.ts`'s own local `loadVisibleScorecard` —
 * see this file's own header comment for why it is duplicated rather than
 * imported (the function is not exported). */
async function loadVisibleScorecard(userId: string, organizationId: string, scorecardId: string) {
  const baseQuerySql = `
    SELECT sc.* FROM rvn_kpi_scorecards sc
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = 'kpi_scorecard' AND vr.resource_id = sc.scorecard_id::text
     WHERE sc.organization_id = $1 AND sc.scorecard_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}`;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, {
    userId,
    organizationId,
    resourceType: 'kpi_scorecard',
  });
  const values = [...wrapped.values, scorecardId];
  const readClient = await acquirePgClient();
  try {
    const result = await readClient.query<{ scorecard_id: string }>(wrapped.sql, values);
    return result.rows[0] ?? null;
  } finally {
    readClient.release();
  }
}

describe('KPI-E004 routes package — repository-level real-Postgres coverage (visibility joins)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — KPI-E004 routes-package repository realdb tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_kpi_scorecards LIMIT 0');
      // Same standalone fixture table as scorecardPublishNonLeak.realdb.test.ts
      // — buildVisibilityScopedCte's SCOPE branch unconditionally references
      // team_members regardless of which visibility_mode this file's fixtures
      // actually use.
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
        'A database is configured but is not reachable (or missing the KPI-E004 schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const commands: CommandsModule =
      await import('../../../server/src/services/resultsVnext/kpi/kpiScorecardCommands.js');
    createScorecard = commands.createScorecard;
    addScorecardItem = commands.addScorecardItem;
    createReviewSnapshot = commands.createReviewSnapshot;
    publishReviewSnapshot = commands.publishReviewSnapshot;

    const repository: RepositoryModule =
      await import('../../../server/src/services/resultsVnext/kpi/kpiScorecardRepository.js');
    listScorecards = repository.listScorecards;
    listScorecardItems = repository.listScorecardItems;
    getScorecardStatusDistribution = repository.getScorecardStatusDistribution;
    listReviewSnapshots = repository.listReviewSnapshots;

    const visibility: VisibilityModule =
      await import('../../../server/src/services/resultsVnext/platform/visibilityScopedQuery.js');
    wrapWithVisibilityScope = visibility.wrapWithVisibilityScope;
    VISIBILITY_CTE_PARAM_COUNT = visibility.VISIBILITY_CTE_PARAM_COUNT;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    acquirePgClient = pgModule.acquirePgClient;
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    // USER_A is the literal owner_user_id on every fixture KPI/scorecard —
    // sufficient on its own for buildVisibilityScopedCte's PRIVATE branch
    // ("owner only") to grant USER_A visibility (verified directly against
    // visibilityScopedQuery.ts, same as scorecardPublishNonLeak.realdb.test.ts's
    // own comment). USER_B never appears as owner/grantee/team-member, so
    // it gets no override either.
    sharedKpiPolicyId = await insertVisibilityPolicy('kpi', 'OPEN_ORG', USER_A);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(
      `DELETE FROM rvn_kpi_scorecard_review_snapshot_measurements WHERE snapshot_id IN (
                          SELECT snapshot_id FROM rvn_kpi_scorecard_review_snapshots
                           WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(
      `DELETE FROM rvn_kpi_scorecard_review_snapshots WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_kpi_scorecard_items WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_scorecards WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [
      ORG_ID,
    ]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (
                          SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_measurements WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1`, [
      ORG_ID,
    ]);
    await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [
      ORG_ID,
    ]);
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
    'listScorecards / loadVisibleScorecard: a PRIVATE scorecard is visible to its owner (USER_A) ' +
      'and invisible to an unrelated member (USER_B) — forces the real INNER JOIN rvn_visible_resources ' +
      'ON ... = sc.scorecard_id::text to execute, not a mock',
    async () => {
      const scorecardId = randomUUID();
      await insertFixtureScorecard(scorecardId, USER_A, 'Private routes-package scorecard');
      await insertScorecardVisibility(scorecardId, sharedKpiPolicyId, 'PRIVATE', USER_A);

      // --- listScorecards
      const asOwner = await listScorecards({ userId: USER_A, organizationId: ORG_ID });
      expect(asOwner.map((s) => s.scorecardId)).toContain(scorecardId);

      const asStranger = await listScorecards({ userId: USER_B, organizationId: ORG_ID });
      expect(asStranger.map((s) => s.scorecardId)).not.toContain(scorecardId);

      // --- loadVisibleScorecard (this package's own local getScorecard helper)
      const ownerRead = await loadVisibleScorecard(USER_A, ORG_ID, scorecardId);
      expect(ownerRead?.scorecard_id).toBe(scorecardId);

      const strangerRead = await loadVisibleScorecard(USER_B, ORG_ID, scorecardId);
      expect(strangerRead).toBeNull();
    }
  );

  itDB(
    "listScorecardItems / getScorecardStatusDistribution: item-level visibility (resourceType='kpi') " +
      'is independently enforced even when the parent scorecard itself is OPEN_ORG — AC #4, forces the ' +
      'real si.kpi_id::text join, not a mock',
    async () => {
      const kpiVisible = randomUUID();
      const versionVisible = randomUUID();
      await insertFixtureKpi(kpiVisible, versionVisible, USER_A);
      await insertKpiVisibility(kpiVisible, sharedKpiPolicyId, 'OPEN_ORG', USER_A);
      await insertMeasurement(
        randomUUID(),
        kpiVisible,
        versionVisible,
        '2026-03-01T00:00:00.000Z',
        '2026-03-31T00:00:00.000Z',
        50,
        'on_target',
        USER_A
      );

      const kpiRestricted = randomUUID();
      const versionRestricted = randomUUID();
      await insertFixtureKpi(kpiRestricted, versionRestricted, USER_A);
      await insertKpiVisibility(kpiRestricted, sharedKpiPolicyId, 'PRIVATE', USER_A);
      await insertMeasurement(
        randomUUID(),
        kpiRestricted,
        versionRestricted,
        '2026-03-01T00:00:00.000Z',
        '2026-03-31T00:00:00.000Z',
        10,
        'critical',
        USER_A
      );

      const scorecardOutcome = await createScorecard({
        organizationId: ORG_ID,
        name: 'Open-org scorecard with a restricted item',
        scopeType: 'team',
        reviewFrequency: 'monthly',
        createdBy: USER_A,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `create-scorecard-items-${kpiVisible}`,
      });
      const scorecardId = scorecardOutcome.result.scorecard.scorecardId;
      // Scorecard-level visibility is OPEN_ORG by default (decision #1 policy
      // reused above is 'kpi'-domain OPEN_ORG) — USER_B CAN see the scorecard
      // itself; the point of this test is that it must NOT see the restricted
      // item through it.

      let expectedVersion = 1;
      for (const kpiId of [kpiVisible, kpiRestricted]) {
        const addOutcome = await addScorecardItem({
          scorecardId,
          organizationId: ORG_ID,
          expectedVersion,
          actorUserId: USER_A,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `add-item-routes-${kpiId}`,
          kpiId,
        });
        expectedVersion = addOutcome.result.scorecard.rowVersion;
      }

      // --- listScorecardItems
      const itemsAsOwner = await listScorecardItems({
        userId: USER_A,
        organizationId: ORG_ID,
        scorecardId,
      });
      expect(itemsAsOwner.map((i) => i.kpiId)).toEqual(
        expect.arrayContaining([kpiVisible, kpiRestricted])
      );

      const itemsAsStranger = await listScorecardItems({
        userId: USER_B,
        organizationId: ORG_ID,
        scorecardId,
      });
      const strangerKpiIds = itemsAsStranger.map((i) => i.kpiId);
      expect(strangerKpiIds).toContain(kpiVisible);
      expect(strangerKpiIds).not.toContain(kpiRestricted);

      // --- getScorecardStatusDistribution (filter-before-aggregate, AC #4)
      const distributionAsOwner = await getScorecardStatusDistribution({
        userId: USER_A,
        organizationId: ORG_ID,
        scorecardId,
        asOf: '2026-04-01T00:00:00.000Z',
      });
      expect(distributionAsOwner.totalVisible).toBe(2);
      expect(distributionAsOwner.safe).toBe(1);
      expect(distributionAsOwner.critical).toBe(1);

      const distributionAsStranger = await getScorecardStatusDistribution({
        userId: USER_B,
        organizationId: ORG_ID,
        scorecardId,
        asOf: '2026-04-01T00:00:00.000Z',
      });
      expect(distributionAsStranger.totalVisible).toBe(1);
      expect(distributionAsStranger.safe).toBe(1);
      expect(distributionAsStranger.critical).toBe(0);
    }
  );

  itDB(
    "listReviewSnapshots: scorecard-level visibility (resourceType='kpi_scorecard') gates the whole " +
      "history list — a PRIVATE scorecard's snapshot history is invisible end-to-end to a non-owner. " +
      "Fixture inserted directly (see insertFixtureScorecard's own comment: createScorecard cannot " +
      'produce a PRIVATE scorecard in this file, since it always reuses the one shared OPEN_ORG ' +
      "'kpi'-domain policy per decision #1) — command-layer functions (addScorecardItem/" +
      'createReviewSnapshot/publishReviewSnapshot) still operate on it unmodified.',
    async () => {
      const scorecardId = randomUUID();
      await insertFixtureScorecard(scorecardId, USER_A, 'History-visibility scorecard');
      await insertScorecardVisibility(scorecardId, sharedKpiPolicyId, 'PRIVATE', USER_A);

      const kpiId = randomUUID();
      const versionId = randomUUID();
      await insertFixtureKpi(kpiId, versionId, USER_A);
      await insertKpiVisibility(kpiId, sharedKpiPolicyId, 'OPEN_ORG', USER_A);
      await insertMeasurement(
        randomUUID(),
        kpiId,
        versionId,
        '2026-04-01T00:00:00.000Z',
        '2026-04-30T00:00:00.000Z',
        5,
        'on_target',
        USER_A
      );

      await addScorecardItem({
        scorecardId,
        organizationId: ORG_ID,
        expectedVersion: 1,
        actorUserId: USER_A,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `add-item-hist-${kpiId}`,
        kpiId,
      });

      const draft = await createReviewSnapshot({
        scorecardId,
        organizationId: ORG_ID,
        reviewPeriodStart: '2026-04-01T00:00:00.000Z',
        reviewPeriodEnd: '2026-04-30T00:00:00.000Z',
        createdBy: USER_A,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `draft-hist-${kpiId}`,
      });
      // expectedVersion here is the SNAPSHOT's own row_version (CAS surface
      // for publishReviewSnapshot — kpiScorecardCommands.ts's own
      // loadSnapshotForUpdate/snapshotRowVersion), NOT the scorecard's —
      // draft.result.rowVersion is 1 (createReviewSnapshot's fresh row).
      await publishReviewSnapshot({
        snapshotId: draft.result.snapshotId,
        scorecardId,
        organizationId: ORG_ID,
        expectedVersion: draft.result.rowVersion,
        publishedBy: USER_A,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `publish-hist-${kpiId}`,
      });

      const historyAsOwner = await listReviewSnapshots({
        userId: USER_A,
        organizationId: ORG_ID,
        scorecardId,
      });
      expect(historyAsOwner.map((s) => s.snapshotId)).toContain(draft.result.snapshotId);
      expect(historyAsOwner.find((s) => s.snapshotId === draft.result.snapshotId)?.status).toBe(
        'published'
      );

      // THE assertion: USER_B (not owner, no override) must see NOTHING —
      // the scorecard is PRIVATE, so the join in listReviewSnapshots' own
      // baseQuerySql (INNER JOIN rvn_visible_resources vr ON
      // vr.resource_type = 'kpi_scorecard' AND vr.resource_id =
      // sc.scorecard_id::text) must exclude every row for this scorecard_id.
      const historyAsStranger = await listReviewSnapshots({
        userId: USER_B,
        organizationId: ORG_ID,
        scorecardId,
      });
      expect(historyAsStranger).toHaveLength(0);
    }
  );
});
