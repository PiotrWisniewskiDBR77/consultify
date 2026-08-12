/**
 * Acceptance E2E — RN-G4, points 4+5 of the FALA 3 cross-domain evidence
 * brief (docs/product/results-vnext/RN_G4_CROSS_DOMAIN_EVIDENCE.md):
 *
 * 4. A "commitment" surfaced in MyWork (this program's own vocabulary is
 *    "obligation" — `rvn_platform_obligations`, see
 *    `server/src/services/resultsVnext/platform/obligations.ts`'s own file
 *    header: "the identical one-shot or recurring obligation tied to an
 *    aggregate, completed by the same domain command the UI calls")
 *    triggers the CORRECT domain command, and the result comes back into
 *    the owning domain — a real readback through the domain's own
 *    repository, not just a write nobody re-reads.
 * 5. A Decision's resolution comes back onto the OWNING domain's timeline —
 *    a real `rvn_platform_events` row plus a live, re-readable domain-side
 *    join, not a write that only `decisions` itself knows about.
 *
 * Both points share one real mechanism in this codebase: OKR-E006's
 * Support Request -> obligation -> {resolveSupportRequest directly, OR
 * requestDecisionFromSupportRequest -> real `decisions` row ->
 * acknowledgeDecisionResolution}. This file walks BOTH branches on two
 * separate Support Requests under the same Objective, using only real,
 * exported domain commands plus the real repository read functions
 * (`getSupportRequest`/`getDecisionLinkForSupportRequest`) as the "public
 * path" — never a raw-table read for anything this program has a
 * repository function for.
 *
 * KNOWN, DOCUMENTED LIMITATION: this codebase has no single canonical
 * "resolve a Decision" command with its own realDB test precedent — the
 * PRE-EXISTING `okrDecisionResolutionAcknowledgement.realdb.test.ts` (which
 * this file's Decision-branch scenario mirrors) resolves the underlying
 * `decisions` row via a direct SQL `UPDATE decisions SET status=...`
 * because `DecisionController.ts` (per EXECUTION_LEDGER.md §51) emits ZERO
 * `rvn_platform_events` and has no exported service-layer function this
 * acceptance harness can call directly — reaching it would require mounting
 * the full authenticated PMO decisions router (`requireDecisionCapability`
 * + `verifyToken`), which is a materially larger harness than every other
 * file in `tests/acceptance/`. This file follows the SAME established
 * precedent for the decision-side mutation only; every OKR-side command
 * (raise/resolve/request-decision/acknowledge) is real.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { pgClient, requireLocalDbUrl } from './harness.js';

requireLocalDbUrl();

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const MARKER = `odbior--rn-g4--mywork-commitment-decision--${tag}`;
const ORG_ID = `${MARKER}--org`;
const ADMIN = `${MARKER}--admin`;
const OWNER = `${MARKER}--owner`; // Objective owner, raises the support requests
const MANAGER = `${MARKER}--manager`; // assignee of the obligation, resolves them

type ProgramCommandsModule = typeof import('../../server/src/services/resultsVnext/okr/okrProgramCommands.js');
type CycleCommandsModule = typeof import('../../server/src/services/resultsVnext/okr/okrCycleCommands.js');
type SetCommandsModule = typeof import('../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ObjectiveCommandsModule = typeof import('../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js');
type SupportCommandsModule = typeof import('../../server/src/services/resultsVnext/okr/okrSupportCommands.js');
type SupportRepositoryModule = typeof import('../../server/src/services/resultsVnext/okr/okrSupportRepository.js');
type DecisionCommandsModule = typeof import('../../server/src/services/resultsVnext/okr/okrDecisionCommands.js');
type SchedulerModule = typeof import('../../server/src/services/resultsVnext/okr/okrDecisionResolutionScanner.js');

let createProgram: ProgramCommandsModule['createProgram'];
let publishProgram: ProgramCommandsModule['publishProgram'];
let createCycle: CycleCommandsModule['createCycle'];
let createOkrSet: SetCommandsModule['createOkrSet'];
let createObjective: ObjectiveCommandsModule['createObjective'];
let raiseSupportRequest: SupportCommandsModule['raiseSupportRequest'];
let resolveSupportRequest: SupportCommandsModule['resolveSupportRequest'];
let getSupportRequest: SupportRepositoryModule['getSupportRequest'];
let getDecisionLinkForSupportRequest: SupportRepositoryModule['getDecisionLinkForSupportRequest'];
let requestDecisionFromSupportRequest: DecisionCommandsModule['requestDecisionFromSupportRequest'];
let acknowledgeDecisionResolution: DecisionCommandsModule['acknowledgeDecisionResolution'];
let scanAndAcknowledgeResolvedDecisionLinks: SchedulerModule['scanAndAcknowledgeResolvedDecisionLinks'];

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

async function readObligation(referenceId: string): Promise<{
  status: string;
  assignee_user_id: string;
  completed_via_command: string | null;
} | null> {
  const client = pgClient();
  await client.connect();
  try {
    const result = await client.query(
      `SELECT status, assignee_user_id, completed_via_command FROM rvn_platform_obligations
        WHERE organization_id = $1 AND reference_type = 'okr_support_request' AND reference_id = $2`,
      [ORG_ID, referenceId]
    );
    return result.rows[0] ?? null;
  } finally {
    await client.end();
  }
}

describe('RN-G4 · Point 4+5 — MyWork obligation triggers the right domain command with readback; Decision resolution returns to the domain timeline', () => {
  let programId: string;
  let cycleId: string;
  let setId: string;
  let objectiveId: string;

  beforeAll(async () => {
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
        [OWNER, `${OWNER}@acceptance.local`],
        [MANAGER, `${MANAGER}@acceptance.local`],
      ]) {
        await client.query(
          `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name, created_at)
           VALUES ($1, $2, $3, 'x', 'ADMIN', 'active', 'RNG4', 'Fixture', now())`,
          [id, ORG_ID, email]
        );
      }
    } finally {
      await client.end();
    }

    const programCommands: ProgramCommandsModule = await import(
      '../../server/src/services/resultsVnext/okr/okrProgramCommands.js'
    );
    ({ createProgram, publishProgram } = programCommands);
    const cycleCommands: CycleCommandsModule = await import(
      '../../server/src/services/resultsVnext/okr/okrCycleCommands.js'
    );
    ({ createCycle } = cycleCommands);
    const setCommands: SetCommandsModule = await import('../../server/src/services/resultsVnext/okr/okrSetCommands.js');
    ({ createOkrSet } = setCommands);
    const objectiveCommands: ObjectiveCommandsModule = await import(
      '../../server/src/services/resultsVnext/okr/okrObjectiveCommands.js'
    );
    ({ createObjective } = objectiveCommands);
    const supportCommands: SupportCommandsModule = await import(
      '../../server/src/services/resultsVnext/okr/okrSupportCommands.js'
    );
    ({ raiseSupportRequest, resolveSupportRequest } = supportCommands);
    const supportRepository: SupportRepositoryModule = await import(
      '../../server/src/services/resultsVnext/okr/okrSupportRepository.js'
    );
    ({ getSupportRequest, getDecisionLinkForSupportRequest } = supportRepository);
    const decisionCommands: DecisionCommandsModule = await import(
      '../../server/src/services/resultsVnext/okr/okrDecisionCommands.js'
    );
    ({ requestDecisionFromSupportRequest, acknowledgeDecisionResolution } = decisionCommands);
    const scannerModule: SchedulerModule = await import(
      '../../server/src/services/resultsVnext/okr/okrDecisionResolutionScanner.js'
    );
    ({ scanAndAcknowledgeResolvedDecisionLinks } = scannerModule);

    const program = await createProgram({
      organizationId: ORG_ID,
      name: 'RN-G4 fixture Program',
      createdBy: ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `${MARKER}--create-program-${randomUUID()}`,
    });
    programId = program.result.programId;
    await publishProgram({
      programId,
      organizationId: ORG_ID,
      expectedVersion: program.result.rowVersion,
      actorUserId: ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `${MARKER}--publish-program-${randomUUID()}`,
    });

    const cycle = await createCycle({
      organizationId: ORG_ID,
      programId,
      name: 'RN-G4 fixture Cycle',
      ...baseCycleTimes(),
      createdBy: ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `${MARKER}--create-cycle-${randomUUID()}`,
    });
    cycleId = cycle.result.cycleId;

    const set = await createOkrSet({
      organizationId: ORG_ID,
      programId,
      cycleId,
      scopeType: 'individual',
      scopeId: OWNER,
      ownerUserId: OWNER,
      reviewerUserId: MANAGER,
      title: 'RN-G4 fixture Set',
      createdBy: OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--create-set-${randomUUID()}`,
    });
    setId = set.result.set.setId;

    const objective = await createObjective({
      setId,
      organizationId: ORG_ID,
      ownerUserId: OWNER,
      title: 'RN-G4 fixture Objective',
      createdBy: OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--create-objective-${randomUUID()}`,
    });
    objectiveId = objective.result.objectiveId;
  }, 30_000);

  afterAll(async () => {
    const client = pgClient();
    await client.connect();
    try {
      await client.query(`DELETE FROM okr_vnext_decision_links WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM decisions WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM okr_vnext_support_requests WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM rvn_platform_obligations WHERE organization_id = $1`, [ORG_ID]);
      await client.query(`DELETE FROM okr_vnext_objectives WHERE organization_id = $1`, [ORG_ID]);
      await client.query(
        `DELETE FROM rvn_platform_resource_visibility WHERE organization_id = $1 AND resource_type = 'okr_set'`,
        [ORG_ID]
      );
      await client.query(`DELETE FROM okr_vnext_sets WHERE organization_id = $1`, [ORG_ID]);
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

  it('Point 4, direct-resolve branch — raiseSupportRequest creates a real MyWork obligation for the assignee; resolveSupportRequest (the correct domain command) completes it AND the result reads back through the domain\'s own repository', async () => {
    const raised = await raiseSupportRequest({
      setId,
      objectiveId,
      keyResultId: null,
      organizationId: ORG_ID,
      body: 'RN-G4 fixture — need budget sign-off before I can proceed',
      assignedToUserId: MANAGER,
      createdBy: OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--raise-direct-${randomUUID()}`,
    });
    const requestId = raised.result.requestId;

    // The "commitment in MyWork": a real, open obligation assigned to the
    // manager, referencing THIS support request.
    const obligationAfterRaise = await readObligation(requestId);
    expect(obligationAfterRaise).toBeTruthy();
    expect(obligationAfterRaise!.status).toBe('open');
    expect(obligationAfterRaise!.assignee_user_id).toBe(MANAGER);

    // The manager acts on the MyWork item by calling the CORRECT domain
    // command for a direct resolution.
    const resolveOutcome = await resolveSupportRequest({
      requestId,
      organizationId: ORG_ID,
      expectedVersion: raised.result.rowVersion,
      resolutionNote: 'RN-G4 fixture — budget approved verbally, proceed',
      actorUserId: MANAGER,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--resolve-direct-${randomUUID()}`,
    });
    expect(resolveOutcome.result.status).toBe('resolved');

    // The obligation is completed, tagged with the REAL command name that
    // completed it — not a generic "done" flag.
    const obligationAfterResolve = await readObligation(requestId);
    expect(obligationAfterResolve!.status).toBe('completed');
    expect(obligationAfterResolve!.completed_via_command).toBe('resolveSupportRequest');

    // READBACK, not just a write: a FRESH call to the domain's own public
    // repository read (getSupportRequest) — cold, no in-memory state
    // assumed — shows the result landed in the owning domain aggregate.
    const readback = await getSupportRequest({ userId: OWNER, organizationId: ORG_ID, requestId });
    expect(readback).toBeTruthy();
    expect(readback!.status).toBe('resolved');
    expect(readback!.resolutionNote).toBe('RN-G4 fixture — budget approved verbally, proceed');
    expect(readback!.resolvedBy).toBe(MANAGER);
  }, 30_000);

  it('Point 4+5, decision-escalation branch — the manager escalates the SAME kind of obligation to a real Decision; resolving that Decision writes back a real event on the OKR timeline, re-readable via the domain\'s own repository', async () => {
    const raised = await raiseSupportRequest({
      setId,
      objectiveId,
      keyResultId: null,
      organizationId: ORG_ID,
      body: 'RN-G4 fixture — need an executive call on scope, not just an FYI',
      assignedToUserId: MANAGER,
      createdBy: OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--raise-escalate-${randomUUID()}`,
    });
    const requestId = raised.result.requestId;

    const obligationAfterRaise = await readObligation(requestId);
    expect(obligationAfterRaise!.status).toBe('open');
    expect(obligationAfterRaise!.assignee_user_id).toBe(MANAGER);

    // The manager acts on the MyWork item by calling the CORRECT domain
    // command for this case — escalating to a real Decision rather than
    // resolving directly.
    const decisionOutcome = await requestDecisionFromSupportRequest({
      requestId,
      organizationId: ORG_ID,
      expectedVersion: raised.result.rowVersion,
      requestedDecision: 'Approve expanded scope for RN-G4 fixture Objective',
      impactOfDelay: 'Blocks the whole workstream',
      requestedBy: MANAGER,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--request-decision-${randomUUID()}`,
    });
    const linkId = decisionOutcome.result.decisionLink.linkId;
    const decisionId = decisionOutcome.result.decisionLink.decisionId;
    expect(decisionOutcome.result.supportRequest.decisionLinkId).toBe(linkId);

    // Real decisions row exists, correctly source-tagged back to the OKR
    // support request (verified via a real DB read — this table has no
    // dedicated repository read function in this codebase, same
    // established precedent as `okrDecisionSeam.realdb.test.ts`).
    const decisionRowClient = pgClient();
    await decisionRowClient.connect();
    let decisionSourceType: string;
    let decisionSourceId: string;
    try {
      const row = await decisionRowClient.query<{ source_type: string; source_id: string; status: string }>(
        `SELECT source_type, source_id, status FROM decisions WHERE id = $1 AND organization_id = $2`,
        [decisionId, ORG_ID]
      );
      expect(row.rows).toHaveLength(1);
      decisionSourceType = row.rows[0]!.source_type;
      decisionSourceId = row.rows[0]!.source_id;
      expect(row.rows[0]!.status).toBe('pending');
    } finally {
      await decisionRowClient.end();
    }
    expect(decisionSourceType).toBe('okr_support_request');
    expect(decisionSourceId).toBe(requestId);

    // Before resolution: acknowledgeDecisionResolution correctly refuses a
    // still-pending Decision (negative control on the "not yet resolved"
    // guard, real code path).
    await expect(
      acknowledgeDecisionResolution({
        linkId,
        organizationId: ORG_ID,
        expectedVersion: decisionOutcome.result.decisionLink.rowVersion,
        actorUserId: MANAGER,
        actorEffectiveRole: 'member',
        idempotencyKey: `${MARKER}--ack-too-early-${randomUUID()}`,
      })
    ).rejects.toThrow(/has not reached a terminal outcome|DECISION_NOT_YET_RESOLVED/i);

    // Real Decision resolution — documented limitation in this file's
    // header: no service-layer "decide" function exists to call directly
    // (DecisionController.ts is Express-only), so this mutation uses the
    // exact same technique the pre-existing
    // okrDecisionResolutionAcknowledgement.realdb.test.ts already
    // establishes for this program.
    const decisionMutateClient = pgClient();
    await decisionMutateClient.connect();
    try {
      await decisionMutateClient.query(
        `UPDATE decisions SET status = 'approved', decision_rationale = $1, decided_at = now() WHERE id = $2`,
        ['RN-G4 fixture — scope expansion approved.', decisionId]
      );
    } finally {
      await decisionMutateClient.end();
    }

    // Human-triggered acknowledgement path (a) — writes the resolution back
    // onto the OKR timeline as a real event, per file header point 5.
    const ackOutcome = await acknowledgeDecisionResolution({
      linkId,
      organizationId: ORG_ID,
      expectedVersion: decisionOutcome.result.decisionLink.rowVersion,
      actorUserId: MANAGER,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--ack-real-${randomUUID()}`,
    });
    expect(ackOutcome.result.decisionLink.resolutionAcknowledged).toBe(true);
    expect(ackOutcome.result.decisionStatus).toBe('approved');

    const eventClient = pgClient();
    await eventClient.connect();
    let eventRow: { event_type: string; after_state: Record<string, unknown> } | undefined;
    try {
      const result = await eventClient.query<{ event_type: string; after_state: Record<string, unknown> }>(
        `SELECT event_type, after_state FROM rvn_platform_events WHERE event_id = $1`,
        [ackOutcome.eventId]
      );
      eventRow = result.rows[0];
    } finally {
      await eventClient.end();
    }
    expect(eventRow).toBeTruthy();
    expect(eventRow!.event_type).toBe('okr_support.decision_resolution_acknowledged');
    expect((eventRow!.after_state as { decisionStatus?: string }).decisionStatus).toBe('approved');

    // READBACK — cold, public-path repository call, no in-memory state
    // assumed — the domain timeline (via the decision link's live JOIN to
    // `decisions`) shows the resolution.
    const readback = await getDecisionLinkForSupportRequest({ userId: OWNER, organizationId: ORG_ID, requestId });
    expect(readback).toBeTruthy();
    expect(readback!.resolutionAcknowledged).toBe(true);
    expect(readback!.decisionStatus).toBe('approved');
    expect(readback!.decisionRationale).toBe('RN-G4 fixture — scope expansion approved.');
  }, 30_000);

  it('Point 5, scheduled-actor variant — scanAndAcknowledgeResolvedDecisionLinks (the unattended path) ALSO writes the resolution back onto the domain timeline, re-readable the same way', async () => {
    const raised = await raiseSupportRequest({
      setId,
      objectiveId,
      keyResultId: null,
      organizationId: ORG_ID,
      body: 'RN-G4 fixture — third request, resolved by the scheduler',
      assignedToUserId: MANAGER,
      createdBy: OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--raise-scheduled-${randomUUID()}`,
    });
    const requestId = raised.result.requestId;

    const decisionOutcome = await requestDecisionFromSupportRequest({
      requestId,
      organizationId: ORG_ID,
      expectedVersion: raised.result.rowVersion,
      requestedDecision: 'Reject the third RN-G4 fixture ask',
      impactOfDelay: 'Minor',
      requestedBy: MANAGER,
      actorEffectiveRole: 'member',
      idempotencyKey: `${MARKER}--request-decision-scheduled-${randomUUID()}`,
    });
    const decisionId = decisionOutcome.result.decisionLink.decisionId;

    const decisionMutateClient = pgClient();
    await decisionMutateClient.connect();
    try {
      await decisionMutateClient.query(
        `UPDATE decisions SET status = 'rejected', decision_rationale = $1, decided_at = now() WHERE id = $2`,
        ['RN-G4 fixture — rejected, out of scope for this cycle.', decisionId]
      );
    } finally {
      await decisionMutateClient.end();
    }

    const scanResult = await scanAndAcknowledgeResolvedDecisionLinks({ organizationId: ORG_ID });
    expect(scanResult.errors).toHaveLength(0);
    expect(scanResult.acknowledged).toBeGreaterThanOrEqual(1);

    // Cold readback via the SAME public repository function used above —
    // the unattended/scheduled trigger produced a domain-visible result
    // identically to the human-triggered path.
    const readback = await getDecisionLinkForSupportRequest({ userId: OWNER, organizationId: ORG_ID, requestId });
    expect(readback).toBeTruthy();
    expect(readback!.resolutionAcknowledged).toBe(true);
    expect(readback!.decisionStatus).toBe('rejected');
    // Scheduled-actor trigger — acknowledged by nobody human.
    expect(readback!.resolutionAcknowledgedBy).toBeNull();
  }, 30_000);
});
