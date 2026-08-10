/**
 * KPI-E006 — Teresa KPI handoff, no silent approval (real Postgres).
 *
 * Design: docs/product/results-vnext/KPI_E006_TERESA_DESIGN.md §D
 * ("Behavioral test (realDB, complements the static proof — does not
 * replace it)"). Complements
 * tests/resultsVnext/teresa-kpi-forbidden-verbs.test.ts (static grep proof)
 * with two REAL executions through `executeProposal` ->
 * `performHandoff` -> `handleResultsKpiHandoff`, against a real ephemeral
 * Postgres — not a mocked KPI command layer, per the EXECUTION_LEDGER.md §24
 * lesson ("testy przeszły" != "działa" — a fully mocked repository/command
 * layer would never actually execute the real write path this file exists
 * to prove).
 *
 * Two scenarios, both pinned by the design's §D text verbatim:
 *   1. `executeProposal` for `draft_quality_review` (create path) NEVER
 *      leaves `rvn_kpi_definitions.status != 'draft'` — Teresa's handoff can
 *      draft a KPI, it can never make it live.
 *   2. A `reflection_rca` handoff records the APPROVING HUMAN (not a
 *      'teresa' sentinel) as `submitRootCause`'s actor, and `approvePlan` by
 *      that SAME human is still denied by `DeviationSelfApprovalDeniedError`
 *      — proving Teresa's presence in the chain does not weaken the
 *      existing human self-approval gate.
 *
 * `teresa_proposals`/`teresa_audit_log` are still self-provisioned here via
 * a literal copy of `ensureTeresaTables()`'s DDL (server/src/services/v8/
 * teresaCopilotService.ts) — that function is not exported, and per
 * KPI_E006_TERESA_DESIGN.md §C those two tables are explicitly "left
 * untouched" (out of scope for a real migration in this package).
 * `teresa_handoff_results` additionally has a real migration now
 * (server/migrations/20260814_rvn_teresa_kpi_handoff_results.sql, this
 * package's Package 2) — `CREATE TABLE IF NOT EXISTS` here is a redundant,
 * harmless no-op against it either way.
 *
 * SKIP POLICY (same convention as every other *.realdb.test.ts in
 * tests/resultsVnext/kpi/): if no database is configured (no
 * DATABASE_URL/DB_HOST), every scenario below is a silent no-op and this
 * file reports green — that is expected in environments without a Postgres
 * available and is NOT evidence the behavior works. If a database IS
 * configured but unreachable (or missing the schema), `beforeAll` throws so
 * this run is never silently green.
 *
 * HOW TO RUN FOR REAL: point DATABASE_URL (or DB_HOST/DB_PORT/DB_NAME/
 * DB_USER/DB_PASSWORD) at a Postgres 16 that already has
 * server/migrations/20260809_rvn_platform_*.sql,
 * 20260810_rvn_kpi_core.sql, 20260811_rvn_kpi_deviation_loop.sql,
 * 20260811_rvn_platform_obligations.sql, 20260814_rvn_teresa_kpi_handoff_results.sql
 * applied — env vars are read once, at
 * `server/src/config/DatabaseConfig.ts`'s module-load time, so they must be
 * set before ANY transitive import of it (this file sets them implicitly by
 * relying on the process env already being set before vitest imports this
 * file — same as every sibling *.realdb.test.ts).
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
const ORG_ID = `kpi-e006-it-org-${tag}`;
const OWNER_USER_ID = `kpi-e006-it-owner-${tag}`;

let client: Client;
let reachable = false;

type ServiceModule = typeof import('../../server/src/services/v8/teresaCopilotService.js');
type DeviationCommandsModule = typeof import('../../server/src/services/resultsVnext/kpi/kpiDeviationCommands.js');
type PgModule = typeof import('../../server/src/database/PostgresDatabase.js');

let executeProposal: ServiceModule['executeProposal'];
let approvePlan: DeviationCommandsModule['approvePlan'];
let DeviationSelfApprovalDeniedError: DeviationCommandsModule['DeviationSelfApprovalDeniedError'];
let closePgPool: (() => Promise<void>) | undefined;

let policyId: string;

/** Literal copy of `ensureTeresaTables()`'s DDL (teresaCopilotService.ts) —
 * not exported, so this file reproduces it rather than reaching into an
 * internal. Column-for-column identical to both that function and
 * server/migrations/20260814_rvn_teresa_kpi_handoff_results.sql. */
