/**
 * Acceptance E2E — RN-G4, point 3 of the FALA 3 cross-domain evidence brief
 * (docs/product/results-vnext/RN_G4_CROSS_DOMAIN_EVIDENCE.md):
 *
 * "OKR alignment does not automatically inherit scoring — a rating change
 * on the parent does not propagate to the child without an explicit
 * command."
 *
 * `tests/resultsVnext/okr/alignmentNoScoreMutation.realdb.test.ts` (OKR-E005,
 * pre-existing, untouched by this file) already proves that
 * `proposeAlignment`/`acceptAlignment`/`rejectAlignment`/`removeAlignment`
 * themselves never mutate an Objective's `progress`/`confidence` — but it
 * predates OKR-E007's `finalScoreOkrSet`/reflection scoring and never
 * exercises it. THIS file closes that specific gap: a Set-level
 * `finalScoreOkrSet` (which writes a real `final_score` into
 * `okr_vnext_reflections`, keyed by `objective_id`) run on the PARENT's own
 * Set must not create, mutate, or otherwise affect ANY row for the CHILD's
 * Objective/reflection — proven by full-row equality on the child Objective
 * before/after, plus a direct assertion that zero reflection rows exist for
 * the child until its OWNER explicitly runs `finalScoreOkrSet` on the
 * child's own Set.
 *
 * Two Sets sharing ONE Cycle (required — `proposeAlignment` throws
 * `OkrAlignmentCycleMismatchError` if `source.cycleId !== target.cycleId`,
 * verified directly in `okrAlignmentCommands.ts`), aligned
 * child-contributes_to-parent, both driven through their real
 * create->submit->approve->activate->review->final-score lifecycle via
 * real, exported domain commands only.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pgClient, requireLocalDbUrl } from './harness.js';

requireLocalDbUrl();

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const MARKER = `odbior--rn-g4--okr-alignment-no-score-inherit--${tag}`;
const ORG_ID = `${MARKER}--org`;
const ADMIN = `${MARKER}--admin`;
const MANAGER = `${MARKER}--manager`; // parent Set owner
const CONTRIBUTOR = `${MARKER}--contributor`; // child Set owner

type ProgramCommandsModule = typeof import('../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ObjectiveCommandsModule = typeof import('../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type KeyResultCommandsModule = typeof import('../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js');
type AlignmentCommandsModule = typeof import('../../server/src/services/resultsVnext/okr/okrAlignmentCommands.js');
type ReflectionCommandsModule = typeof import('../../server/src/services/resultsVnext/okr/okrReflectionCommands.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let submitOkrSetForApproval: SetCommandsModule['submitOkrSetForApproval'];
let approveOkrSet: SetCommandsModule['approveOkrSet'];
let runOkrSetLifecycleTransition: SetCommandsModule['runOkrSetLifecycleTransition'];
let OKR_SET_ACTIVATE_SPEC: SetCommandsModule['OKR_SET_ACTIVATE_SPEC'];
let OKR_SET_OPEN_REVIEW_SPEC: SetCommandsModule['OKR_SET_OPEN_REVIEW_SPEC'];
let createObjective: ObjectiveCommandsModule['createObjective'];
let createKeyResult: KeyResultCommandsModule['createKeyResult'];
let proposeAlignment: AlignmentCommandsModule['proposeAlignment'];
let acceptAlignment: AlignmentCommandsModule['acceptAlignment'];
let finalScoreOkrSet: ReflectionCommandsModule['finalScoreOkrSet'];

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

async function insertOrgAndUsers(): Promise<void> {
  const client = pgClient();
  await client.connect();
  try {
    await client.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, now())`,
      [ORG_ID, `RN-G4 fixture org ${ORG_ID}`]
    );
    for (const [id, email] of [
      [ADMIN, `${ADMIN}@acceptance.local`],
      [MANAGER, `${MANAGER}@acceptance.local`],
      [CONTRIBUTOR, `${CONTRIBUTOR}@acceptance.local`],
    ]) {
      await client.query(
        `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
         VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'RNG4', 'Fixture', now())`,
        [id, ORG_ID, email]
      );
    }
    await client.query(
      `INSERT INTO rvn_platform_visibility_policies
         (organization_id, domain, policy_version, visibility_mode, is_active, created_by)
       VALUES ($1, 'okr', 1, 'OPEN_ORG', true, $2)`,
      [ORG_ID, ADMIN]
    );
  } finally {
    await client.end();
  }
}

interface SetWithObjective {
  setId: string;
  objectiveId: string;
  rowVersionAfterActivate: number;
}

async function buildActiveSetWithObjective(params: {
  programId: string;
  cycleId: string;
  scopeType: 'team' | 'individual';
  scopeId: string;
  ownerUserId: string;
  reviewerUserId: string;
  title: string;
}): Promise<SetWithObjective> {
  const { programId, cycleId, scopeType, scopeId, ownerUserId, reviewerUserId, title } = params;

  const set = await createOkrSet({
    organizationId: ORG_ID,
    programId,
    cycleId,
    scopeType,
    scopeId,
    ownerUserId,
    reviewerUserId,
    title,
    createdBy: ownerUserId,
    actorEffectiveRole: 'member',
    idempotencyKey: `${MARKER}--create-set-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  const setId = set.result.set.setId;

  const objective = await createObjective({
    setId,
    organizationId: ORG_ID,
    ownerUserId,
    title: `${title} Objective`,
    createdBy: ownerUserId,
    actorEffectiveRole: 'member',
    idempotencyKey: `${MARKER}--create-obj-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  const objectiveId = objective.result.objectiveId;

  for (const kr of [
    { currentValue: 5, targetValue: 10 },
    { currentValue: 10, targetValue: 10 },
  ]) {
    await createKeyResult({
      objectiveId,
      organizationId: ORG_ID,
      ownerUserId,
      title: `${title} KR`,
      measurementType: 'numeric',
      direction: 'reach',
      targetValue: kr.targetValue,
      currentValue: kr.currentValue,
      createdBy: ownerUserId,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--create-kr-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
  }

  const submitted = await submitOkrSetForApproval({
    setId,
    organizationId: ORG_ID,
    expectedVersion: set.result.set.rowVersion,
    actorUserId: ownerUserId,
    actorEffectiveRole: 'member',
    idempotencyKey: `${MARKER}--submit-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  const approved = await approveOkrSet({
    setId,
    organizationId: ORG_ID,
    expectedVersion: submitted.resultingVersion,
    approverId: ADMIN,
    actorEffectiveRole: 'admin',
    idempotencyKey: `${MARKER}--approve-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });
  const activated = await runOkrSetLifecycleTransition(OKR_SET_ACTIVATE_SPEC, {
    setId,
    organizationId: ORG_ID,
    expectedVersion: approved.resultingVersion,
    actorUserId: ownerUserId,
    actorEffectiveRole: 'member',
    idempotencyKey: `${MARKER}--activate-${randomUUID()}`,
    access: { capabilities: ['*'], platformRole: null },
  });

  return { setId, objectiveId, rowVersionAfterActivate: activated.resultingVersion };
}

async function readObjectiveRow(objectiveId: string): Promise<Record<string, unknown>> {
  const client = pgClient();
  await client.connect();
  try {
    const result = await client.query(`SELECT * FROM okr_vnext_objectives WHERE objective_id = $1`, [objectiveId]);
    const row = result.rows[0];
    if (!row) throw new Error(`objective ${objectiveId} not found`);
    return row;
  } finally {
    await client.end();
  }
}

async function readReflectionRows(objectiveId: string): Promise<unknown[]> {
  const client = pgClient();
  await client.connect();
  try {
    const result = await client.query(`SELECT * FROM okr_vnext_reflections WHERE objective_id = $1`, [objectiveId]);
    return result.rows;
  } finally {
    await client.end();
  }
}

async function readSetVersion(setId: string): Promise<number> {
  const client = pgClient();
  await client.connect();
  try {
    const result = await client.query<{ row_version: number }>(`SELECT row_version FROM okr_vnext_sets WHERE set_id = $1`, [
      setId,
    ]);
    return result.rows[0]!.row_version;
  } finally {
    await client.end();
  }
}

describe('RN-G4 · Point 3 — OKR alignment does not auto-inherit final scoring from parent to child', () => {
  let programId: string;
  let cycleId: string;
  let parent: SetWithObjective;
  let child: SetWithObjective;
  let alignmentId: string;

  beforeAll(async () => {
    await insertOrgAndUsers();

    const programCommands: ProgramCommandsModule = await import(
      '../../server/src/services/resultsVnext/okr/okrProgramCommands.js'
    );
    ({ createProgram, publishProgram } = programCommands);
    const cycleCommands: CycleCommandsModule = await import(
      '../../server/src/services/resultsVnext/okr/okrCycleCommands.js'
    );
    ({ createCycle } = cycleCommands);
    const setCommands: SetCommandsModule = await import('../../server/src/services/resultsVnext/okr/okrSetCommands.js');
    ({
      createOkrSet,
      submitOkrSetForApproval,
      approveOkrSet,
      runOkrSetLifecycleTransition,
      OKR_SET_ACTIVATE_SPEC,
      OKR_SET_OPEN_REVIEW_SPEC,
    } = setCommands);
    const objectiveCommands: ObjectiveCommandsModule = await import(
      '../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js'
    );
    ({ createObjective } = objectiveCommands);
    const keyResultCommands: KeyResultCommandsModule = await import(
      '../../server/src/services/resultsVnext/okr/okrKeyResultCommands.js'
    );
    ({ createKeyResult } = keyResultCommands);
    const alignmentCommands: AlignmentCommandsModule = await import(
      '../../server/src/services/resultsVnext/okr/okrAlignmentCommands.js'
    );
    ({ proposeAlignment, acceptAlignment } = alignmentCommands);
    const reflectionCommands: ReflectionCommandsModule = await import(
      '../../server/src/services/resultsVnext/okr/okrReflectionCommands.js'
    );
    ({ finalScoreOkrSet } = reflectionCommands);

    const program = await createProgram({
      organizationId: ORG_ID,
      name: 'RN-G4 fixture Program',
      createdBy: ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `${MARKER}--create-program-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    programId = program.result.programId;
    await publishProgram({
      programId,
      organizationId: ORG_ID,
      expectedVersion: program.result.rowVersion,
      actorUserId: ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `${MARKER}--publish-program-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });

    const cycle = await createCycle({
      organizationId: ORG_ID,
      programId,
      name: 'RN-G4 fixture Cycle',
      ...baseCycleTimes(),
      createdBy: ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `${MARKER}--create-cycle-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    cycleId = cycle.result.cycleId;

    parent = await buildActiveSetWithObjective({
      programId,
      cycleId,
      scopeType: 'team',
      scopeId: `${MARKER}--team`,
      ownerUserId: MANAGER,
      reviewerUserId: ADMIN,
      title: 'RN-G4 parent',
    });
    child = await buildActiveSetWithObjective({
      programId,
      cycleId,
      scopeType: 'individual',
      scopeId: CONTRIBUTOR,
      ownerUserId: CONTRIBUTOR,
      reviewerUserId: MANAGER,
      title: 'RN-G4 child',
    });
  }, 60_000);

  afterAll(async () => {
    const client = pgClient();
    await client.connect();
    try {
      // Alignments FK-reference okr_vnext_objectives with NO CASCADE — must
      // be deleted BEFORE objectives, and this table is outside what
      // cleanupOkrE007Fixture-style helpers know to delete.
      await client.query(`DELETE FROM okr_vnext_alignments WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM okr_vnext_reviews WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM okr_vnext_reflections WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM okr_vnext_key_results WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM okr_vnext_objectives WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = $1`, [ORG_ID]);
      await client.query(
        `DELETE FROM rvn_platform_resource_acl
          WHERE resource_type = 'okr_set'
            AND resource_id IN (SELECT set_id::text FROM okr_vnext_sets WHERE organization_id = $1)`,
        [ORG_ID]
      );
      await client.query(
        `DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1 AND resource_type = 'okr_set'`,
        [ORG_ID]
      );
      await client.query(`DELETE FROM okr_vnext_set_versions WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`UPDATE okr_vnext_sets SET latest_approved_snapshot_id = NULL WHERE organization_id = $1`, [
        ORG_ID,
      ]);
      await client.query(`DELETE FROM okr_vnext_approved_snapshots WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM okr_vnext_sets WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM okr_vnext_checkin_occurrences WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM okr_vnext_cycles WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`UPDATE okr_vnext_programs SET active_policy_version_id = NULL WHERE organization_id = $1`, [
        ORG_ID,
      ]);
      await client.query(`DELETE FROM okr_vnext_program_policy_versions WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM okr_vnext_programs WHERE organization_id = $1`, [ORG_ID]);
      await client.query(
        `DELETE FROM rvn_platform_consumer_processed WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
        [ORG_ID]
      );
      await client.query(
        `DELETE FROM rvn_platform_outbox WHERE event_id IN (SELECT event_id FROM rvn_platform_events WHERE organization_id = $1)`,
        [ORG_ID]
      );
      await client.query(`DELETE FROM rvn_platform_events WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM users WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG_ID]);
    } finally {
      await client.end();
    }
  }, 60_000);

  it('Step 1 — child Objective proposes+accepts a real contributes_to alignment to the parent Objective', async () => {
    const proposeOutcome = await proposeAlignment({
      organizationId: ORG_ID,
      sourceObjectiveId: child.objectiveId,
      targetObjectiveId: parent.objectiveId,
      rationale: 'RN-G4 fixture — child contributes to parent',
      proposedBy: CONTRIBUTOR,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--propose-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    alignmentId = proposeOutcome.result.alignment.alignmentId;
    expect(proposeOutcome.result.alignment.status).toBe('proposed');

    const acceptOutcome = await acceptAlignment({
      alignmentId,
      organizationId: ORG_ID,
      expectedVersion: proposeOutcome.result.alignment.rowVersion,
      actorUserId: MANAGER,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--accept-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    expect(acceptOutcome.result.status).toBe('accepted');

    // Independent DB-level readback (RN-G5 strengthening — the two checks
    // above only assert the commands' OWN echoed return values; nothing
    // upstream re-reads okr_vnext_alignments itself, so a command that
    // silently no-oped but still returned a fabricated
    // {status:'accepted'} response would not have been caught). This has
    // no dedicated repository read function in this codebase (same
    // precedent as the direct `decisions`/`okr_vnext_reflections` reads
    // elsewhere in this file and in okrAlignmentCycleMismatch-adjacent
    // realdb tests) — confirms the row genuinely exists, with the right
    // source/target/relation/status, independent of what the commands
    // claimed.
    const alignmentClient = pgClient();
    await alignmentClient.connect();
    try {
      const row = await alignmentClient.query<{
        source_objective_id: string;
        target_objective_id: string;
        relation: string;
        status: string;
      }>(
        `SELECT source_objective_id, target_objective_id, relation, status
           FROM okr_vnext_alignments WHERE alignment_id = $1 AND organization_id = $2`,
        [alignmentId, ORG_ID]
      );
      expect(row.rows).toHaveLength(1);
      expect(row.rows[0]!.source_objective_id).toBe(child.objectiveId);
      expect(row.rows[0]!.target_objective_id).toBe(parent.objectiveId);
      expect(row.rows[0]!.relation).toBe('contributes_to');
      expect(row.rows[0]!.status).toBe('accepted');
    } finally {
      await alignmentClient.end();
    }
  });

  it('Step 2 — finalScoreOkrSet on the PARENT Set writes a real score for the parent Objective and does not touch the child Objective at all', async () => {
    const childBefore = await readObjectiveRow(child.objectiveId);
    const childReflectionsBefore = await readReflectionRows(child.objectiveId);
    expect(childReflectionsBefore).toEqual([]);

    const parentSetVersion = await readSetVersion(parent.setId);
    const parentReview = await runOkrSetLifecycleTransition(OKR_SET_OPEN_REVIEW_SPEC, {
      setId: parent.setId,
      organizationId: ORG_ID,
      expectedVersion: parentSetVersion,
      actorUserId: MANAGER,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--parent-open-review-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });

    const scoreOutcome = await finalScoreOkrSet({
      setId: parent.setId,
      organizationId: ORG_ID,
      expectedVersion: parentReview.resultingVersion,
      actorUserId: MANAGER,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--parent-final-score-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    const parentScored = scoreOutcome.result.scoredObjectives.find((o) => o.objectiveId === parent.objectiveId);
    expect(parentScored).toBeTruthy();
    // `finalScore` legitimately resolves to `null` here — this fixture
    // never runs a real check-in (a separate cadence-occurrence mechanism,
    // `recordCheckIn`), so `okr_vnext_objectives.progress` was never
    // rolled up from the KRs' current/target values; `applyOkrScoringModel`
    // (okrReflectionCommands.ts) returns `{score: null, unsupported: false}`
    // for `rawProgress === null`, which is a real, honest "missing data"
    // outcome, not a bug in this fixture or the command under test — the
    // claim this test proves (no inheritance to the child) does not depend
    // on the parent's score being numeric.
    expect(parentScored!.scoringModelUnsupported).toBe(false);
    const parentReflectionRow = (await readReflectionRows(parent.objectiveId))[0] as { final_score: string | null };
    expect(parentReflectionRow).toBeTruthy();

    // The literal claim under test: the CHILD Objective row is
    // byte-for-byte identical after the PARENT's scoring command ran — not
    // just the two columns someone might guess ("score"/"rating"), the
    // FULL row (same discipline as alignmentNoScoreMutation.realdb.test.ts
    // Layer 3, applied to finalScoreOkrSet instead of the alignment
    // commands themselves).
    const childAfter = await readObjectiveRow(child.objectiveId);
    expect(childAfter).toEqual(childBefore);

    // The literal claim under test, DB-level: zero reflection rows exist
    // for the child Objective — no score was fabricated/inherited for it.
    // (No dedicated read repository exists for `okr_vnext_reflections` in
    // this codebase — every other realdb test file in this area,
    // e.g. `okrReflectionVisibilityJoin.realdb.test.ts`, also reads this
    // table directly; there is no narrower "public path" available yet.)
    const childReflectionsAfter = await readReflectionRows(child.objectiveId);
    expect(childReflectionsAfter).toEqual([]);
  }, 30_000);

  it('Step 3 — the child Objective ONLY receives its own final score after its OWNER explicitly runs finalScoreOkrSet on the child\'s own Set', async () => {
    const childSetVersion = await readSetVersion(child.setId);
    const childReview = await runOkrSetLifecycleTransition(OKR_SET_OPEN_REVIEW_SPEC, {
      setId: child.setId,
      organizationId: ORG_ID,
      expectedVersion: childSetVersion,
      actorUserId: CONTRIBUTOR,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--child-open-review-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });

    const scoreOutcome = await finalScoreOkrSet({
      setId: child.setId,
      organizationId: ORG_ID,
      expectedVersion: childReview.resultingVersion,
      actorUserId: CONTRIBUTOR,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--child-final-score-${randomUUID()}`,
      access: { capabilities: ['*'], platformRole: null },
    });
    const childScored = scoreOutcome.result.scoredObjectives.find((o) => o.objectiveId === child.objectiveId);
    expect(childScored).toBeTruthy();
    expect(childScored!.scoringModelUnsupported).toBe(false);

    const childReflectionsAfter = await readReflectionRows(child.objectiveId);
    expect(childReflectionsAfter).toHaveLength(1);

    // Cold reopen — the parent's own reflection, read fresh, is unaffected
    // by the child now also having one (proves the relationship never runs
    // in either direction automatically).
    const parentReflectionsAfter = await readReflectionRows(parent.objectiveId);
    expect(parentReflectionsAfter).toHaveLength(1);
  }, 30_000);
});
