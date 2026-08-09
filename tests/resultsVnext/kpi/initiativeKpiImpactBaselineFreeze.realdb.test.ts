/**
 * KPI-E005 — InitiativeKPIImpact baseline-freeze REAL-Postgres coverage
 * (design §C: `trg_rvn_kpi_initiative_impacts_protect_baseline`).
 *
 * Exercises `proposeInitiativeKpiImpact`/`commitInitiativeKpiImpact` against
 * a real Postgres 16, then asserts the DB TRIGGER itself (not application
 * code) genuinely rejects a direct UPDATE that mutates a frozen baseline
 * column once the impact has left 'proposed' — the exact requirement the
 * per-package brief calls out ("trigger faktycznie blokuje mutację baseline
 * po commitment").
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * directory — silent no-op without a configured database, `beforeAll`
 * throws if configured-but-unreachable.
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
const ORG_ID = `kpi-e005-baseline-freeze-org-${tag}`;
const USER_OWNER = `kpi-e005-baseline-freeze-owner-${tag}`;
const INITIATIVE_ID = `kpi-e005-baseline-freeze-init-${tag}`;

let client: Client;
let reachable = false;

type CommandsModule =
  typeof import('../../../server/src/services/resultsVnext/kpi/kpiInitiativeImpactCommands.js');
let proposeInitiativeKpiImpact: CommandsModule['proposeInitiativeKpiImpact'];
let commitInitiativeKpiImpact: CommandsModule['commitInitiativeKpiImpact'];

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

async function insertFixtureKpiWithMeasurement(
  kpiId: string,
  versionId: string,
  measurementId: string,
  policyId: string,
  ownerUserId: string,
  actualValue: number
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
  await client.query(
    `INSERT INTO rvn_platform_resource_visibility
       (resource_type, resource_id, organization_id, visibility_mode, policy_id, owner_user_id)
     VALUES ('kpi', $1, $2, 'OPEN_ORG', $3, $4)`,
    [kpiId, ORG_ID, policyId, ownerUserId]
  );
  await client.query(
    `INSERT INTO rvn_kpi_measurements
       (measurement_id, kpi_id, definition_version_id, organization_id, period_start, period_end,
        actual_value, performance_status, source, recorded_by)
     VALUES ($1, $2, $3, $4, now() - interval '30 days', now(), $5, 'on_target', 'manual', $6)`,
    [measurementId, kpiId, versionId, ORG_ID, actualValue, ownerUserId]
  );
}

describe('KPI-E005 InitiativeKPIImpact — baseline freeze trigger (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — initiativeKpiImpactBaselineFreeze realdb tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_kpi_initiative_impacts LIMIT 0');
      await client.query(
        `CREATE TABLE IF NOT EXISTS initiatives (
           id TEXT PRIMARY KEY,
           organization_id TEXT NOT NULL,
           name TEXT NOT NULL
         )`
      );
      await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
        INITIATIVE_ID,
        ORG_ID,
        'Baseline-freeze fixture initiative',
      ]);
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the KPI-E005 schema/initiatives fixture); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const commands: CommandsModule = await import(
      '../../../server/src/services/resultsVnext/kpi/kpiInitiativeImpactCommands.js'
    );
    proposeInitiativeKpiImpact = commands.proposeInitiativeKpiImpact;
    commitInitiativeKpiImpact = commands.commitInitiativeKpiImpact;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM link_graph_edges WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_initiative_impacts WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_measurements WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `UPDATE rvn_kpi_definitions SET current_definition_version_id = NULL WHERE organization_id = $1`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_definition_versions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_definitions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
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
    'trg_rvn_kpi_initiative_impacts_protect_baseline genuinely blocks a direct UPDATE mutating ' +
      'baseline_value_at_commitment once the impact is committed, but allows reviewed_attribution_value',
    async () => {
      const policyId = await insertVisibilityPolicy('kpi', 'OPEN_ORG', USER_OWNER);
      const kpiId = randomUUID();
      const versionId = randomUUID();
      const measurementId = randomUUID();
      await insertFixtureKpiWithMeasurement(kpiId, versionId, measurementId, policyId, USER_OWNER, 88);

      const proposeOutcome = await proposeInitiativeKpiImpact({
        organizationId: ORG_ID,
        kpiId,
        initiativeId: INITIATIVE_ID,
        expectedContributionValue: 10,
        expectedContributionDirection: 'increase',
        targetCompletionDate: null,
        proposedBy: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `propose-${kpiId}`,
      });
      expect(proposeOutcome.result.impact.status).toBe('proposed');

      const commitOutcome = await commitInitiativeKpiImpact({
        organizationId: ORG_ID,
        impactId: proposeOutcome.result.impact.impactId,
        expectedVersion: proposeOutcome.result.impact.rowVersion,
        committedBy: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `commit-${kpiId}`,
      });
      expect(commitOutcome.result.impact.status).toBe('committed');
      expect(commitOutcome.result.impact.baselineMeasurementId).toBe(measurementId);
      expect(commitOutcome.result.impact.baselineValueAtCommitment).toBe(88);

      // THE assertion: the DB TRIGGER (not application code) rejects a
      // direct UPDATE mutating a frozen baseline column, error code 23001.
      await expect(
        client.query(
          `UPDATE rvn_kpi_initiative_impacts SET baseline_value_at_commitment = 999 WHERE impact_id = $1`,
          [proposeOutcome.result.impact.impactId]
        )
      ).rejects.toMatchObject({ code: '23001' });

      await expect(
        client.query(
          `UPDATE rvn_kpi_initiative_impacts SET committed_by = 'someone-else' WHERE impact_id = $1`,
          [proposeOutcome.result.impact.impactId]
        )
      ).rejects.toMatchObject({ code: '23001' });

      // Non-baseline columns remain writable after commitment (the trigger
      // is scoped, not a blanket freeze) — reviewed_attribution_value is
      // explicitly NOT in the protected column list.
      await client.query(
        `UPDATE rvn_kpi_initiative_impacts SET reviewed_attribution_value = 42 WHERE impact_id = $1`,
        [proposeOutcome.result.impact.impactId]
      );
      const reread = await client.query<{ reviewed_attribution_value: string }>(
        `SELECT reviewed_attribution_value FROM rvn_kpi_initiative_impacts WHERE impact_id = $1`,
        [proposeOutcome.result.impact.impactId]
      );
      expect(Number(reread.rows[0]?.reviewed_attribution_value)).toBe(42);

      // The baseline itself, re-read from the DB, is untouched by any of
      // the rejected attempts above.
      const finalBaseline = await client.query<{ baseline_value_at_commitment: string }>(
        `SELECT baseline_value_at_commitment FROM rvn_kpi_initiative_impacts WHERE impact_id = $1`,
        [proposeOutcome.result.impact.impactId]
      );
      expect(Number(finalBaseline.rows[0]?.baseline_value_at_commitment)).toBe(88);
    }
  );
});