async function ensureTeresaProposalTables(): Promise<void> {
  await client.query(
    `CREATE TABLE IF NOT EXISTS teresa_proposals (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'proposal',
      handoff_context_json TEXT NOT NULL DEFAULT '{}',
      target_module TEXT NOT NULL,
      target_payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  );
  await client.query(
    `CREATE TABLE IF NOT EXISTS teresa_audit_log (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL,
      action TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT 'teresa',
      timestamp TEXT NOT NULL,
      from_state TEXT,
      to_state TEXT,
      detail_json TEXT DEFAULT '{}',
      FOREIGN KEY (proposal_id) REFERENCES teresa_proposals(id)
    )`
  );
  await client.query(
    `CREATE TABLE IF NOT EXISTS teresa_handoff_results (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      target_module TEXT NOT NULL,
      result_ref TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (proposal_id) REFERENCES teresa_proposals(id)
    )`
  );
}

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

/** Minimal `TeresaHandoffContext` — no `runtime_binding.conversation_id`
 * on purpose, so the KPI command layer's `correlationId ?? randomUUID()`
 * generates a real UUID (`rvn_platform_events.correlation_id` is
 * `UUID NOT NULL`; a non-UUID conversation id would 22P02 on insert). */
function buildHandoffContext() {
  return {
    origin: 'teresa',
    user_intent: 'KPI-E006 e2e no-silent-approval probe',
    active_surface: 'results/kpi',
    org_context_ref: `org:${ORG_ID}`,
    bounded_context_pack: [],
    constraints: [],
    assumptions: [],
    uncertainty_boundary: { missing_inputs: [], conflicts: [], what_would_change_next_action: [] },
    evidence_pointers: [],
    proposed_next_action: { target_module: 'kpi', handoff_intent: 'create', requires_approval: true },
    audit_stub: { actor: 'teresa:copilot', timestamp: new Date().toISOString() },
  };
}

/** Inserts a `teresa_proposals` row already in `approved` state — bypasses
 * `createProposal`/`approveProposal` (their own validation/anti-duplicate
 * logic is not what this file tests) and lets `executeProposal` run for
 * real, exactly like `teresaHandoffTargets.failClosed.test.ts` does with a
 * mocked `dbGet`, just with a real row instead of a mock. */
async function insertApprovedProposal(params: {
  proposalId: string;
  userId: string;
  sessionId: string;
  targetPayload: Record<string, unknown>;
}): Promise<void> {
  const now = new Date().toISOString();
  await client.query(
    `INSERT INTO teresa_proposals
       (id, organization_id, user_id, session_id, state, handoff_context_json, target_module, target_payload_json, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'approved', $5, 'kpi', $6, $7, $7)`,
    [
      params.proposalId,
      ORG_ID,
      params.userId,
      params.sessionId,
      JSON.stringify(buildHandoffContext()),
      JSON.stringify(params.targetPayload),
      now,
    ]
  );
}

async function insertFixtureKpiAndCase(params: {
  kpiId: string;
  versionId: string;
  measurementId: string;
  caseId: string;
  ownerUserId: string;
}): Promise<void> {
  const { kpiId, versionId, measurementId, caseId, ownerUserId } = params;
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
     VALUES ($1, $2, $3, $4, '2026-03-01T00:00:00.000Z', '2026-03-31T00:00:00.000Z', 10, 'critical', 'manual', $5)`,
    [measurementId, kpiId, versionId, ORG_ID, ownerUserId]
  );
  // status = 'analysis_required' directly (bypasses openOrEscalateDeviationCase's
  // open -> analysis_required transition, not what this file tests) —
  // created_by = ownerUserId so approvePlan's `created_by === approverId`
  // self-approval branch fires deterministically regardless of whether the
  // plan-submission step (submitPlan, not exercised by the KPI-E006 handler)
  // ever ran.
  await client.query(
    `INSERT INTO rvn_kpi_deviation_cases
       (case_id, organization_id, kpi_id, trigger_measurement_id, severity, status, owner_user_id, created_by)
     VALUES ($1, $2, $3, $4, 'critical', 'analysis_required', $5, $5)`,
    [caseId, ORG_ID, kpiId, measurementId, ownerUserId]
  );
}

