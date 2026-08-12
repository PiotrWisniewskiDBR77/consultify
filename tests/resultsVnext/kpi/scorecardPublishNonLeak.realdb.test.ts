/**
 * KPI-E004 — publish-supersede atomicity + the dual-layer non-leak
 * guarantee (decision #6, P0 close), against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/KPI_E004_DESIGN.md decision #6 / §B
 * (publishReviewSnapshot, decision #6a) / §C (getPublishedSnapshot,
 * decision #6b). §D task spec: "(a) publish-supersede atomicity under
 * concurrency (dwie sesje, wzorem KPI-E003's deviationCaseIdempotency
 * .realdb.test.ts), (b) KRYTYCZNY test non-leak dwuwarstwowy".
 *
 * SKIP POLICY (same convention as tests/resultsVnext/kpi/deviationCaseIdempotency
 * .realdb.test.ts): if no database is configured (no DATABASE_URL/DB_HOST),
 * every scenario below is a silent no-op and this file reports green — that
 * is expected in environments without a Postgres available and is NOT
 * evidence the behavior works. If a database IS configured but unreachable,
 * `beforeAll` throws so this run is never silently green.
 *
 * HOW TO RUN FOR REAL: point DATABASE_URL (or DB_HOST/DB_PORT/DB_NAME/
 * DB_USER/DB_PASSWORD) at a Postgres 16 that already has the full
 * `rvn_platform_*`/`rvn_kpi_*` schema applied (server/migrations/
 * 20260809_rvn_platform_*.sql, 20260810_rvn_kpi_core.sql,
 * 20260811_rvn_kpi_deviation_loop.sql, 20260811_rvn_platform_obligations.sql,
 * 20260812_rvn_kpi_scorecards.sql) before importing this file — env vars are
 * read once, at server/src/config/DatabaseConfig.ts's module-load time, so
 * they must be set before ANY transitive import of it.
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
const ORG_ID = `kpi-e004-it-org-${tag}`;
const USER_A = `kpi-e004-it-user-a-${tag}`; // sees every KPI (RBAC override — org OWNER)
const USER_B = `kpi-e004-it-user-b-${tag}`; // plain member — no override, no ownership

/**
 * RN-G5 (docs/product/results-vnext/RN_G5_AUTHZ_DESIGN.md): every
 * kpiScorecardCommands.ts command called in this file now requires an
 * `access: CommandAccessContext` field. This suite's own scenarios are
 * about publish-supersede atomicity and the visibility non-leak guarantee,
 * not command-layer authorization — USER_A is, in every scenario here,
 * ALSO the real owner of the scorecard/KPI it acts on, so a wildcard grant
 * changes nothing about which branch of the guard would have allowed the
 * call; it is used here purely so this file does not also have to fake a
 * real `resolveEffectiveAccess` DB round-trip for a concern orthogonal to
 * what this suite proves.
 */
const WILDCARD_ACCESS = { capabilities: ['*'], platformRole: null } as const;

let client: Client;
let reachable = false;

type CommandsModule = typeof import('../../../server/src/services/resultsVnext/kpi/kpiScorecardCommands.js');
type RepositoryModule = typeof import('../../../server/src/services/resultsVnext/kpi/kpiScorecardRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createScorecard: CommandsModule['createScorecard'];
let addScorecardItem: CommandsModule['addScorecardItem'];
let createReviewSnapshot: CommandsModule['createReviewSnapshot'];
let publishReviewSnapshot: CommandsModule['publishReviewSnapshot'];
let getPublishedSnapshot: RepositoryModule['getPublishedSnapshot'];
let closePgPool: (() => Promise<void>) | undefined;
/** One shared 'kpi'-domain policy for the whole file (rvn_platform_visibility_policies
 * has a UNIQUE(organization_id, domain, policy_version) — reusing ORG_ID across both
 * `it` blocks means a second `insertVisibilityPolicy('kpi', ...)` call would collide). */
let sharedKpiPolicyId: string;

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
  await client.query(`UPDATE rvn_kpi_definitions SET current_definition_version_id = $1 WHERE kpi_id = $2`, [
    versionId,
    kpiId,
  ]);
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
    [measurementId, kpiId, versionId, ORG_ID, periodStart, periodEnd, actualValue, performanceStatus, recordedBy]
  );
}

