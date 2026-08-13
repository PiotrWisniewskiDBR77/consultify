/**
 * KPI-E005 Perspectives & Links HTTP layer package — direct real-Postgres
 * coverage for the repository/command functions this package's new
 * `kpiPerspectives.routes.ts` calls for the FIRST time.
 *
 * Per EXECUTION_LEDGER.md §24's lesson ("KAŻDA funkcja repository użyta w
 * tym pakiecie musi mieć OSOBNY, bezpośredni test na realnym Postgresie, nie
 * tylko zmockowaną trasę") this file closes the gap the route's own HTTP-
 * boundary test (`kpiPerspectives.routes.test.ts`, which mocks the whole
 * repository/command modules) cannot close:
 *
 * - `listInitiativeImpactsForKpi` / `listKpiImpactsForInitiative`
 *   (`kpiInitiativeImpactRepository.ts`) — ZERO prior test coverage
 *   anywhere (grepped `tests/` and `server/src` before writing this file:
 *   no hits outside the repository's own source). This is their FIRST
 *   direct-on-Postgres exercise of the `INNER JOIN rvn_visible_resources`
 *   / `kpi_id::text` cast the file's own header comment documents as
 *   required (same bug class as EXECUTION_LEDGER.md §24).
 * - `recordReviewedAttribution` — previously only unit-tested against a
 *   fake `PoolClient` (`tests/resultsVnext/kpi/initiativeKpiImpactCommands
 *   .test.ts`). This file exercises the self-approval-denial guard AND the
 *   successful path against a real UPDATE/CAS on real Postgres.
 * - `supersedeInitiativeKpiImpact` — previously had NO test coverage at
 *   all (grepped `tests/`: only a comment mentions it in passing). This
 *   file is its first exercise anywhere, including the partial unique
 *   index dance (`ux_rvn_kpi_initiative_impacts_one_active`) its own doc
 *   comment describes (old row flipped to 'superseded' BEFORE the new
 *   'proposed' row is inserted, in the same transaction).
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * directory — if no database is configured, every scenario is a silent
 * no-op and this file reports green (NOT evidence). If a database IS
 * configured but unreachable (or missing the KPI-E005 schema), `beforeAll`
 * throws rather than reporting a false-green run.
 *
 * HOW TO RUN FOR REAL: point DATABASE_URL (or DB_HOST/...) at a Postgres 16
 * with server/migrations/20260303_link_graph_v3.sql,
 * 20260809_rvn_platform_*.sql, 20260810_rvn_kpi_core.sql,
 * 20260811_rvn_kpi_deviation_loop.sql, 20260811_rvn_platform_obligations.sql,
 * 20260812_rvn_kpi_scorecards.sql, 20260813_rvn_kpi_measurement_cadence.sql,
 * 20260813_rvn_kpi_initiative_impacts.sql applied (plus a minimal
 * `initiatives(id TEXT PRIMARY KEY, organization_id TEXT, name TEXT)`
 * fixture table ahead of the last migration — same self-contained fixture
 * every sibling realdb test in this directory already uses, real
 * `migrations-v2/001_baseline_20260413.sql` needs the `vector` extension,
 * unavailable in this environment).
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ensureKpiFixtureOrganization } from './kpiRealdbOrgFixture.js';

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
const ORG_ID = `kpi-e005-routes-org-${tag}`;
const OWNER = `kpi-e005-routes-owner-${tag}`; // KPI owner, proposer, committer
const REVIEWER = `kpi-e005-routes-reviewer-${tag}`; // reviews the impact (differs from committedBy)
const OUTSIDER = `kpi-e005-routes-outsider-${tag}`; // no RBAC override, not the owner
const INITIATIVE_ID = `kpi-e005-routes-init-${tag}`;

let client: Client;
let reachable = false;

type CommandsModule =
  typeof import('../../../server/src/services/resultsVnext/kpi/kpiInitiativeImpactCommands.js');
type RepoModule =
  typeof import('../../../server/src/services/resultsVnext/kpi/kpiInitiativeImpactRepository.js');

let proposeInitiativeKpiImpact: CommandsModule['proposeInitiativeKpiImpact'];
let commitInitiativeKpiImpact: CommandsModule['commitInitiativeKpiImpact'];
let recordReviewedAttribution: CommandsModule['recordReviewedAttribution'];
let supersedeInitiativeKpiImpact: CommandsModule['supersedeInitiativeKpiImpact'];
let InitiativeKpiImpactSelfApprovalDeniedError: CommandsModule['InitiativeKpiImpactSelfApprovalDeniedError'];
let listInitiativeImpactsForKpi: RepoModule['listInitiativeImpactsForKpi'];
let listKpiImpactsForInitiative: RepoModule['listKpiImpactsForInitiative'];

/** ONE 'kpi'-domain PRIVATE policy for the whole org, created once in
 * `beforeAll` and reused by every scenario below — `rvn_platform_visibility
 * _policies` has a `(organization_id, domain, policy_version)` unique
 * constraint, so calling this per-scenario (as an earlier draft of this
 * file did) collides on the second `it()`. Each scenario still gets its
 * OWN fresh `kpi_id`/impact rows, just under the same policy. */
