/**
 * RN-G5 — command-capability guard, real-Postgres coverage extension for
 * the OKR and ROI domains.
 *
 * Companion to `rnG5CommandCapabilityGuard.security.realdb.test.ts` (which
 * covers KPI only) — same shape (real `resolveEffectiveAccess` against real
 * `organization_members` rows, real command functions, no hand-built fake
 * `access` object for the ACTOR UNDER TEST), added after the orchestrator's
 * review found the KPI-only suite did not evidence the ROI/OKR expansion.
 *
 * Fixture setup (Program/Cycle/Set/Objective, ROI Case) goes THROUGH the
 * real create commands with a wildcard `{ capabilities: ['*'], platformRole:
 * null }` access context — fixture setup is not what is under test, and
 * `createOkrSet`/`createObjective`/`createRoiCase` are themselves
 * deliberately capability-only-ungated commands (see their own RN-G5
 * comments), so a wildcard here is not a shortcut around anything real.
 *
 * Everything here needs RUN_DB_TESTS=1 + NODE_ENV=test + MOCK_DB=false + a
 * reachable DATABASE_URL — if no DB is configured, `beforeAll` logs and
 * every `itDB` is skipped; a skipped run is NOT evidence.
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
const itDB = DB_CONFIGURED ? it : it.skip;

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `rn-g5-okrroi-org-${tag}`;

const STRANGER_ID = `rn-g5-okrroi-stranger-${tag}`; // MEMBER role, no relationship to any fixture record
const OWNER_ID = `rn-g5-okrroi-owner-${tag}`; // MEMBER role, IS the record's owner
const REVIEWER_ID = `rn-g5-okrroi-reviewer-${tag}`; // MEMBER role, IS the Set's reviewer_user_id
const ADMIN_ID = `rn-g5-okrroi-admin-${tag}`; // ADMIN role — passes via '*'

const WILDCARD_ACCESS = { capabilities: ['*'], platformRole: null } as const;

let client: Client;
let reachable = false;

type OkrSetModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type OkrObjectiveModule = typeof import('../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type OkrProgramModule = typeof import('../../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type OkrCycleModule = typeof import('../../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type OkrReviewModule = typeof import('../../../server/src/services/resultsVnext/okr/okrReviewCommands.js');
type RoiCaseModule = typeof import('../../../server/src/services/resultsVnext/roi/roiCaseCommands.js');
type RoiBaselineModule = typeof import('../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js');
type GuardModule = typeof import('../../../server/src/services/resultsVnext/platform/commandCapabilityGuard.js');
type AccessModule = typeof import('../../../server/src/services/effectiveAccessService.js');

let createOkrSet: OkrSetModule['createOkrSet'];
let updateOkrSetDraft: OkrSetModule['updateOkrSetDraft'];
let createObjective: OkrObjectiveModule['createObjective'];
let createProgram: OkrProgramModule['createProgram'];
let publishProgram: OkrProgramModule['publishProgram'];
let createCycle: OkrCycleModule['createCycle'];
let submitOkrSetForManagerReview: OkrReviewModule['submitOkrSetForManagerReview'];
let approveOkrSetManagerReview: OkrReviewModule['approveOkrSetManagerReview'];
let OkrManagerReviewSelfApprovalDeniedError: OkrReviewModule['OkrManagerReviewSelfApprovalDeniedError'];
let createRoiCase: RoiCaseModule['createRoiCase'];
let captureOrUpdateBaseline: RoiBaselineModule['captureOrUpdateBaseline'];
let CommandCapabilityDeniedError: GuardModule['CommandCapabilityDeniedError'];
let resolveEffectiveAccess: AccessModule['resolveEffectiveAccess'];
let closePgPool: (() => Promise<void>) | undefined;

beforeAll(async () => {
  if (!DB_CONFIGURED) {
    // eslint-disable-next-line no-console
    console.error(
      '[skip] No Postgres configured — RN-G5 OKR/ROI command-capability-guard extension tests did NOT run. This run is not evidence.'
    );
    return;
  }

  client = new Client(buildClientConfig() as ClientConfig);
  await client.connect();
  await client.query('SELECT 1');
  await client.query('SELECT 1 FROM okr_vnext_sets LIMIT 0');
  await client.query('SELECT 1 FROM rvn_roi_cases LIMIT 0');
  await client.query('SELECT 1 FROM organization_members LIMIT 0');
  reachable = true;

  const okrSetModule: OkrSetModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
  createOkrSet = okrSetModule.createOkrSet;
  updateOkrSetDraft = okrSetModule.updateOkrSetDraft;

  const okrObjectiveModule: OkrObjectiveModule = await import(
    '../../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js'
  );
  createObjective = okrObjectiveModule.createObjective;

  const okrProgramModule: OkrProgramModule = await import(
    '../../../server/src/services/resultsVnext/okr/okrProgramCommands.js'
  );
  createProgram = okrProgramModule.createProgram;
  publishProgram = okrProgramModule.publishProgram;

  const okrCycleModule: OkrCycleModule = await import(
    '../../../server/src/services/resultsVnext/okr/okrCycleCommands.js'
  );
  createCycle = okrCycleModule.createCycle;

  const okrReviewModule: OkrReviewModule = await import(
    '../../../server/src/services/resultsVnext/okr/okrReviewCommands.js'
  );
  submitOkrSetForManagerReview = okrReviewModule.submitOkrSetForManagerReview;
  approveOkrSetManagerReview = okrReviewModule.approveOkrSetManagerReview;
  OkrManagerReviewSelfApprovalDeniedError = okrReviewModule.OkrManagerReviewSelfApprovalDeniedError;

  const roiCaseModule: RoiCaseModule = await import(
    '../../../server/src/services/resultsVnext/roi/roiCaseCommands.js'
  );
  createRoiCase = roiCaseModule.createRoiCase;

  const roiBaselineModule: RoiBaselineModule = await import(
    '../../../server/src/services/resultsVnext/roi/roiBaselineCommands.js'
  );
  captureOrUpdateBaseline = roiBaselineModule.captureOrUpdateBaseline;

  const guardModule: GuardModule = await import(
    '../../../server/src/services/resultsVnext/platform/commandCapabilityGuard.js'
  );
  CommandCapabilityDeniedError = guardModule.CommandCapabilityDeniedError;

  const accessModule: AccessModule = await import('../../../server/src/services/effectiveAccessService.js');
  resolveEffectiveAccess = accessModule.resolveEffectiveAccess;

  const pgModule = await import('../../../server/src/database/PostgresDatabase.js');
  closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;

  // ---------- Real org/user/organization_members fixture ----------
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'RN-G5 OKR/ROI Ext Org', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [ORG_ID]
  );

  for (const userId of [STRANGER_ID, OWNER_ID, REVIEWER_ID, ADMIN_ID]) {
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES ($1, $2, $3, 'x', 'CONSULTANT', 'active', 'RNG5', 'Test')
       ON CONFLICT (id) DO NOTHING`,
      [userId, ORG_ID, `${userId}@local.test`]
    );
  }

  const membershipRows: Array<[string, string]> = [
    [STRANGER_ID, 'MEMBER'],
    [OWNER_ID, 'MEMBER'],
    [REVIEWER_ID, 'MEMBER'],
    [ADMIN_ID, 'ADMIN'],
  ];
  for (const [userId, role] of membershipRows) {
    await client.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1, $2, $3, $4, 'ACTIVE') ON CONFLICT (organization_id, user_id) DO NOTHING`,
      [`om-${userId}`, ORG_ID, userId, role]
    );
  }

  // ---------- OKR visibility policy (fail-closed dependency of createOkrSet) ----------
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, 'okr', 1, 'OPEN_ORG', true, $2)`,
    [ORG_ID, ADMIN_ID]
  );

  // ---------- ROI visibility policy (fail-closed dependency of createRoiCase) ----------
  await client.query(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
     VALUES ($1, 'roi', 1, 'OPEN_ORG', true, $2)`,
    [ORG_ID, ADMIN_ID]
  );

  // ---------- ROI fixture dependency: an Initiative ----------
  ROI_INITIATIVE_ID = randomUUID();
  await client.query(`INSERT INTO initiatives (id, organization_id, name, status) VALUES ($1, $2, $3, 'EXECUTING')`, [
    ROI_INITIATIVE_ID,
    ORG_ID,
    'RN-G5 OKR/ROI ext fixture Initiative',
  ]);

  // ---------- OKR fixture dependency: ONE shared Program/Cycle (see
  // buildSharedProgramAndCycle's own comment for why this can't be per-test) ----------
  await buildSharedProgramAndCycle();
}, 60_000);

let ROI_INITIATIVE_ID = '';

afterAll(async () => {
  if (!reachable) return;
  await client.query(
    `DELETE FROM rvn_platform_outbox WHERE event_id IN (
       SELECT event_id FROM rvn_platform_events WHERE organization_id = $1
     )`,
    [ORG_ID]
  );
  await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
  await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = $1`, [ORG_ID]);
  await client.query(`DELETE FROM okr_vnext_reviews WHERE organization_id = $1`, [ORG_ID]);
  await client.query(`DELETE FROM okr_vnext_key_results WHERE organization_id = $1`, [ORG_ID]);
  await client.query(`DELETE FROM okr_vnext_objectives WHERE organization_id = $1`, [ORG_ID]);
  await client.query(
    `DELETE FROM rvn_platform_resource_acl WHERE resource_id IN (SELECT set_id::text FROM okr_vnext_sets WHERE organization_id = $1)`,
    [ORG_ID]
  );
  await client.query(`DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1`, [ORG_ID]);
  await client.query(`DELETE FROM okr_vnext_sets WHERE organization_id = $1`, [ORG_ID]);
  await client.query(`DELETE FROM okr_vnext_cycles WHERE organization_id = $1`, [ORG_ID]);
  // okr_vnext_programs.active_policy_version_id FKs to
  // okr_vnext_program_policy_versions — null it out before deleting either
  // side (same fix shape as rvn_kpi_definitions.current_definition_version_id
  // in the KPI security suite's own afterAll).
  await client.query(`UPDATE okr_vnext_programs SET active_policy_version_id = NULL WHERE organization_id = $1`, [
    ORG_ID,
  ]);
  await client.query(`DELETE FROM okr_vnext_program_policy_versions WHERE organization_id = $1`, [ORG_ID]);
  await client.query(`DELETE FROM okr_vnext_programs WHERE organization_id = $1`, [ORG_ID]);
  await client.query(`DELETE FROM rvn_roi_baselines WHERE organization_id = $1`, [ORG_ID]);
  await client.query(`DELETE FROM rvn_roi_calculation_policy WHERE organization_id = $1`, [ORG_ID]);
  await client.query(`DELETE FROM rvn_roi_cases WHERE organization_id = $1`, [ORG_ID]);
  await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
  await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
  await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG_ID]);
  await client.query(`DELETE FROM users WHERE organization_id = $1`, [ORG_ID]);
  await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
  await client.end();
  if (closePgPool) await closePgPool();
}, 60_000);

async function realAccessFor(userId: string) {
  return resolveEffectiveAccess({ userId, organizationId: ORG_ID });
}

// One Program/Cycle per suite run — `ux_okr_vnext_programs_one_active_per_org`
// permits only ONE active Program per organization at a time, so this is
// built ONCE in `beforeAll`, not per-test. Each test still gets its own
// fresh Set (Sets have no such singleton constraint).
let SHARED_PROGRAM_ID = '';
let SHARED_CYCLE_ID = '';

async function buildSharedProgramAndCycle(): Promise<void> {
  const program = await createProgram({
    organizationId: ORG_ID,
    name: `RN-G5 ext fixture Program ${randomUUID()}`,
    createdBy: ADMIN_ID,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-program-${randomUUID()}`,
    access: WILDCARD_ACCESS,
  });
  await publishProgram({
    programId: program.result.programId,
    organizationId: ORG_ID,
    expectedVersion: program.result.rowVersion,
    actorUserId: ADMIN_ID,
    actorEffectiveRole: 'admin',
    idempotencyKey: `publish-program-${randomUUID()}`,
    access: WILDCARD_ACCESS,
  });
  const now = Date.now();
  const iso = (deltaMs: number) => new Date(now + deltaMs).toISOString();
  const day = 24 * 60 * 60 * 1000;
  const cycle = await createCycle({
    organizationId: ORG_ID,
    programId: program.result.programId,
    name: `RN-G5 ext fixture Cycle ${randomUUID()}`,
    startDate: iso(0).slice(0, 10),
    endDate: iso(90 * day).slice(0, 10),
    draftOpenAt: iso(0),
    submissionDueAt: iso(5 * day),
    activeStartAt: iso(10 * day),
    finalUpdateDueAt: iso(70 * day),
    reviewOpenAt: iso(80 * day),
    reflectionDueAt: iso(85 * day),
    closeAt: iso(90 * day),
    createdBy: ADMIN_ID,
    actorEffectiveRole: 'admin',
    idempotencyKey: `create-cycle-${randomUUID()}`,
    access: WILDCARD_ACCESS,
  });
  SHARED_PROGRAM_ID = program.result.programId;
  SHARED_CYCLE_ID = cycle.result.cycleId;
}

/** Builds a fresh Set (owner OWNER_ID, reviewer REVIEWER_ID) under the
 * suite-shared Program/Cycle, via the REAL createOkrSet command with
 * wildcard access (fixture setup, not under test). Returns the live setId.
 * `scopeId` is randomized per call — `ux_okr_vnext_sets_one_per_scope_cycle_owner`
 * would otherwise collide across tests reusing the same owner+cycle. */
