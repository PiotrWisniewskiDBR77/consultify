/**
 * RN-G6-SRV / B3 — the new
 * `GET /api/vnext/results/roi/cases/:caseId/scenarios/:scenarioId/overrides`
 * route (roi.routes.ts, wired to the already-existing
 * `roiEconomicModelRepository.ts::listScenarioOverrides`), against a REAL
 * Postgres.
 *
 * Named the MOST IMPORTANT of the three B3 read gaps in the task brief:
 * before this route, a scenario override could be SET
 * (`POST .../overrides`) and REMOVED (`DELETE .../overrides/:overrideId`)
 * but never READ back through any API. This file proves the underlying,
 * already visibility-scoped repository function the new route now calls
 * actually round-trips a real override row, and that RESTRICTED_ACL
 * visibility (inherited via the override's parent scenario's own case_id —
 * see that function's own header comment) is enforced: the ACL grantee
 * sees it, a non-granted outsider does not.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program.
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
const ORG_ID = `roi-b3-overrides-org-${tag}`;
const USER_GRANTEE = `roi-b3-overrides-grantee-${tag}`;
const USER_OUTSIDER = `roi-b3-overrides-outsider-${tag}`;
const INITIATIVE_ID = `roi-b3-overrides-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type AssumptionCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiAssumptionCommands.js');
type ScenarioCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiScenarioCommands.js');
type RepositoryModule = typeof import('../../../server/src/services/resultsVnext/roi/roiEconomicModelRepository.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createRoiCase: CaseCommandsModule['createRoiCase'];
let startModeling: CaseCommandsModule['startModeling'];
let addAssumption: AssumptionCommandsModule['addAssumption'];
let addScenario: ScenarioCommandsModule['addScenario'];
let setScenarioOverride: ScenarioCommandsModule['setScenarioOverride'];
let listScenarioOverrides: RepositoryModule['listScenarioOverrides'];
let closePgPool: (() => Promise<void>) | undefined;

let roiPolicyId: string;

const WILDCARD_ACCESS = { capabilities: ['*'], platformRole: null } as const;

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

async function grantAcl(resourceType: string, resourceId: string, granteeUserId: string, grantedBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_resource_acl
       (resource_type, resource_id, grantee_type, grantee_id, access_level, granted_by)
     VALUES ($1, $2, 'user', $3, 'contribute', $4)`,
    [resourceType, resourceId, granteeUserId, grantedBy]
  );
}

describe('RN-G6-SRV / B3 — listScenarioOverrides (real Postgres, visibility-scoped read for a previously write-only surface)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — RN-G6-SRV B3 ROI scenario-overrides read-route tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1 FROM rvn_roi_scenario_overrides LIMIT 0');
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL,
           user_id TEXT NOT NULL,
           role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id)
         )`
      );
      await ensureRoiFixtureOrganization(client, ORG_ID, 'roiScenarioOverridesReadRoute realdb fixture org');
      await client.query(
        `CREATE TABLE IF NOT EXISTS initiatives (
           id TEXT PRIMARY KEY,
           organization_id TEXT NOT NULL,
           name TEXT NOT NULL
         )`
      );
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the ROI-E002 schema); refusing to report a green run. ' + String(error)
      );
    }
    reachable = true;

    const caseCommands: CaseCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
    createRoiCase = caseCommands.createRoiCase;
    startModeling = caseCommands.startModeling;
    const assumptionCommands: AssumptionCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiAssumptionCommands.js'
    );
    addAssumption = assumptionCommands.addAssumption;
    const scenarioCommands: ScenarioCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiScenarioCommands.js');
    addScenario = scenarioCommands.addScenario;
    setScenarioOverride = scenarioCommands.setScenarioOverride;
    const repository: RepositoryModule = await import('../../../server/src/services/resultsVnext/roi/roiEconomicModelRepository.js');
    listScenarioOverrides = repository.listScenarioOverrides;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    roiPolicyId = await insertVisibilityPolicy('roi', 'RESTRICTED_ACL', USER_GRANTEE);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(
      `DELETE FROM rvn_platform_resource_acl
        WHERE resource_type = 'roi_case'
          AND resource_id IN (SELECT case_id::text FROM rvn_roi_cases WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_scenario_overrides WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_scenarios WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_assumptions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [ORG_ID]);
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
    'a scenario override that was SET can now be READ BACK: grantee sees it with the exact values it was set with; an ACL-outsider sees none',
    async () => {
      const initiativeId = `${INITIATIVE_ID}-1`;
      // Known background (NOT fixed here, out of scope for this package):
      // on a fully-migrated schema `initiatives.status` DEFAULTs to
      // 'step3', which fails `initiatives_status_check` (canonical
      // uppercase list — 20260624_initiative_status_normalize.sql). Setting
      // it explicitly here sidesteps the broken default without touching
      // it.
      await client.query(`INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, 'DRAFT')`, [
        initiativeId,
        ORG_ID,
        'B3 overrides fixture initiative',
      ]);
      const createOutcome = await createRoiCase({
        organizationId: ORG_ID,
        initiativeId,
        title: 'B3 overrides fixture case',
        ownerUserId: USER_GRANTEE,
        currency: 'USD',
        analysisStart: '2026-01-01',
        analysisEnd: '2026-12-31',
        createdBy: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `create-${randomUUID()}`,
      });
      const caseId = createOutcome.result.case.caseId;

      await startModeling({
        caseId,
        organizationId: ORG_ID,
        expectedVersion: createOutcome.result.case.rowVersion,
        actorUserId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `start-modeling-${randomUUID()}`,
        access: WILDCARD_ACCESS,
      });

      const assumptionOutcome = await addAssumption({
        caseId,
        organizationId: ORG_ID,
        category: 'adoption',
        label: 'Adoption rate',
        baseValue: 100,
        actorUserId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `assumption-${randomUUID()}`,
        access: WILDCARD_ACCESS,
      });

      const scenarioOutcome = await addScenario({
        caseId,
        organizationId: ORG_ID,
        scenarioType: 'custom',
        label: 'B3 overrides fixture scenario',
        description: null,
        actorUserId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `scenario-${randomUUID()}`,
        access: WILDCARD_ACCESS,
      });
      const scenarioId = scenarioOutcome.result.scenarioId;

      const overrideOutcome = await setScenarioOverride({
        scenarioId,
        caseId,
        organizationId: ORG_ID,
        expectedVersion: scenarioOutcome.result.rowVersion,
        targetType: 'assumption',
        targetId: assumptionOutcome.result.assumptionId,
        overrideValue: 150,
        overrideAmount: null,
        note: 'B3 read-route probe override',
        actorUserId: USER_GRANTEE,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `override-${randomUUID()}`,
        access: WILDCARD_ACCESS,
      });
      expect(overrideOutcome.outcome).toBe('applied');
      const overrideId = overrideOutcome.result.overrideId;

      // createRoiCase already grants a 'contribute' ACL row to
      // createdBy/ownerUserId (both USER_GRANTEE here) — nothing further to
      // grant for the grantee. USER_OUTSIDER never appears anywhere.
      const asGrantee = await listScenarioOverrides({
        userId: USER_GRANTEE,
        organizationId: ORG_ID,
        caseId,
        scenarioId,
      });
      expect(asGrantee.map((o) => o.overrideId)).toContain(overrideId);
      const readBack = asGrantee.find((o) => o.overrideId === overrideId);
      expect(readBack?.targetType).toBe('assumption');
      expect(readBack?.targetId).toBe(assumptionOutcome.result.assumptionId);
      expect(Number(readBack?.overrideValue)).toBe(150);
      expect(readBack?.note).toBe('B3 read-route probe override');

      const asOutsider = await listScenarioOverrides({
        userId: USER_OUTSIDER,
        organizationId: ORG_ID,
        caseId,
        scenarioId,
      });
      expect(asOutsider).toEqual([]);
    }
  );
});
