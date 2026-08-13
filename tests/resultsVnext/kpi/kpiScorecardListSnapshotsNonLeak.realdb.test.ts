/**
 * P0-C — `listReviewSnapshots` reader-scoped redaction, against a REAL
 * Postgres.
 *
 * Design: docs/product/results-vnext/RN_G2_OPEN_QUESTIONS_UI.md §OQ-UI-B
 * (closed by this package) + kpiScorecardRepository.ts's own header comment
 * ("P0-C" section) for the mechanism this file proves.
 *
 * THE BUG THIS FILE CLOSES: `listReviewSnapshots` used to return each row's
 * `snapshot_payload` (item facts + statusCounts) exactly as materialized at
 * publish time — filtered only to what the PUBLISHER could see (decision
 * #6a), never re-filtered to the REQUESTING READER's CURRENT visibility.
 * `getPublishedSnapshot` already had that second layer (decision #6b); this
 * function did not. `kpiScorecardRepository.ts`'s `listReviewSnapshots` now
 * shares the exact same `resolveVisibleKpiIdSet`/
 * `redactSnapshotPayloadForReader` mechanism `getPublishedSnapshot` uses —
 * this file is the counterweight proving that fix against a real join, not
 * a mock, exercising ALL of: OPEN_ORG / MANAGEMENT_CHAIN / RESTRICTED_ACL
 * visibility modes, a mid-lifecycle access REVOCATION, cross-tenant
 * isolation, `content_hash` immutability, and scorecard-level ("does this
 * reader even get a row") vs item-level ("which items inside the row")
 * redaction as two independently-enforced layers.
 *
 * SKIP POLICY (same convention as every other `*.realdb.test.ts` in this
 * directory): if no database is configured (no DATABASE_URL/DB_HOST), every
 * scenario below is a silent no-op and this file reports green — that is
 * expected in environments without a Postgres available and is NOT evidence
 * the behavior works. If a database IS configured but unreachable,
 * `beforeAll` throws so this run is never silently green.
 *
 * HOW TO RUN FOR REAL: point DATABASE_URL (or DB_HOST/DB_PORT/DB_NAME/
 * DB_USER/DB_PASSWORD) at a Postgres 16/17 that already has the full
 * `rvn_platform_*`/`rvn_kpi_*` schema applied (run
 * `server/scripts/migrate.postgres.ts`, NOT `--safe`) before importing this
 * file — env vars are read once, at server/src/config/DatabaseConfig.ts's
 * module-load time, so they must be set before ANY transitive import of it.
 * Also requires NODE_ENV=test, RUN_DB_TESTS=1, MOCK_DB=false.
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
const ORG_ID = `p0c-listsnap-org-${tag}`;
const ORG_ID_OTHER = `p0c-listsnap-org-other-${tag}`; // cross-tenant actor's own org
const USER_PUBLISHER = `p0c-listsnap-publisher-${tag}`; // owner of scorecard + every KPI
const USER_MANAGER = `p0c-listsnap-manager-${tag}`; // MANAGEMENT_CHAIN ancestor of PUBLISHER
const USER_READER_PARTIAL = `p0c-listsnap-reader-partial-${tag}`; // ACL-granted on ONE restricted KPI
const USER_READER_REVOKED = `p0c-listsnap-reader-revoked-${tag}`; // ACL-granted, then revoked AFTER publish
const USER_ORG_STRANGER = `p0c-listsnap-org-stranger-${tag}`; // same org, zero access anywhere
const USER_OTHER_ORG_ACTOR = `p0c-listsnap-other-org-actor-${tag}`; // different organization entirely

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
let listReviewSnapshots: RepositoryModule['listReviewSnapshots'];
let closePgPool: (() => Promise<void>) | undefined;
/** One shared 'kpi'-domain policy for the whole file (rvn_platform_visibility_policies
 * has a UNIQUE(organization_id, domain, policy_version) — created ONCE in `beforeAll`,
 * same convention as `scorecardPublishNonLeak.realdb.test.ts`'s `sharedKpiPolicyId`,
 * so a local-mode vitest retry of a failed `it` (this repo's default: `retry: 1`
 * outside CI) does not attempt a second INSERT and collide on the unique
 * constraint — `beforeAll` runs exactly once regardless of retries). */
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