describe('KPI-E006 — Teresa KPI handoff, no silent approval (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — KPI-E006 Teresa no-silent-approval tests did NOT run. This run is not evidence.'
      );
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM rvn_kpi_definitions LIMIT 0');
      await client.query('SELECT 1 FROM rvn_kpi_deviation_cases LIMIT 0');
      // buildVisibilityScopedCte's SCOPE branch (visibilityScopedQuery.ts)
      // unconditionally references `team_members` regardless of which
      // visibility_mode this file's fixtures actually use — same minimal
      // FK-free stand-in every sibling *.realdb.test.ts in
      // tests/resultsVnext/kpi/ already creates (see e.g.
      // kpiVisibilityJoinRegression.realdb.test.ts).
      await client.query(
        `CREATE TABLE IF NOT EXISTS team_members (
           team_id TEXT NOT NULL,
           user_id TEXT NOT NULL,
           role TEXT DEFAULT 'member',
           PRIMARY KEY (team_id, user_id)
         )`
      );
      await ensureTeresaProposalTables();
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the KPI/Teresa schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const service: ServiceModule = await import('../../server/src/services/v8/teresaCopilotService.js');
    executeProposal = service.executeProposal;

    const deviationCommands: DeviationCommandsModule = await import(
      '../../server/src/services/resultsVnext/kpi/kpiDeviationCommands.js'
    );
    approvePlan = deviationCommands.approvePlan;
    DeviationSelfApprovalDeniedError = deviationCommands.DeviationSelfApprovalDeniedError;

    const pgModule: PgModule = await import('../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

    policyId = await insertVisibilityPolicy('kpi', 'OPEN_ORG', OWNER_USER_ID);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM teresa_handoff_results WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM teresa_audit_log WHERE proposal_id IN (SELECT id FROM teresa_proposals WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM teresa_proposals WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_deviation_cases WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_kpi_measurements WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
    await client.query(
      `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
      [ORG_ID]
    );
    await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
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
    "draft_quality_review: executeProposal's create path NEVER leaves rvn_kpi_definitions.status != 'draft'",
    async () => {
      const proposalId = randomUUID();
      const kpiCode = `E006-${tag}`;
      const targetPayload = {
        kpi_handoff_context: {
          advisor_mode: 'draft_quality_review',
          target_resource: { resource_type: 'kpi', resource_id: null },
          expected_version: null,
          draft_quality_review: {
            proposed: {
              kpiCode,
              name: 'e2e probe KPI',
              description: null,
              unit: null,
              targetGeometry: 'threshold_min',
              targetValue: null,
              targetMin: 100,
              targetMax: null,
              warningLow: null,
              warningHigh: null,
              criticalLow: null,
              criticalHigh: null,
              binarySuccessValue: null,
              formulaText: null,
              ownerUserId: OWNER_USER_ID,
            },
            quality_review: {
              purpose_question: 'Why does this KPI matter?',
              actionability_question: 'What will change if it moves?',
              owner_load_note: null,
              target_evidence_note: null,
              duplicate_risk: { candidate_kpi_ids: [], note: null },
            },
            evidence_breakdown: {
              facts: [],
              inference: [],
              missing_evidence: [],
              recommendation: 'draft as proposed',
            },
          },
        },
        evidence_pointers: ['note:kpi-e006-e2e'],
      };
      await insertApprovedProposal({ proposalId, userId: OWNER_USER_ID, sessionId: 'sess-draft', targetPayload });

      const result = await executeProposal({ proposalId, organizationId: ORG_ID, userId: OWNER_USER_ID });

      expect(result.success).toBe(true);
      expect(result.state).toBe('completed');
      const kpiId = (result.handoff_result as Record<string, unknown> | undefined)?.kpi_id;
      expect(typeof kpiId).toBe('string');

      const row = await client.query<{ status: string }>(
        `SELECT status FROM rvn_kpi_definitions WHERE kpi_id = $1 AND organization_id = $2`,
        [kpiId, ORG_ID]
      );
      expect(row.rows).toHaveLength(1);
      // The actual assertion this test exists for: Teresa's create-path
      // handoff can draft a KPI, it can NEVER leave it anything but 'draft' —
      // no code path in handleKpiDraftQualityReview calls
      // approveDefinitionVersion/activateKpi (see teresa-kpi-forbidden-verbs
      // .test.ts's static proof of the same invariant, source-level).
      expect(row.rows[0]?.status).toBe('draft');
    }
  );

  itDB(
    'reflection_rca: submitRootCause records the approving human as actor, and approvePlan by that SAME human is still denied by DeviationSelfApprovalDeniedError',
    async () => {
      const kpiId = randomUUID();
      const versionId = randomUUID();
      const measurementId = randomUUID();
      const caseId = randomUUID();
      await insertFixtureKpiAndCase({ kpiId, versionId, measurementId, caseId, ownerUserId: OWNER_USER_ID });

      const proposalId = randomUUID();
      const targetPayload = {
        kpi_handoff_context: {
          advisor_mode: 'reflection_rca',
          target_resource: { resource_type: 'deviation_case', resource_id: caseId },
          expected_version: 1, // matches the fixture case's row_version default
          reflection_rca: {
            case_id: caseId,
            proposed_root_cause_summary: 'Vendor SLA breach caused the miss',
            proposed_root_cause_category: 'external_dependency',
            recurrence_flag: false,
            evidence_breakdown: {
              facts: ['measurement dropped below critical threshold'],
              inference: ['vendor SLA breach is the most likely cause'],
              missing_evidence: ['vendor incident report not yet attached'],
              recommendation: 'confirm with vendor incident report before closing analysis',
            },
          },
        },
        evidence_pointers: [`deviation_case:${caseId}`],
      };
      await insertApprovedProposal({ proposalId, userId: OWNER_USER_ID, sessionId: 'sess-rca', targetPayload });

      const result = await executeProposal({ proposalId, organizationId: ORG_ID, userId: OWNER_USER_ID });
      expect(result.success).toBe(true);
      expect(result.state).toBe('completed');
      expect((result.handoff_result as Record<string, unknown> | undefined)?.case_id).toBe(caseId);

      // Both summary and category were provided -> the case transitioned
      // plan_required, per submitRootCause's own state machine.
      const caseRow = await client.query<{ status: string; row_version: number; plan_submitted_by: string | null }>(
        `SELECT status, row_version, plan_submitted_by FROM rvn_kpi_deviation_cases WHERE case_id = $1`,
        [caseId]
      );
      expect(caseRow.rows[0]?.status).toBe('plan_required');
      // Root cause was NOT recorded under a 'teresa' sentinel actor — the
      // event trail (rvn_platform_events) is the domain-truth audit
      // KPI_E006_TERESA_DESIGN.md §C points at instead of a second table.
      const eventRow = await client.query<{ actor_user_id: string; actor_effective_role: string }>(
        `SELECT actor_user_id, actor_effective_role FROM rvn_platform_events
          WHERE organization_id = $1 AND aggregate_id = $2 AND event_type = 'kpi.deviation_root_cause_submitted'`,
        [ORG_ID, caseId]
      );
      expect(eventRow.rows).toHaveLength(1);
      expect(eventRow.rows[0]?.actor_user_id).toBe(OWNER_USER_ID);
      expect(eventRow.rows[0]?.actor_effective_role).toBe('teresa_initiated');

      const newVersion = caseRow.rows[0]!.row_version;

      // *** THE ACTUAL SELF-APPROVAL PROOF ***
      // OWNER_USER_ID is both the case's created_by (fixture) AND the human
      // who "approved+executed" the Teresa reflection_rca proposal above —
      // exactly the scenario decision #5/§D's design text describes. If that
      // same human now tries to approve the corrective plan, the PRE-EXISTING
      // human governance gate (approvePlan's self-approval check, unrelated
      // to Teresa) must still deny it — Teresa's presence in the chain must
      // not create a bypass.
      await expect(
        approvePlan({
          caseId,
          organizationId: ORG_ID,
          expectedVersion: newVersion,
          approverId: OWNER_USER_ID,
          actorEffectiveRole: 'consultant',
          idempotencyKey: randomUUID(),
          reason: 'KPI-E006 e2e self-approval probe',
        })
      ).rejects.toBeInstanceOf(DeviationSelfApprovalDeniedError);

      // Denial must be a truth-preserving failure — no write happened.
      const caseAfterDenial = await client.query<{ status: string; plan_approved_by: string | null }>(
        `SELECT status, plan_approved_by FROM rvn_kpi_deviation_cases WHERE case_id = $1`,
        [caseId]
      );
      expect(caseAfterDenial.rows[0]?.status).toBe('plan_required');
      expect(caseAfterDenial.rows[0]?.plan_approved_by).toBeNull();
    }
  );
});