let privatePolicyId: string;

async function insertVisibilityPolicy(mode: string, createdBy: string): Promise<string> {
  const result = await client.query<{ policy_id: string }>(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, 'kpi', 1, $2, true, $3)
     RETURNING policy_id`,
    [ORG_ID, mode, createdBy]
  );
  return result.rows[0]!.policy_id;
}

/** A PRIVATE KPI (visible only to `ownerUserId`) — the non-leak scenario
 * `listInitiativeImpactsForKpi`/`listKpiImpactsForInitiative` are checked
 * against below, same shape `organizationKpiAttention.realdb.test.ts` uses
 * for its own PRIVATE-KPI non-leak scenario. */
async function insertPrivateFixtureKpi(
  kpiId: string,
  versionId: string,
  policyId: string,
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
     VALUES ($1, $2, $3, 1, 'Routes fixture KPI', 'unit', 'threshold_min', 100, 'approved', $4, now())`,
    [versionId, kpiId, ORG_ID, ownerUserId]
  );
  await client.query(`UPDATE rvn_kpi_definitions SET current_definition_version_id = $1 WHERE kpi_id = $2`, [
    versionId,
    kpiId,
  ]);
  await client.query(
    `INSERT INTO rvn_platform_resource_visibility
       (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
     VALUES ('kpi', $1, $2, 'PRIVATE', $3, $4)`,
    [kpiId, ORG_ID, policyId, ownerUserId]
  );
}

