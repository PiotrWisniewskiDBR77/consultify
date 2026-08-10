/**
 * ROI-E002 — freeze-protection triggers + `freezeRoiEconomicModel` cross-
 * epic contract, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E002_DESIGN.md §3 (per-table
 * `*_protect_frozen` triggers) / §1 Decision D7 (`freezeRoiEconomicModel`,
 * ROI-E003's future `approveRoiCase` calls this on the same pinned client
 * immediately after `freezeRoiBaseline`).
 *
 * Proves the DB TRIGGER ITSELF (not application code) rejects a raw UPDATE
 * mutating a frozen content column on EVERY mutable ROI-E002 table
 * (`rvn_roi_calculation_policy`/`rvn_roi_assumptions`/`rvn_roi_cost_lines`/
 * `rvn_roi_benefit_lines`/`rvn_roi_scenarios`), and specifically that
 * `double_counting_resolution_note` on `rvn_roi_benefit_lines` remains
 * editable post-freeze (design §3's own explicit carve-out) both via a raw
 * UPDATE and via the command layer's `updateBenefitLine`.
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
const ORG_ID = `roi-e002-freeze-org-${tag}`;
const USER_OWNER = `roi-e002-freeze-owner-${tag}`;
const INITIATIVE_ID = `roi-e002-freeze-init-${tag}`;

let client: Client;
let reachable = false;

type CaseCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type CalcPolicyCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCalculationPolicyCommands.js');
type AssumptionCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiAssumptionCommands.js');
type CostLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
type BenefitLineCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js');
type ScenarioCommandsModule = typeof import('../../../server/src/services/resultsVnext/roi/roiScenarioCommands.js');
type FreezeModule = typeof import('../../../server/src/services/resultsVnext/roi/roiEconomicModelFreeze.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let createRoiCase: CaseCommandsModule['createRoiCase'];
let captureOrUpdateCalculationPolicy: CalcPolicyCommandsModule['captureOrUpdateCalculationPolicy'];
let addAssumption: AssumptionCommandsModule['addAssumption'];
let addCostLine: CostLineCommandsModule['addCostLine'];
let addBenefitLine: BenefitLineCommandsModule['addBenefitLine'];
let updateBenefitLine: BenefitLineCommandsModule['updateBenefitLine'];
let RoiBenefitLineFrozenError: BenefitLineCommandsModule['RoiBenefitLineFrozenError'];
let addScenario: ScenarioCommandsModule['addScenario'];
let freezeRoiEconomicModel: FreezeModule['freezeRoiEconomicModel'];
let acquirePgClient: PgModule['acquirePgClient'];
let closePgPool: (() => Promise<void>) | undefined;

async function insertVisibilityPolicy(domain: string, mode: string, createdBy: string): Promise<void> {
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, $2, 1, $3, true, $4)`,
    [ORG_ID, domain, mode, createdBy]
  );
}

describe('ROI-E002 economic-model freeze — triggers + freezeRoiEconomicModel contract (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E002 freeze realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_roi_calculation_policy LIMIT 0');
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL,
           user_id TEXT NOT NULL,
           role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id)
         )`
      );
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
    const calcPolicyCommands: CalcPolicyCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiCalculationPolicyCommands.js'
    );
    captureOrUpdateCalculationPolicy = calcPolicyCommands.captureOrUpdateCalculationPolicy;
    const assumptionCommands: AssumptionCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiAssumptionCommands.js'
    );
    addAssumption = assumptionCommands.addAssumption;
    const costLineCommands: CostLineCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiCostLineCommands.js');
    addCostLine = costLineCommands.addCostLine;
    const benefitLineCommands: BenefitLineCommandsModule = await import(
      '../../../server/src/services/resultsVnext/roi/roiBenefitLineCommands.js'
    );
    addBenefitLine = benefitLineCommands.addBenefitLine;
    updateBenefitLine = benefitLineCommands.updateBenefitLine;
    RoiBenefitLineFrozenError = benefitLineCommands.RoiBenefitLineFrozenError;
    const scenarioCommands: ScenarioCommandsModule = await import('../../../server/src/services/resultsVnext/roi/roiScenarioCommands.js');
    addScenario = scenarioCommands.addScenario;
    const freezeModule: FreezeModule = await import('../../../server/src/services/resultsVnext/roi/roiEconomicModelFreeze.js');
    freezeRoiEconomicModel = freezeModule.freezeRoiEconomicModel;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    acquirePgClient = pgModule.acquirePgClient;
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    await insertVisibilityPolicy('roi', 'RESTRICTED_ACL', USER_OWNER);
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
    await client.query(`DELETE FROM rvn_roi_scenarios WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_benefit_lines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_cost_lines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_assumptions WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
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
    'freezeRoiEconomicModel freezes every mutable table\'s active rows; each DB trigger rejects a raw UPDATE on a ' +
      'frozen content column but allows row_version/updated_at bookkeeping; double_counting_resolution_note stays ' +
      'editable post-freeze both via a raw UPDATE and via updateBenefitLine',
    async () => {
      const initiativeId = `${INITIATIVE_ID}-${randomUUID()}`;
      await client.query(`INSERT INTO initiatives (id, organization_id, name) VALUES ($1, $2, $3)`, [
        initiativeId,
        ORG_ID,
        'Freeze fixture initiative',
      ]);
      const createOutcome = await createRoiCase({
        organizationId: ORG_ID,
        initiativeId,
        title: 'Freeze fixture case',
        ownerUserId: USER_OWNER,
        currency: 'USD',
        createdBy: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `create-${randomUUID()}`,
      });
      const caseId = createOutcome.result.case.caseId;
      expect(createOutcome.result.calculationPolicy.frozenAt).toBeNull();

      await captureOrUpdateCalculationPolicy({
        organizationId: ORG_ID,
        caseId,
        expectedVersion: 1,
        discountRatePct: 10,
        actorId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `policy-${randomUUID()}`,
      });
      const assumptionOutcome = await addAssumption({
        caseId,
        organizationId: ORG_ID,
        category: 'adoption',
        label: 'Adoption rate',
        baseValue: 100,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `assumption-${randomUUID()}`,
      });
      const costLineOutcome = await addCostLine({
        caseId,
        organizationId: ORG_ID,
        category: 'implementation',
        label: 'Setup',
        amount: 1000,
        currency: 'USD',
        timingType: 'one_time',
        oneTimePeriodDate: '2026-01-01',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `cost-${randomUUID()}`,
      });
      const benefitLineOutcome = await addBenefitLine({
        caseId,
        organizationId: ORG_ID,
        category: 'revenue',
        label: 'New revenue',
        amount: 2000,
        currency: 'USD',
        timingType: 'one_time',
        oneTimePeriodDate: '2026-02-01',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `benefit-${randomUUID()}`,
      });
      const scenarioOutcome = await addScenario({
        caseId,
        organizationId: ORG_ID,
        scenarioType: 'downside',
        label: 'Downside scenario',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `scenario-${randomUUID()}`,
      });

      // Freeze — the cross-epic contract ROI-E003's future approveRoiCase
      // will call on the same pinned client as the approval CAS; here
      // acquired directly to prove the contract works standalone.
      const freezeClient = await acquirePgClient();
      try {
        await freezeRoiEconomicModel(freezeClient, { caseId, organizationId: ORG_ID, frozenBy: USER_OWNER });
      } finally {
        freezeClient.release();
      }

      const frozenChecks = await Promise.all([
        client.query(`SELECT frozen_at FROM rvn_roi_calculation_policy WHERE case_id = $1`, [caseId]),
        client.query(`SELECT frozen_at FROM rvn_roi_assumptions WHERE assumption_id = $1`, [assumptionOutcome.result.assumptionId]),
        client.query(`SELECT frozen_at FROM rvn_roi_cost_lines WHERE cost_line_id = $1`, [costLineOutcome.result.costLineId]),
        client.query(`SELECT frozen_at FROM rvn_roi_benefit_lines WHERE benefit_line_id = $1`, [benefitLineOutcome.result.benefitLineId]),
        client.query(`SELECT frozen_at FROM rvn_roi_scenarios WHERE scenario_id = $1`, [scenarioOutcome.result.scenarioId]),
      ]);
      for (const check of frozenChecks) {
        expect(check.rows[0]?.frozen_at).not.toBeNull();
      }

      // Trigger rejects raw UPDATEs on frozen content columns — every table.
      await expect(
        client.query(`UPDATE rvn_roi_calculation_policy SET discount_rate_pct = 999 WHERE case_id = $1`, [caseId])
      ).rejects.toThrow(/frozen/i);
      await expect(
        client.query(`UPDATE rvn_roi_assumptions SET base_value = 999 WHERE assumption_id = $1`, [
          assumptionOutcome.result.assumptionId,
        ])
      ).rejects.toThrow(/frozen/i);
      await expect(
        client.query(`UPDATE rvn_roi_cost_lines SET amount = 999999 WHERE cost_line_id = $1`, [costLineOutcome.result.costLineId])
      ).rejects.toThrow(/frozen/i);
      await expect(
        client.query(`UPDATE rvn_roi_benefit_lines SET amount = 999999 WHERE benefit_line_id = $1`, [
          benefitLineOutcome.result.benefitLineId,
        ])
      ).rejects.toThrow(/frozen/i);
      await expect(
        client.query(`UPDATE rvn_roi_scenarios SET label = 'renamed after freeze' WHERE scenario_id = $1`, [
          scenarioOutcome.result.scenarioId,
        ])
      ).rejects.toThrow(/frozen/i);

      // Bookkeeping-only mutations remain legal on every frozen row.
      await expect(
        client.query(`UPDATE rvn_roi_calculation_policy SET row_version = row_version + 1, updated_at = now() WHERE case_id = $1`, [
          caseId,
        ])
      ).resolves.toBeTruthy();

      // double_counting_resolution_note is intentionally NOT in the frozen
      // guard's protected-field list (design §3) — confirm via a raw UPDATE...
      await expect(
        client.query(
          `UPDATE rvn_roi_benefit_lines SET double_counting_resolution_note = 'resolved post-freeze', row_version = row_version + 1 WHERE benefit_line_id = $1`,
          [benefitLineOutcome.result.benefitLineId]
        )
      ).resolves.toBeTruthy();

      // ...AND via the command layer's updateBenefitLine, which must NOT
      // throw RoiBenefitLineFrozenError when the ONLY field being edited is
      // the resolution note.
      const postFreezeRow = await client.query<{ row_version: number }>(
        `SELECT row_version FROM rvn_roi_benefit_lines WHERE benefit_line_id = $1`,
        [benefitLineOutcome.result.benefitLineId]
      );
      const commandLayerNoteUpdate = await updateBenefitLine({
        benefitLineId: benefitLineOutcome.result.benefitLineId,
        caseId,
        organizationId: ORG_ID,
        expectedVersion: postFreezeRow.rows[0]!.row_version,
        doubleCountingResolutionNote: 'resolved via command layer, post-freeze',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `resolve-note-postfreeze-${randomUUID()}`,
      });
      expect(commandLayerNoteUpdate.outcome).toBe('applied');
      expect(commandLayerNoteUpdate.result.doubleCountingResolutionNote).toBe('resolved via command layer, post-freeze');

      // But editing a FINANCIAL field on the same (frozen) row through the
      // command layer still throws the typed frozen error.
      await expect(
        updateBenefitLine({
          benefitLineId: benefitLineOutcome.result.benefitLineId,
          caseId,
          organizationId: ORG_ID,
          expectedVersion: commandLayerNoteUpdate.resultingVersion,
          amount: 12345,
          actorUserId: USER_OWNER,
          actorEffectiveRole: 'consultant',
          idempotencyKey: `try-edit-amount-postfreeze-${randomUUID()}`,
        })
      ).rejects.toBeInstanceOf(RoiBenefitLineFrozenError);
    }
  );
});