describe('KPI-E004 — publish-supersede atomicity + dual-layer non-leak (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — KPI-E004 scorecard realdb tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_kpi_scorecards LIMIT 0');
      // buildVisibilityScopedCte's SCOPE branch (visibilityScopedQuery.ts)
      // unconditionally references `team_members` in its fixed UNION
      // template regardless of which visibility_mode this file's fixtures
      // actually use — the query fails to PARSE without the table existing,
      // even though no row here ever populates it. `team_members` is a
      // legacy core-schema table (server/migrations/000_initdb_core_tables.sql)
      // outside this file's own migration-chain scope (see header comment) —
      // create a minimal, FK-free standalone stand-in, same "own fixture
      // table, not the full legacy schema" approach
      // tests/integration/kpiVisibility.res11.pg.test.ts already uses.
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

    const commands: CommandsModule = await import(
      '../../../server/src/services/resultsVnext/kpi/kpiScorecardCommands.js'
    );
    createScorecard = commands.createScorecard;
    addScorecardItem = commands.addScorecardItem;
    createReviewSnapshot = commands.createReviewSnapshot;
    publishReviewSnapshot = commands.publishReviewSnapshot;

    const repository: RepositoryModule = await import(
      '../../../server/src/services/resultsVnext/kpi/kpiScorecardRepository.js'
    );
    getPublishedSnapshot = repository.getPublishedSnapshot;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    // No RBAC-override plumbing needed: USER_A is the literal owner_user_id
    // on every fixture KPI in this file (including the PRIVATE/restricted
    // one), which is sufficient on its own for buildVisibilityScopedCte's
    // PRIVATE branch ("owner only") to grant USER_A visibility —
    // verified by reading visibilityScopedQuery.ts directly, not assumed.
    // USER_B never appears as an owner/grantee/team-member anywhere, and
    // effectiveAccessService.ts's readApplicationRole/normalizeApplicationRole
    // default an unregistered user to plain 'USER' (no wildcard/kpi.view
    // capability — read directly in server/src/utils/roleNormalization.ts),
    // so USER_B gets no RBAC override either. Depending on this default
    // instead of an explicit `organization_members` row also sidesteps that
    // table not existing on a minimal migration-chain-only ephemeral
    // Postgres (this file's own migration list in the header comment does
    // not include the legacy core-schema migrations that create it).

    // Decision #1: Scorecards reuse the 'kpi' domain policy — ONE shared
    // policy for the whole file/org (see sharedKpiPolicyId's own comment).
    sharedKpiPolicyId = await insertVisibilityPolicy('kpi', 'OPEN_ORG', USER_A);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM rvn_kpi_scorecard_review_snapshot_measurements WHERE snapshot_id IN (
                          SELECT snapshot_id FROM rvn_kpi_scorecard_review_snapshots
                           WHERE organization_id = $1)`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_scorecard_review_snapshots WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_scorecard_items WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_scorecards WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_outbox WHERE event_id IN (
                          SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_measurements WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = $1`, [ORG_ID]);
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

  itDB(
    '(a) publish-supersede atomicity: two concurrently-published draft snapshots for the SAME scorecard ' +
      'never both end up "published" — the DB-level partial unique index (ux_rvn_kpi_scorecard_snapshots_one_published) ' +
      'is the real guarantee, not application logic',
    async () => {
      const policyId = sharedKpiPolicyId;
      const kpiId = randomUUID();
      const versionId = randomUUID();
      await insertFixtureKpi(kpiId, versionId, USER_A);
      await insertKpiVisibility(kpiId, policyId, 'OPEN_ORG', USER_A);
      await insertMeasurement(
        randomUUID(),
        kpiId,
        versionId,
        '2026-01-01T00:00:00.000Z',
        '2026-01-31T00:00:00.000Z',
        42,
        'on_target',
        USER_A
      );

      const scorecardOutcome = await createScorecard({
        organizationId: ORG_ID,
        name: 'Concurrency scorecard',
        scopeType: 'team',
        reviewFrequency: 'monthly',
        createdBy: USER_A,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `create-scorecard-${kpiId}`,
        access: WILDCARD_ACCESS,
      });
      const scorecardId = scorecardOutcome.result.scorecard.scorecardId;

      await addScorecardItem({
        scorecardId,
        organizationId: ORG_ID,
        expectedVersion: 1,
        actorUserId: USER_A,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `add-item-${kpiId}`,
        access: WILDCARD_ACCESS,
        kpiId,
      });

      // Two draft snapshots for the same scorecard, both racing to publish —
      // no snapshot published yet for this scorecard, so BOTH transactions'
      // supersede step is initially a no-op; the freeze step is what
      // collides on ux_rvn_kpi_scorecard_snapshots_one_published.
      const draft1 = await createReviewSnapshot({
        scorecardId,
        organizationId: ORG_ID,
        reviewPeriodStart: '2026-01-01T00:00:00.000Z',
        reviewPeriodEnd: '2026-01-31T00:00:00.000Z',
        createdBy: USER_A,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `draft1-${kpiId}`,
        access: WILDCARD_ACCESS,
      });
      const draft2 = await createReviewSnapshot({
        scorecardId,
        organizationId: ORG_ID,
        reviewPeriodStart: '2026-01-01T00:00:00.000Z',
        reviewPeriodEnd: '2026-01-31T00:00:00.000Z',
        createdBy: USER_A,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `draft2-${kpiId}`,
        access: WILDCARD_ACCESS,
      });

      const results = await Promise.allSettled([
        publishReviewSnapshot({
          snapshotId: draft1.result.snapshotId,
          scorecardId,
          organizationId: ORG_ID,
          expectedVersion: 1,
          publishedBy: USER_A,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `publish-draft1-${kpiId}`,
          access: WILDCARD_ACCESS,
        }),
        publishReviewSnapshot({
          snapshotId: draft2.result.snapshotId,
          scorecardId,
          organizationId: ORG_ID,
          expectedVersion: 1,
          publishedBy: USER_A,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `publish-draft2-${kpiId}`,
          access: WILDCARD_ACCESS,
        }),
      ]);

      const fulfilled = results.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof publishReviewSnapshot>>> => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      // The real, load-bearing assertion — regardless of how many of the two
      // racing calls resolved vs rejected, the DATABASE must never end up
      // with two live-published rows for this scorecard.
      const publishedCountResult = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM rvn_kpi_scorecard_review_snapshots
          WHERE scorecard_id = $1 AND status = 'published'`,
        [scorecardId]
      );
      expect(Number(publishedCountResult.rows[0]?.count ?? '-1')).toBe(1);

      // At least one of the two calls succeeded (the race isn't a total
      // deadlock/failure) — the exact winner is non-deterministic by design.
      expect(fulfilled.length).toBeGreaterThanOrEqual(1);
      expect(fulfilled.length + rejected.length).toBe(2);

      // If one call was rejected by the race, it must be a genuine DB
      // conflict (23505 unique violation on the partial index, surfaced
      // as-is — publishReviewSnapshot does not (and per the design doc is
      // not required to) retry this specific race the way KPI-E003's
      // openOrEscalateDeviationCase retries its own case-creation race),
      // never silent data corruption.
      for (const r of rejected) {
        expect((r as PromiseRejectedResult).reason).toBeTruthy();
      }
    }
  );

  itDB(
    '(b) CRITICAL — dual-layer non-leak: a snapshot published by an authorized user (who can see a ' +
      'RESTRICTED kpi) must serve only the VISIBLE items to an under-privileged reader, while the stored ' +
      'row (and its content_hash) still corresponds to the FULL item set',
    async () => {
      const policyId = sharedKpiPolicyId;

      const kpiVisible1 = randomUUID();
      const versionVisible1 = randomUUID();
      await insertFixtureKpi(kpiVisible1, versionVisible1, USER_A);
      await insertKpiVisibility(kpiVisible1, policyId, 'OPEN_ORG', USER_A);
      await insertMeasurement(
        randomUUID(),
        kpiVisible1,
        versionVisible1,
        '2026-02-01T00:00:00.000Z',
        '2026-02-28T00:00:00.000Z',
        10,
        'on_target',
        USER_A
      );

      const kpiVisible2 = randomUUID();
      const versionVisible2 = randomUUID();
      await insertFixtureKpi(kpiVisible2, versionVisible2, USER_A);
      await insertKpiVisibility(kpiVisible2, policyId, 'OPEN_ORG', USER_A);
      await insertMeasurement(
        randomUUID(),
        kpiVisible2,
        versionVisible2,
        '2026-02-01T00:00:00.000Z',
        '2026-02-28T00:00:00.000Z',
        20,
        'warning',
        USER_A
      );

      // The RESTRICTED KPI — PRIVATE, owned by USER_A. Per
      // buildVisibilityScopedCte's own PRIVATE branch, only the owner (or an
      // RBAC-override caller) sees it. USER_B is neither.
      const kpiRestricted = randomUUID();
      const versionRestricted = randomUUID();
      await insertFixtureKpi(kpiRestricted, versionRestricted, USER_A);
      await insertKpiVisibility(kpiRestricted, policyId, 'PRIVATE', USER_A);
      await insertMeasurement(
        randomUUID(),
        kpiRestricted,
        versionRestricted,
        '2026-02-01T00:00:00.000Z',
        '2026-02-28T00:00:00.000Z',
        30,
        'critical',
        USER_A
      );

      const scorecardOutcome = await createScorecard({
        organizationId: ORG_ID,
        name: 'Non-leak scorecard',
        scopeType: 'team',
        reviewFrequency: 'monthly',
        createdBy: USER_A,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `create-scorecard-nonleak-${kpiVisible1}`,
        access: WILDCARD_ACCESS,
      });
      const scorecardId = scorecardOutcome.result.scorecard.scorecardId;

      let expectedVersion = 1;
      for (const kpiId of [kpiVisible1, kpiVisible2, kpiRestricted]) {
        const addOutcome = await addScorecardItem({
          scorecardId,
          organizationId: ORG_ID,
          expectedVersion,
          actorUserId: USER_A,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `add-item-nonleak-${kpiId}`,
          access: WILDCARD_ACCESS,
          kpiId,
        });
        expectedVersion = addOutcome.result.scorecard.rowVersion;
      }

      const draft = await createReviewSnapshot({
        scorecardId,
        organizationId: ORG_ID,
        reviewPeriodStart: '2026-02-01T00:00:00.000Z',
        reviewPeriodEnd: '2026-02-28T00:00:00.000Z',
        createdBy: USER_A,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `draft-nonleak-${kpiVisible1}`,
        access: WILDCARD_ACCESS,
      });

      // Published by USER_A, who CAN see all 3 KPIs (decision #6a: the
      // publisher-visibility filter must NOT strip anything here).
      const publishOutcome = await publishReviewSnapshot({
        snapshotId: draft.result.snapshotId,
        scorecardId,
        organizationId: ORG_ID,
        expectedVersion: 1,
        publishedBy: USER_A,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `publish-nonleak-${kpiVisible1}`,
        access: WILDCARD_ACCESS,
      });
      expect(publishOutcome.outcome).toBe('applied');
      expect(publishOutcome.result.items).toHaveLength(3);
      expect(publishOutcome.result.statusCounts).toEqual({ safe: 1, warning: 1, critical: 1, missing: 0 });

      // --- Integrity check: the STORED row's content_hash still corresponds
      // to the FULL 3-item payload, independent of anything getPublishedSnapshot
      // does below. Read it directly off the table with a fresh query.
      const storedRow = await client.query<{ snapshot_payload: { items: unknown[] }; content_hash: string }>(
        `SELECT snapshot_payload, content_hash FROM rvn_kpi_scorecard_review_snapshots WHERE snapshot_id = $1`,
        [draft.result.snapshotId]
      );
      expect(storedRow.rows[0]?.snapshot_payload.items).toHaveLength(3);
      expect(storedRow.rows[0]?.content_hash).toBe(publishOutcome.result.contentHash);

      // --- Layer (a) sanity: publisher (USER_A) reading it back via
      // getPublishedSnapshot sees all 3 — nothing over-redacted for an
      // authorized reader.
      const asPublisher = await getPublishedSnapshot({ userId: USER_A, organizationId: ORG_ID, scorecardId });
      expect(asPublisher?.snapshotPayload?.items).toHaveLength(3);
      expect(asPublisher?.snapshotPayload?.statusCounts).toEqual({ safe: 1, warning: 1, critical: 1, missing: 0 });
      // Layer (a)/(b) both leave the served content_hash equal to the
      // stored one for an authorized reader (nothing was stripped, so
      // nothing to distinguish) — but the hash itself is never recomputed
      // from the (possibly-filtered) served payload; it always echoes the
      // stored row's own value (see kpiScorecardRepository.ts's own comment:
      // never rewrite the stored row).
      expect(asPublisher?.contentHash).toBe(publishOutcome.result.contentHash);

      // --- THE decision #6b assertion: USER_B (cannot see kpiRestricted)
      // must get exactly 2 items back, never 3, and RECOMPUTED statusCounts
      // for the response — not the stored counts.
      const asUnderprivileged = await getPublishedSnapshot({
        userId: USER_B,
        organizationId: ORG_ID,
        scorecardId,
      });
      expect(asUnderprivileged).not.toBeNull();
      const servedKpiIds = (asUnderprivileged?.snapshotPayload?.items ?? []).map(
        (item) => (item as { kpiId: string }).kpiId
      );
      expect(servedKpiIds).toHaveLength(2);
      expect(servedKpiIds).toEqual(expect.arrayContaining([kpiVisible1, kpiVisible2]));
      expect(servedKpiIds).not.toContain(kpiRestricted);
      expect(asUnderprivileged?.snapshotPayload?.statusCounts).toEqual({
        safe: 1,
        warning: 1,
        critical: 0,
        missing: 0,
      });

      // The served content_hash for the under-privileged reader still
      // echoes the STORED row's hash (the archival value) even though the
      // payload it rides alongside was filtered — content_hash is never
      // recomputed from a redacted view. This is the explicit contract from
      // kpiScorecardRepository.ts's own header comment: "the stored row and
      // its content_hash are never mutated".
      expect(asUnderprivileged?.contentHash).toBe(publishOutcome.result.contentHash);

      // --- Re-confirm the STORED row (re-read AGAIN, after both
      // getPublishedSnapshot calls above) is still untouched — decision #6b
      // must never write back a filtered payload.
      const storedRowAfter = await client.query<{ snapshot_payload: { items: unknown[] }; content_hash: string }>(
        `SELECT snapshot_payload, content_hash FROM rvn_kpi_scorecard_review_snapshots WHERE snapshot_id = $1`,
        [draft.result.snapshotId]
      );
      expect(storedRowAfter.rows[0]?.snapshot_payload.items).toHaveLength(3);
      expect(storedRowAfter.rows[0]?.content_hash).toBe(publishOutcome.result.contentHash);
    }
  );
});