describe('KPI-E005 Perspectives routes package — direct repository/command real-Postgres coverage', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — kpiInitiativeImpactPerspectivesRoutesRealdb tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_kpi_initiative_impacts LIMIT 0');
      // `initiatives.organization_id` carries a real FK to `organizations(id)`
      // on a fully-migrated schema, which makes the defensive
      // `CREATE TABLE IF NOT EXISTS initiatives` below a no-op rather than the
      // stub it looks like — so the organization row has to exist first.
      await ensureKpiFixtureOrganization(client, ORG_ID, 'kpiInitiativeImpactPerspectivesRoutes realdb fixture org');
      await client.query(
        `CREATE TABLE IF NOT EXISTS initiatives (
           id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL
         )`
      );
      // buildVisibilityScopedCte's SCOPE branch always references
      // team_members regardless of which visibility_mode a given resource
      // actually uses — same self-contained fixture every sibling realdb
      // test in this directory creates for the same reason.
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id)
         )`
      );
      await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
        INITIATIVE_ID,
        ORG_ID,
        'Perspectives routes fixture initiative',
      ]);
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the KPI-E005 schema/initiatives fixture); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    privatePolicyId = await insertVisibilityPolicy('PRIVATE', OWNER);

    const commands: CommandsModule = await import(
      '../../../server/src/services/resultsVnext/kpi/kpiInitiativeImpactCommands.js'
    );
    proposeInitiativeKpiImpact = commands.proposeInitiativeKpiImpact;
    commitInitiativeKpiImpact = commands.commitInitiativeKpiImpact;
    recordReviewedAttribution = commands.recordReviewedAttribution;
    supersedeInitiativeKpiImpact = commands.supersedeInitiativeKpiImpact;
    InitiativeKpiImpactSelfApprovalDeniedError = commands.InitiativeKpiImpactSelfApprovalDeniedError;

    const repo: RepoModule = await import(
      '../../../server/src/services/resultsVnext/kpi/kpiInitiativeImpactRepository.js'
    );
    listInitiativeImpactsForKpi = repo.listInitiativeImpactsForKpi;
    listKpiImpactsForInitiative = repo.listKpiImpactsForInitiative;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM link_graph_edges WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_initiative_impacts WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_outbox
       WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_measurements WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
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

  itDB(
    'listInitiativeImpactsForKpi / listKpiImpactsForInitiative: owner of a PRIVATE KPI sees the ' +
      'impact, an outsider with no RBAC override sees nothing (non-leak, real INNER JOIN + ::text cast)',
    async () => {
      const kpiId = randomUUID();
      const versionId = randomUUID();
      await insertPrivateFixtureKpi(kpiId, versionId, privatePolicyId, OWNER);

      const proposeOutcome = await proposeInitiativeKpiImpact({
        organizationId: ORG_ID,
        kpiId,
        initiativeId: INITIATIVE_ID,
        expectedContributionValue: 5,
        expectedContributionDirection: 'increase',
        targetCompletionDate: null,
        proposedBy: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `routes-propose-${kpiId}`,
      });
      expect(proposeOutcome.outcome).toBe('applied');
      const impactId = proposeOutcome.result.impact.impactId;

      // ---- Owner sees it via BOTH read paths ----
      const ownerByKpi = await listInitiativeImpactsForKpi({
        userId: OWNER,
        organizationId: ORG_ID,
        kpiId,
      });
      expect(ownerByKpi.map((i) => i.impactId)).toContain(impactId);
      expect(typeof ownerByKpi[0]?.kpiId).toBe('string');

      const ownerByInitiative = await listKpiImpactsForInitiative({
        userId: OWNER,
        organizationId: ORG_ID,
        initiativeId: INITIATIVE_ID,
      });
      expect(ownerByInitiative.map((i) => i.impactId)).toContain(impactId);

      // ---- Outsider (no RBAC override, not the owner) sees NOTHING —
      // the impact's visibility is inherited from the PRIVATE kpi_id, T3
      // non-leak must apply on both read paths. ----
      const outsiderByKpi = await listInitiativeImpactsForKpi({
        userId: OUTSIDER,
        organizationId: ORG_ID,
        kpiId,
      });
      expect(outsiderByKpi).toHaveLength(0);

      const outsiderByInitiative = await listKpiImpactsForInitiative({
        userId: OUTSIDER,
        organizationId: ORG_ID,
        initiativeId: INITIATIVE_ID,
      });
      expect(outsiderByInitiative.find((i) => i.impactId === impactId)).toBeUndefined();

      // ---- status filter narrows correctly on the real query ----
      const filteredWrongStatus = await listInitiativeImpactsForKpi({
        userId: OWNER,
        organizationId: ORG_ID,
        kpiId,
        status: 'committed',
      });
      expect(filteredWrongStatus.find((i) => i.impactId === impactId)).toBeUndefined();
      const filteredRightStatus = await listInitiativeImpactsForKpi({
        userId: OWNER,
        organizationId: ORG_ID,
        kpiId,
        status: 'proposed',
      });
      expect(filteredRightStatus.map((i) => i.impactId)).toContain(impactId);
    }
  );

  itDB(
    'recordReviewedAttribution: self-approval denied for real on Postgres (reviewedBy === committedBy), ' +
      'succeeds and flips committed -> realized_reviewed when reviewedBy differs',
    async () => {
      const kpiId = randomUUID();
      const versionId = randomUUID();
      await insertPrivateFixtureKpi(kpiId, versionId, privatePolicyId, OWNER);

      const proposeOutcome = await proposeInitiativeKpiImpact({
        organizationId: ORG_ID,
        kpiId,
        initiativeId: INITIATIVE_ID,
        expectedContributionValue: 3,
        expectedContributionDirection: 'increase',
        targetCompletionDate: null,
        proposedBy: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `routes-review-propose-${kpiId}`,
      });
      const impactId = proposeOutcome.result.impact.impactId;

      const commitOutcome = await commitInitiativeKpiImpact({
        organizationId: ORG_ID,
        impactId,
        expectedVersion: proposeOutcome.result.impact.rowVersion,
        committedBy: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `routes-review-commit-${kpiId}`,
      });
      expect(commitOutcome.result.impact.status).toBe('committed');

      // ---- Self-approval denial, for real: reviewedBy === committedBy ----
      await expect(
        recordReviewedAttribution({
          organizationId: ORG_ID,
          impactId,
          expectedVersion: commitOutcome.result.impact.rowVersion,
          reviewedAttributionValue: 4,
          reviewedAttributionMeasurementId: null,
          reviewRationale: 'self review attempt',
          reviewedBy: OWNER,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `routes-review-self-${kpiId}`,
        })
      ).rejects.toBeInstanceOf(InitiativeKpiImpactSelfApprovalDeniedError);

      // DB row unchanged by the rejected attempt.
      const unchangedRow = await client.query(
        `SELECT status, row_version, reviewed_by FROM rvn_kpi_initiative_impacts WHERE impact_id = $1`,
        [impactId]
      );
      expect(unchangedRow.rows[0].status).toBe('committed');
      expect(unchangedRow.rows[0].row_version).toBe(commitOutcome.result.impact.rowVersion);
      expect(unchangedRow.rows[0].reviewed_by).toBeNull();

      // ---- Real success path: reviewedBy differs from committedBy ----
      const reviewOutcome = await recordReviewedAttribution({
        organizationId: ORG_ID,
        impactId,
        expectedVersion: commitOutcome.result.impact.rowVersion,
        reviewedAttributionValue: 4,
        reviewedAttributionMeasurementId: null,
        reviewRationale: 'independent review',
        reviewedBy: REVIEWER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `routes-review-real-${kpiId}`,
      });
      expect(reviewOutcome.outcome).toBe('applied');
      expect(reviewOutcome.result.impact.status).toBe('realized_reviewed');
      expect(reviewOutcome.result.impact.reviewedBy).toBe(REVIEWER);

      const finalRow = await client.query(
        `SELECT status, reviewed_by, reviewed_attribution_value FROM rvn_kpi_initiative_impacts WHERE impact_id = $1`,
        [impactId]
      );
      expect(finalRow.rows[0].status).toBe('realized_reviewed');
      expect(finalRow.rows[0].reviewed_by).toBe(REVIEWER);
      expect(Number(finalRow.rows[0].reviewed_attribution_value)).toBe(4);
    }
  );

  itDB(
    'supersedeInitiativeKpiImpact: real Postgres partial-unique-index dance — old row -> superseded ' +
      'with superseded_by_impact_id set, fresh row -> proposed, both in the same (kpi, initiative)',
    async () => {
      const kpiId = randomUUID();
      const versionId = randomUUID();
      await insertPrivateFixtureKpi(kpiId, versionId, privatePolicyId, OWNER);

      const proposeOutcome = await proposeInitiativeKpiImpact({
        organizationId: ORG_ID,
        kpiId,
        initiativeId: INITIATIVE_ID,
        expectedContributionValue: 2,
        expectedContributionDirection: 'decrease',
        targetCompletionDate: null,
        proposedBy: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `routes-supersede-propose-${kpiId}`,
      });
      const originalImpactId = proposeOutcome.result.impact.impactId;

      const supersedeOutcome = await supersedeInitiativeKpiImpact({
        organizationId: ORG_ID,
        impactId: originalImpactId,
        expectedVersion: proposeOutcome.result.impact.rowVersion,
        replacementInput: {
          expectedContributionValue: 6,
          expectedContributionDirection: 'increase',
          targetCompletionDate: null,
          proposedBy: OWNER,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `routes-supersede-replacement-${kpiId}`,
        },
        actorUserId: OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `routes-supersede-${kpiId}`,
      });

      expect(supersedeOutcome.outcome).toBe('applied');
      expect(supersedeOutcome.result.superseded.impactId).toBe(originalImpactId);
      expect(supersedeOutcome.result.superseded.status).toBe('superseded');
      const replacementImpactId = supersedeOutcome.result.replacement.impactId;
      expect(replacementImpactId).not.toBe(originalImpactId);
      expect(supersedeOutcome.result.replacement.status).toBe('proposed');
      expect(supersedeOutcome.result.superseded.supersededByImpactId).toBe(replacementImpactId);

      // Real rows, queried directly — proves the partial unique index
      // (WHERE status IN ('proposed','committed')) tolerated having BOTH
      // rows present transiently within the same transaction (old flipped
      // to 'superseded' before the new 'proposed' row was inserted).
      const rows = await client.query(
        `SELECT impact_id, status, superseded_by_impact_id, expected_contribution_value
           FROM rvn_kpi_initiative_impacts WHERE kpi_id = $1 AND initiative_id = $2 ORDER BY created_at`,
        [kpiId, INITIATIVE_ID]
      );
      expect(rows.rows).toHaveLength(2);
      const originalRow = rows.rows.find((r) => r.impact_id === originalImpactId);
      const replacementRow = rows.rows.find((r) => r.impact_id === replacementImpactId);
      expect(originalRow?.status).toBe('superseded');
      expect(originalRow?.superseded_by_impact_id).toBe(replacementImpactId);
      expect(replacementRow?.status).toBe('proposed');
      expect(Number(replacementRow?.expected_contribution_value)).toBe(6);

      // Read paths surface only the live (proposed) replacement when
      // filtered by status — history is never edited, only appended.
      const proposedOnly = await listInitiativeImpactsForKpi({
        userId: OWNER,
        organizationId: ORG_ID,
        kpiId,
        status: 'proposed',
      });
      expect(proposedOnly.map((i) => i.impactId)).toEqual([replacementImpactId]);
      const supersededOnly = await listInitiativeImpactsForKpi({
        userId: OWNER,
        organizationId: ORG_ID,
        kpiId,
        status: 'superseded',
      });
      expect(supersededOnly.map((i) => i.impactId)).toEqual([originalImpactId]);
    }
  );
});