async function buildFreshSet(): Promise<{ setId: string; rowVersion: number }> {
  const set = await createOkrSet({
    organizationId: ORG_ID,
    programId: SHARED_PROGRAM_ID,
    cycleId: SHARED_CYCLE_ID,
    scopeType: 'individual',
    scopeId: `${OWNER_ID}-${randomUUID()}`,
    ownerUserId: OWNER_ID,
    reviewerUserId: REVIEWER_ID,
    title: `RN-G5 ext fixture Set ${randomUUID()}`,
    createdBy: OWNER_ID,
    actorEffectiveRole: 'member',
    idempotencyKey: `create-set-${randomUUID()}`,
    access: WILDCARD_ACCESS,
  });
  return { setId: set.result.set.setId, rowVersion: set.result.set.rowVersion };
}

async function loadSetRow(setId: string) {
  const result = await client.query<{ title: string; row_version: number; owner_user_id: string }>(
    `SELECT title, row_version, owner_user_id FROM okr_vnext_sets WHERE set_id = $1`,
    [setId]
  );
  return result.rows[0];
}

describe('RN-G5 — OKR/ROI extension coverage, real Postgres', () => {
  describe('updateOkrSetDraft (results.okr.set.update_draft)', () => {
    itDB('a stranger gets 403 and the Set is NOT mutated', async () => {
      const { setId, rowVersion } = await buildFreshSet();
      const before = await loadSetRow(setId);
      const access = await realAccessFor(STRANGER_ID);
      await expect(
        updateOkrSetDraft({
          setId,
          organizationId: ORG_ID,
          expectedVersion: rowVersion,
          title: 'Hijacked title',
          actorUserId: STRANGER_ID,
          actorEffectiveRole: 'member',
          idempotencyKey: `deny-${randomUUID()}`,
          access,
        })
      ).rejects.toBeInstanceOf(CommandCapabilityDeniedError);
      const after = await loadSetRow(setId);
      expect(after.title).toBe(before.title);
      expect(after.row_version).toBe(before.row_version);
    });

    itDB('the Set owner is allowed', async () => {
      const { setId, rowVersion } = await buildFreshSet();
      const access = await realAccessFor(OWNER_ID);
      const outcome = await updateOkrSetDraft({
        setId,
        organizationId: ORG_ID,
        expectedVersion: rowVersion,
        title: 'Owner-edited title',
        actorUserId: OWNER_ID,
        actorEffectiveRole: 'member',
        idempotencyKey: `owner-allow-${randomUUID()}`,
        access,
      });
      expect(outcome.outcome).toBe('applied');
      const after = await loadSetRow(setId);
      expect(after.title).toBe('Owner-edited title');
    });

    itDB('an ADMIN ("*") is allowed with no relationship to the Set', async () => {
      const { setId, rowVersion } = await buildFreshSet();
      const access = await realAccessFor(ADMIN_ID);
      expect(access.capabilities).toContain('*');
      const outcome = await updateOkrSetDraft({
        setId,
        organizationId: ORG_ID,
        expectedVersion: rowVersion,
        title: 'Admin-edited title',
        actorUserId: ADMIN_ID,
        actorEffectiveRole: 'admin',
        idempotencyKey: `admin-allow-${randomUUID()}`,
        access,
      });
      expect(outcome.outcome).toBe('applied');
    });
  });

  describe('createObjective (results.okr.objective.create)', () => {
    itDB('a stranger to the Set is denied — no Objective row is created', async () => {
      const { setId } = await buildFreshSet();
      const access = await realAccessFor(STRANGER_ID);
      await expect(
        createObjective({
          setId,
          organizationId: ORG_ID,
          ownerUserId: STRANGER_ID,
          title: 'Hijacked objective',
          createdBy: STRANGER_ID,
          actorEffectiveRole: 'member',
          idempotencyKey: `deny-${randomUUID()}`,
          access,
        })
      ).rejects.toBeInstanceOf(CommandCapabilityDeniedError);
      const check = await client.query(`SELECT count(*) AS n FROM okr_vnext_objectives WHERE set_id = $1`, [setId]);
      expect(Number(check.rows[0].n)).toBe(0);
    });

    itDB('the Set OWNER is allowed to add an Objective (gated on the PARENT Set, not a not-yet-existing Objective owner)', async () => {
      const { setId } = await buildFreshSet();
      const access = await realAccessFor(OWNER_ID);
      const outcome = await createObjective({
        setId,
        organizationId: ORG_ID,
        ownerUserId: STRANGER_ID, // the new Objective's OWN owner may be anyone — content, not an auth signal
        title: 'Owner-created objective',
        createdBy: OWNER_ID,
        actorEffectiveRole: 'member',
        idempotencyKey: `owner-allow-${randomUUID()}`,
        access,
      });
      expect(outcome.outcome).toBe('applied');
      expect(outcome.result.ownerUserId).toBe(STRANGER_ID);
    });

    itDB('the Set REVIEWER is also allowed to add an Objective', async () => {
      const { setId } = await buildFreshSet();
      const access = await realAccessFor(REVIEWER_ID);
      const outcome = await createObjective({
        setId,
        organizationId: ORG_ID,
        ownerUserId: REVIEWER_ID,
        title: 'Reviewer-created objective',
        createdBy: REVIEWER_ID,
        actorEffectiveRole: 'member',
        idempotencyKey: `reviewer-allow-${randomUUID()}`,
        access,
      });
      expect(outcome.outcome).toBe('applied');
    });
  });

  describe('approveOkrSetManagerReview (results.okr.review.approve_manager) — maker-checker interaction', () => {
    async function buildSubmittedManagerReview() {
      const { setId } = await buildFreshSet();
      const set = await loadSetRow(setId);
      await submitOkrSetForManagerReview({
        setId,
        organizationId: ORG_ID,
        expectedVersion: 0,
        actorUserId: OWNER_ID,
        actorEffectiveRole: 'member',
        idempotencyKey: `submit-review-${randomUUID()}`,
        access: WILDCARD_ACCESS,
      });
      return { setId, setRowVersion: set.row_version };
    }

    itDB('a stranger is denied and the review is NOT mutated', async () => {
      const { setId } = await buildSubmittedManagerReview();
      const access = await realAccessFor(STRANGER_ID);
      await expect(
        approveOkrSetManagerReview({
          setId,
          organizationId: ORG_ID,
          expectedVersion: 1,
          actorUserId: STRANGER_ID,
          actorEffectiveRole: 'member',
          idempotencyKey: `deny-${randomUUID()}`,
          access,
        })
      ).rejects.toBeInstanceOf(CommandCapabilityDeniedError);
      const reviewCheck = await client.query<{ status: string }>(
        `SELECT status FROM okr_vnext_reviews WHERE set_id = $1 AND review_type = 'manager'`,
        [setId]
      );
      expect(reviewCheck.rows[0]?.status).toBe('submitted');
    });

    itDB('the designated reviewer (no explicit capability grant) is ALLOWed by ownership', async () => {
      const { setId } = await buildSubmittedManagerReview();
      const access = await realAccessFor(REVIEWER_ID);
      const outcome = await approveOkrSetManagerReview({
        setId,
        organizationId: ORG_ID,
        expectedVersion: 1,
        actorUserId: REVIEWER_ID,
        actorEffectiveRole: 'member',
        idempotencyKey: `reviewer-allow-${randomUUID()}`,
        access,
      });
      expect(outcome.outcome).toBe('applied');
    });

    itDB(
      'maker-checker STAYS on top of the RBAC gate: the reviewer who ALSO submitted the review is still denied (self-approval), not just capability-allowed through',
      async () => {
        const { setId } = await buildFreshSet();
        // REVIEWER_ID submits AND is the designated reviewer — RBAC alone
        // would ALLOW (responsibleUserIds includes reviewer_user_id), but
        // D6 self-approval must still fire.
        await submitOkrSetForManagerReview({
          setId,
          organizationId: ORG_ID,
          expectedVersion: 0,
          actorUserId: REVIEWER_ID,
          actorEffectiveRole: 'member',
          idempotencyKey: `submit-self-${randomUUID()}`,
          access: WILDCARD_ACCESS,
        });
        const access = await realAccessFor(REVIEWER_ID);
        await expect(
          approveOkrSetManagerReview({
            setId,
            organizationId: ORG_ID,
            expectedVersion: 1,
            actorUserId: REVIEWER_ID,
            actorEffectiveRole: 'member',
            idempotencyKey: `self-approve-${randomUUID()}`,
            access,
          })
        ).rejects.toBeInstanceOf(OkrManagerReviewSelfApprovalDeniedError);
      }
    );
  });

  describe('captureOrUpdateBaseline (results.roi.baseline.capture_or_update)', () => {
    async function buildFreshRoiCase() {
      const outcome = await createRoiCase({
        organizationId: ORG_ID,
        initiativeId: ROI_INITIATIVE_ID,
        title: `RN-G5 ext fixture ROI case ${randomUUID()}`,
        ownerUserId: OWNER_ID,
        currency: 'USD',
        createdBy: OWNER_ID,
        actorEffectiveRole: 'member',
        idempotencyKey: `create-case-${randomUUID()}`,
        access: WILDCARD_ACCESS,
      });
      return { caseId: outcome.result.case.caseId, baselineRowVersion: outcome.result.baseline.rowVersion };
    }

    itDB('a stranger to the case is denied and the baseline is NOT mutated', async () => {
      const { caseId, baselineRowVersion } = await buildFreshRoiCase();
      const access = await realAccessFor(STRANGER_ID);
      await expect(
        captureOrUpdateBaseline({
          organizationId: ORG_ID,
          caseId,
          expectedVersion: baselineRowVersion,
          currentMeasuredValue: 999,
          actorId: STRANGER_ID,
          actorEffectiveRole: 'member',
          idempotencyKey: `deny-${randomUUID()}`,
          access,
        })
      ).rejects.toBeInstanceOf(CommandCapabilityDeniedError);
      const check = await client.query<{ current_measured_value: string | null }>(
        `SELECT current_measured_value FROM rvn_roi_baselines WHERE case_id = $1`,
        [caseId]
      );
      expect(check.rows[0]?.current_measured_value).toBeNull();
    });

    itDB('the case owner is allowed', async () => {
      const { caseId, baselineRowVersion } = await buildFreshRoiCase();
      const access = await realAccessFor(OWNER_ID);
      const outcome = await captureOrUpdateBaseline({
        organizationId: ORG_ID,
        caseId,
        expectedVersion: baselineRowVersion,
        currentMeasuredValue: 42,
        actorId: OWNER_ID,
        actorEffectiveRole: 'member',
        idempotencyKey: `owner-allow-${randomUUID()}`,
        access,
      });
      expect(outcome.outcome).toBe('applied');
    });

    itDB('an ADMIN ("*") is allowed with no relationship to the case', async () => {
      const { caseId, baselineRowVersion } = await buildFreshRoiCase();
      const access = await realAccessFor(ADMIN_ID);
      const outcome = await captureOrUpdateBaseline({
        organizationId: ORG_ID,
        caseId,
        expectedVersion: baselineRowVersion,
        currentMeasuredValue: 7,
        actorId: ADMIN_ID,
        actorEffectiveRole: 'admin',
        idempotencyKey: `admin-allow-${randomUUID()}`,
        access,
      });
      expect(outcome.outcome).toBe('applied');
    });
  });
});