async function insertFixtureKpi(kpiId: string, versionId: string, ownerUserId: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_kpi_definitions (kpi_id, organization_id, kpi_code, status, owner_user_id, created_by)
     VALUES ($1, $2, $3, 'active', $4, $4)`,
    [kpiId, ORG_ID, `KPI-${kpiId.slice(0, 8)}`, ownerUserId]
  );
  await client.query(
    `INSERT INTO rvn_kpi_definition_versions
       (definition_version_id, kpi_id, organization_id, version_number, name, unit, target_geometry,
        target_min, approval_status, created_by, effective_from)
     VALUES ($1, $2, $3, 1, 'P0-C fixture KPI', 'unit', 'threshold_min', 100, 'approved', $4, now())`,
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
  mode: 'OPEN_ORG' | 'PRIVATE' | 'MANAGEMENT_CHAIN' | 'RESTRICTED_ACL',
  ownerUserId: string
): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_resource_visibility
       (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
     VALUES ('kpi', $1, $2, $3, $4, $5)`,
    [kpiId, ORG_ID, mode, policyId, ownerUserId]
  );
}

async function grantAcl(kpiId: string, granteeUserId: string, grantedBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_resource_acl
       (resource_type, resource_id, grantee_type, grantee_id, access_level, granted_by)
     VALUES ('kpi', $1, 'user', $2, 'view', $3)`,
    [kpiId, granteeUserId, grantedBy]
  );
}

async function revokeAcl(kpiId: string, granteeUserId: string): Promise<void> {
  await client.query(
    `DELETE FROM rvn_platform_resource_acl WHERE resource_type = 'kpi' AND resource_id = $1 AND grantee_id = $2`,
    [kpiId, granteeUserId]
  );
}

async function insertManagementChainEdge(ancestor: string, descendant: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_management_chain_closure (organization_id, ancestor_user_id, descendant_user_id, depth)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT DO NOTHING`,
    [ORG_ID, ancestor, descendant]
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

describe('P0-C — listReviewSnapshots reader-scoped redaction (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — P0-C listReviewSnapshots realdb tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_kpi_scorecards LIMIT 0');
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
    listReviewSnapshots = repository.listReviewSnapshots;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    sharedKpiPolicyId = await insertVisibilityPolicy('kpi', 'OPEN_ORG', USER_PUBLISHER);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(
      `DELETE FROM rvn_kpi_scorecard_review_snapshot_measurements WHERE snapshot_id IN (
         SELECT snapshot_id FROM rvn_kpi_scorecard_review_snapshots WHERE organization_id IN ($1, $2))`,
      [ORG_ID, ORG_ID_OTHER]
    );
    await client.query(`DELETE FROM rvn_kpi_scorecard_review_snapshots WHERE organization_id IN ($1, $2)`, [
      ORG_ID,
      ORG_ID_OTHER,
    ]);
    await client.query(`DELETE FROM rvn_kpi_scorecard_items WHERE organization_id IN ($1, $2)`, [
      ORG_ID,
      ORG_ID_OTHER,
    ]);
    await client.query(`DELETE FROM rvn_kpi_scorecards WHERE organization_id IN ($1, $2)`, [ORG_ID, ORG_ID_OTHER]);
    await client.query(`DELETE FROM rvn_platform_resource_acl WHERE resource_type = 'kpi'`);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id IN ($1, $2)`, [
      ORG_ID,
      ORG_ID_OTHER,
    ]);
    await client.query(`DELETE FROM rvn_platform_management_chain_closure WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (
         SELECT event_id FROM rvn_platform_events WHERE organization_id IN ($1, $2))`,
      [ORG_ID, ORG_ID_OTHER]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id IN ($1, $2)`, [ORG_ID, ORG_ID_OTHER]);
    await client.query(`DELETE FROM rvn_kpi_measurements WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id IN ($1, $2)`, [
      ORG_ID,
      ORG_ID_OTHER,
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
    'item-level redaction across roles, mid-lifecycle revocation, content_hash immutability, ' +
      "and a same-scorecard org stranger's own-visibility-only view — the whole P0-C surface " +
      'on ONE OPEN_ORG scorecard so every role reads the exact same stored row',
    async () => {
      const policyId = sharedKpiPolicyId;

      // MANAGEMENT_CHAIN edge: USER_MANAGER is an ancestor of USER_PUBLISHER
      // — this is what makes USER_MANAGER "a manager" for this fixture's
      // purposes, a REAL visibility relationship, not a role label.
      await insertManagementChainEdge(USER_MANAGER, USER_PUBLISHER);

      // --- KPI_OPEN: OPEN_ORG — every org member (including the plain
      // stranger) sees it.
      const kpiOpen = randomUUID();
      const versionOpen = randomUUID();
      await insertFixtureKpi(kpiOpen, versionOpen, USER_PUBLISHER);
      await insertKpiVisibility(kpiOpen, policyId, 'OPEN_ORG', USER_PUBLISHER);
      await insertMeasurement(
        randomUUID(),
        kpiOpen,
        versionOpen,
        '2026-05-01T00:00:00.000Z',
        '2026-05-31T00:00:00.000Z',
        10,
        'on_target',
        USER_PUBLISHER
      );

      // --- KPI_MGMT: MANAGEMENT_CHAIN, owner=PUBLISHER — visible to
      // PUBLISHER (owner) and MANAGER (ancestor), nobody else.
      const kpiMgmt = randomUUID();
      const versionMgmt = randomUUID();
      await insertFixtureKpi(kpiMgmt, versionMgmt, USER_PUBLISHER);
      await insertKpiVisibility(kpiMgmt, policyId, 'MANAGEMENT_CHAIN', USER_PUBLISHER);
      await insertMeasurement(
        randomUUID(),
        kpiMgmt,
        versionMgmt,
        '2026-05-01T00:00:00.000Z',
        '2026-05-31T00:00:00.000Z',
        20,
        'warning',
        USER_PUBLISHER
      );

      // --- KPI_ACL: RESTRICTED_ACL, owner=PUBLISHER — explicit grants to
      // PUBLISHER/MANAGER/READER_PARTIAL/READER_REVOKED. READER_REVOKED's
      // grant is removed AFTER publish (the mid-lifecycle revocation case).
      const kpiAcl = randomUUID();
      const versionAcl = randomUUID();
      await insertFixtureKpi(kpiAcl, versionAcl, USER_PUBLISHER);
      await insertKpiVisibility(kpiAcl, policyId, 'RESTRICTED_ACL', USER_PUBLISHER);
      await insertMeasurement(
        randomUUID(),
        kpiAcl,
        versionAcl,
        '2026-05-01T00:00:00.000Z',
        '2026-05-31T00:00:00.000Z',
        30,
        'critical',
        USER_PUBLISHER
      );
      for (const grantee of [USER_PUBLISHER, USER_MANAGER, USER_READER_PARTIAL, USER_READER_REVOKED]) {
        await grantAcl(kpiAcl, grantee, USER_PUBLISHER);
      }

      const scorecardOutcome = await createScorecard({
        organizationId: ORG_ID,
        name: 'P0-C listReviewSnapshots scorecard',
        scopeType: 'team',
        reviewFrequency: 'monthly',
        createdBy: USER_PUBLISHER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `p0c-create-scorecard-${kpiOpen}`,
        access: WILDCARD_ACCESS,
      });
      const scorecardId = scorecardOutcome.result.scorecard.scorecardId;

      let expectedVersion = 1;
      for (const kpiId of [kpiOpen, kpiMgmt, kpiAcl]) {
        const addOutcome = await addScorecardItem({
          scorecardId,
          organizationId: ORG_ID,
          expectedVersion,
          actorUserId: USER_PUBLISHER,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `p0c-add-item-${kpiId}`,
          access: WILDCARD_ACCESS,
          kpiId,
        });
        expectedVersion = addOutcome.result.scorecard.rowVersion;
      }

      // A DRAFT snapshot too — snapshot_payload is NULL until publish; must
      // survive redaction as a no-op for every role (never crash on a null
      // payload).
      const draftOnly = await createReviewSnapshot({
        scorecardId,
        organizationId: ORG_ID,
        reviewPeriodStart: '2026-04-01T00:00:00.000Z',
        reviewPeriodEnd: '2026-04-30T00:00:00.000Z',
        createdBy: USER_PUBLISHER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `p0c-draft-only-${kpiOpen}`,
        access: WILDCARD_ACCESS,
      });

      const draft = await createReviewSnapshot({
        scorecardId,
        organizationId: ORG_ID,
        reviewPeriodStart: '2026-05-01T00:00:00.000Z',
        reviewPeriodEnd: '2026-05-31T00:00:00.000Z',
        createdBy: USER_PUBLISHER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `p0c-draft-${kpiOpen}`,
        access: WILDCARD_ACCESS,
      });
      const publishOutcome = await publishReviewSnapshot({
        snapshotId: draft.result.snapshotId,
        scorecardId,
        organizationId: ORG_ID,
        expectedVersion: draft.result.rowVersion,
        publishedBy: USER_PUBLISHER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `p0c-publish-${kpiOpen}`,
        access: WILDCARD_ACCESS,
      });
      expect(publishOutcome.outcome).toBe('applied');
      expect(publishOutcome.result.items).toHaveLength(3);
      const storedContentHash = publishOutcome.result.contentHash;

      // Ground truth, read directly off the table — never touched by any of
      // the reads below.
      const storedRowBefore = await client.query<{
        snapshot_payload: { items: unknown[] };
        content_hash: string;
      }>(`SELECT snapshot_payload, content_hash FROM rvn_kpi_scorecard_review_snapshots WHERE snapshot_id = $1`, [
        draft.result.snapshotId,
      ]);
      expect(storedRowBefore.rows[0]?.snapshot_payload.items).toHaveLength(3);
      expect(storedRowBefore.rows[0]?.content_hash).toBe(storedContentHash);

      function findPublished(rows: Awaited<ReturnType<typeof listReviewSnapshots>>) {
        return rows.find((r) => r.snapshotId === draft.result.snapshotId);
      }

      // --- PUBLISHER: sees all 3 (owner of everything).
      const asPublisher = await listReviewSnapshots({
        userId: USER_PUBLISHER,
        organizationId: ORG_ID,
        scorecardId,
      });
      const publisherRow = findPublished(asPublisher);
      expect(publisherRow?.snapshotPayload?.items.map((i) => i.kpiId).sort()).toEqual(
        [kpiOpen, kpiMgmt, kpiAcl].sort()
      );
      expect(publisherRow?.snapshotPayload?.statusCounts).toEqual({ safe: 1, warning: 1, critical: 1, missing: 0 });
      expect(publisherRow?.contentHash).toBe(storedContentHash);
      // The draft-only row is present too, with a null payload — no crash.
      expect(asPublisher.map((r) => r.snapshotId)).toContain(draftOnly.result.snapshotId);
      expect(asPublisher.find((r) => r.snapshotId === draftOnly.result.snapshotId)?.snapshotPayload).toBeNull();
      for (const row of asPublisher) expect(row.organizationId).toBe(ORG_ID);

      // --- MANAGER: sees all 3 too (OPEN_ORG + ancestor-of-owner +
      // explicit ACL grant) — "widzi to, do czego ma prawo teraz".
      const asManager = await listReviewSnapshots({ userId: USER_MANAGER, organizationId: ORG_ID, scorecardId });
      const managerRow = findPublished(asManager);
      expect(managerRow?.snapshotPayload?.items.map((i) => i.kpiId).sort()).toEqual(
        [kpiOpen, kpiMgmt, kpiAcl].sort()
      );
      expect(managerRow?.contentHash).toBe(storedContentHash);

      // --- READER_PARTIAL: OPEN_ORG + ACL grant, but NOT the
      // MANAGEMENT_CHAIN one — exactly the filtered projection, 2 of 3.
      const asReaderPartial = await listReviewSnapshots({
        userId: USER_READER_PARTIAL,
        organizationId: ORG_ID,
        scorecardId,
      });
      const readerPartialRow = findPublished(asReaderPartial);
      const readerPartialIds = readerPartialRow?.snapshotPayload?.items.map((i) => i.kpiId) ?? [];
      expect(readerPartialIds.sort()).toEqual([kpiOpen, kpiAcl].sort());
      expect(readerPartialIds).not.toContain(kpiMgmt);
      expect(readerPartialRow?.snapshotPayload?.statusCounts).toEqual({
        safe: 1,
        warning: 0,
        critical: 1,
        missing: 0,
      });
      // content_hash still echoes the STORED (full, 3-item) row's hash even
      // though the served payload was filtered to 2 — the archival value
      // never depends on who is asking.
      expect(readerPartialRow?.contentHash).toBe(storedContentHash);

      // --- READER_REVOKED, BEFORE revocation: identical to READER_PARTIAL
      // (2 of 3 — OPEN_ORG + ACL grant).
      const asReaderRevokedBefore = await listReviewSnapshots({
        userId: USER_READER_REVOKED,
        organizationId: ORG_ID,
        scorecardId,
      });
      const revokedBeforeIds =
        findPublished(asReaderRevokedBefore)?.snapshotPayload?.items.map((i) => i.kpiId) ?? [];
      expect(revokedBeforeIds.sort()).toEqual([kpiOpen, kpiAcl].sort());

      // --- THE mid-lifecycle revocation: remove READER_REVOKED's ACL grant
      // on kpiAcl AFTER the snapshot was already published. The STORED row
      // (and its content_hash) must not change — only what is served to
      // THIS reader on THIS subsequent read.
      await revokeAcl(kpiAcl, USER_READER_REVOKED);

      const asReaderRevokedAfter = await listReviewSnapshots({
        userId: USER_READER_REVOKED,
        organizationId: ORG_ID,
        scorecardId,
      });
      const revokedAfterRow = findPublished(asReaderRevokedAfter);
      const revokedAfterIds = revokedAfterRow?.snapshotPayload?.items.map((i) => i.kpiId) ?? [];
      // THE decision #6b/P0-C assertion: kpiAcl's data must be gone from
      // the payload, the metadata counter (statusCounts), AND — since it's
      // simply absent from the array — there is no way to infer it ever
      // existed from the array length alone either.
      expect(revokedAfterIds).toEqual([kpiOpen]);
      expect(revokedAfterIds).not.toContain(kpiAcl);
      expect(revokedAfterRow?.snapshotPayload?.statusCounts).toEqual({
        safe: 1,
        warning: 0,
        critical: 0,
        missing: 0,
      });
      // The critical-status count dropping to 0 (not just the item missing
      // from the array) is the AC #3 "metadata must not leak" check — a
      // reader who never sees kpiAcl must also never see a residual
      // "1 critical" counter that would otherwise prove something hidden
      // exists.
      expect(revokedAfterRow?.contentHash).toBe(storedContentHash);

      // Ground truth re-read AFTER every redacted read above — the STORED
      // row is provably untouched by any of this. This IS the content_hash
      // byte-identity proof the P0-C brief requires.
      const storedRowAfter = await client.query<{
        snapshot_payload: { items: unknown[] };
        content_hash: string;
      }>(`SELECT snapshot_payload, content_hash FROM rvn_kpi_scorecard_review_snapshots WHERE snapshot_id = $1`, [
        draft.result.snapshotId,
      ]);
      expect(storedRowAfter.rows[0]?.snapshot_payload.items).toHaveLength(3);
      expect(storedRowAfter.rows[0]?.content_hash).toBe(storedContentHash);
      expect(storedRowAfter.rows[0]?.content_hash).toBe(storedRowBefore.rows[0]?.content_hash);

      // --- ORG_STRANGER: same org, not owner/ancestor/ACL-grantee on ANY of
      // the 3 KPIs — the ONLY thing that makes ANY item visible to this user
      // is kpiOpen's OPEN_ORG mode (every org member, by definition,
      // including a stranger). The SCORECARD itself is also OPEN_ORG, so the
      // stranger correctly still gets the row (scorecard-level visibility
      // does NOT hide the row's existence — that's a SEPARATE, correctly-
      // behaving gate; see the dedicated scorecard-level-denial scenario
      // below for the case where even the row itself must be hidden). The
      // stranger's payload must therefore be EXACTLY [kpiOpen] — proving
      // item-level redaction narrows the array precisely to what OPEN_ORG
      // grants, not "everything" (the pre-fix bug) and not "nothing" (which
      // would be over-redaction, a different, availability-side bug).
      const asOrgStranger = await listReviewSnapshots({
        userId: USER_ORG_STRANGER,
        organizationId: ORG_ID,
        scorecardId,
      });
      const strangerRow = findPublished(asOrgStranger);
      expect(strangerRow).toBeDefined();
      expect(strangerRow?.snapshotPayload?.items.map((i) => i.kpiId)).toEqual([kpiOpen]);
      expect(strangerRow?.snapshotPayload?.statusCounts).toEqual({ safe: 1, warning: 0, critical: 0, missing: 0 });
      expect(strangerRow?.contentHash).toBe(storedContentHash);

      // --- CROSS-ORG actor: different organization entirely. Every row
      // returned (there must be none) is asserted to belong to ORG_ID —
      // fail-closed by construction, not merely by accident of an empty
      // result.
      const asOtherOrgActor = await listReviewSnapshots({
        userId: USER_OTHER_ORG_ACTOR,
        organizationId: ORG_ID_OTHER,
        scorecardId,
      });
      expect(asOtherOrgActor).toEqual([]);
      for (const row of asOtherOrgActor) expect(row.organizationId).toBe(ORG_ID_OTHER);
    }
  );

  itDB(
    'scorecard-level denial still holds independently of the P0-C item-level fix: a PRIVATE scorecard\'s ' +
      'history is fully invisible (zero ROWS, not merely zero ITEMS) to an org member with no scorecard-level ' +
      'access — the outer visibility gate this fix must not have weakened',
    async () => {
      const scorecardId = randomUUID();
      await client.query(
        `INSERT INTO rvn_kpi_scorecards
           (scorecard_id, organization_id, name, scope_type, owner_user_id, review_frequency, created_by)
         VALUES ($1, $2, 'P0-C private scorecard', 'individual', $3, 'monthly', $3)`,
        [scorecardId, ORG_ID, USER_PUBLISHER]
      );
      // Re-use the ONE shared 'kpi'-domain policy created once in `beforeAll`
      // (UNIQUE(organization_id, domain, policy_version) forbids a second one,
      // and re-inserting per-`it` would also break under vitest's local-mode
      // `retry: 1` — see `sharedKpiPolicyId`'s own comment).
      const policyId = sharedKpiPolicyId;
      await client.query(
        `INSERT INTO rvn_platform_resource_visibility
           (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
         VALUES ('kpi_scorecard', $1, $2, 'PRIVATE', $3, $4)`,
        [scorecardId, ORG_ID, policyId, USER_PUBLISHER]
      );

      const kpiId = randomUUID();
      const versionId = randomUUID();
      await insertFixtureKpi(kpiId, versionId, USER_PUBLISHER);
      await insertKpiVisibility(kpiId, policyId, 'OPEN_ORG', USER_PUBLISHER);
      await insertMeasurement(
        randomUUID(),
        kpiId,
        versionId,
        '2026-06-01T00:00:00.000Z',
        '2026-06-30T00:00:00.000Z',
        1,
        'on_target',
        USER_PUBLISHER
      );

      await addScorecardItem({
        scorecardId,
        organizationId: ORG_ID,
        expectedVersion: 1,
        actorUserId: USER_PUBLISHER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `p0c-private-add-${kpiId}`,
        access: WILDCARD_ACCESS,
        kpiId,
      });
      const draft = await createReviewSnapshot({
        scorecardId,
        organizationId: ORG_ID,
        reviewPeriodStart: '2026-06-01T00:00:00.000Z',
        reviewPeriodEnd: '2026-06-30T00:00:00.000Z',
        createdBy: USER_PUBLISHER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `p0c-private-draft-${kpiId}`,
        access: WILDCARD_ACCESS,
      });
      await publishReviewSnapshot({
        snapshotId: draft.result.snapshotId,
        scorecardId,
        organizationId: ORG_ID,
        expectedVersion: draft.result.rowVersion,
        publishedBy: USER_PUBLISHER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `p0c-private-publish-${kpiId}`,
        access: WILDCARD_ACCESS,
      });

      // Owner still sees it.
      const ownerHistory = await listReviewSnapshots({ userId: USER_PUBLISHER, organizationId: ORG_ID, scorecardId });
      expect(ownerHistory.map((r) => r.snapshotId)).toContain(draft.result.snapshotId);

      // A same-org stranger with NO scorecard-level grant gets NOTHING —
      // zero rows, i.e. this endpoint gives no signal that the scorecard
      // (or its history) exists at all, matching D06 ("nie ujawniać
      // istnienia obiektu").
      const strangerHistory = await listReviewSnapshots({
        userId: USER_ORG_STRANGER,
        organizationId: ORG_ID,
        scorecardId,
      });
      expect(strangerHistory).toEqual([]);
    }
  );
});
