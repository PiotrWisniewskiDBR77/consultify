/**
 * ROI-E008 — `recordRoiPirTeresaLessonsDraft` + the full Teresa P08 handoff,
 * against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E008_DESIGN.md §2/A3.
 *
 * Five scenarios (design's own numbering):
 *   1. Start a PIR (reuse ROI-E006's own test setup, `roiPirRealdbFixtures
 *      .buildCaseThroughPirStarted`).
 *   2. Run the FULL P08 handoff (createProposal -> approveProposal ->
 *      executeProposal, real teresa_proposals/teresa_handoff_results rows,
 *      real rvn_roi_post_investment_reviews write) -> assert lessons_learned
 *      unchanged, only the two Teresa columns change (AC-01/AC-03 literal
 *      proof).
 *   3. Separately call `recordRoiPirTeresaDraftDisposition({disposition:
 *      'accepted', finalLessonsText})` -> assert lessons_learned NOW
 *      updates — proves the 2-gate structure is real (literal AC-03 proof).
 *   4. Attempt `closeRoiCase` with a draft generated but no disposition
 *      recorded -> assert `PIR_INCOMPLETE` still fires, proving ROI-E008
 *      doesn't weaken ROI-E006's own gate.
 *   5. D6/D13 proof: attempt a second `recordRoiPirTeresaLessonsDraft` after
 *      a disposition was recorded -> assert `DISPOSITION_ALREADY_RECORDED`.
 *
 * Skeleton copied from `roiPirTeresaDisposition.realdb.test.ts` (ROI-E006)
 * — same `DB_CONFIGURED` skip-gate, `freshPir()` helper shape, teardown.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildCaseThroughPirStarted,
  buildClientConfig,
  cleanupRoiPirFixtures,
  DB_CONFIGURED,
  insertInitiative,
  insertOrganization,
  insertVisibilityPolicy,
  loadRoiPirTestModules,
  type PirStartedBuildResult,
  type RoiPirTestModules,
} from './roiPirRealdbFixtures.js';

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `roi-e008-teresa-draft-org-${tag}`;
const USER_OWNER = `roi-e008-teresa-draft-owner-${tag}`;
const USER_APPROVER = `roi-e008-teresa-draft-approver-${tag}`;
const USER_CLOSER = `roi-e008-teresa-draft-closer-${tag}`;
const INITIATIVE_ID = `roi-e008-teresa-draft-init-${tag}`;

let client: Client;
let reachable = false;
let modules: RoiPirTestModules;
let seq = 0;

type TeresaServiceModule = typeof import('../../../server/src/services/v8/teresaCopilotService.js');
let teresaService: TeresaServiceModule;

async function freshPir(): Promise<PirStartedBuildResult> {
  seq += 1;
  const initiativeId = `${INITIATIVE_ID}-${seq}`;
  await insertInitiative(client, initiativeId, ORG_ID, `Teresa lessons-draft fixture ${seq}`);
  return buildCaseThroughPirStarted(client, modules, {
    organizationId: ORG_ID,
    initiativeId,
    ownerUserId: USER_OWNER,
    approverId: USER_APPROVER,
  });
}

function buildRoiHandoffContext() {
  return {
    origin: 'teresa',
    user_intent: 'draft PIR lessons learned',
    active_surface: 'results/roi',
    org_context_ref: `org:${ORG_ID}`,
    bounded_context_pack: [],
    constraints: [],
    assumptions: [],
    uncertainty_boundary: { missing_inputs: [], conflicts: [], what_would_change_next_action: [] },
    evidence_pointers: ['note:roi-pir-draft'],
    proposed_next_action: { target_module: 'roi', handoff_intent: 'append', requires_approval: true },
    audit_stub: { actor: 'teresa:copilot', timestamp: new Date().toISOString() },
  } as any;
}

function buildRoiTargetPayload(params: { pirId: string; caseId: string; expectedVersion: number }) {
  return {
    roi_handoff_context: {
      advisor_mode: 'pir_lessons_draft',
      target_resource: { resource_type: 'roi_pir', resource_id: params.pirId },
      case_id: params.caseId,
      expected_version: params.expectedVersion,
      pir_lessons_draft: {
        draft_lessons_text: 'Teresa-drafted: automate the manual reconciliation step earlier in the rollout.',
        evidence_breakdown: {
          facts: ['benefits realized below target in month 2'],
          inference: ['manual reconciliation delayed corrective action'],
          missing_evidence: ['vendor SLA report'],
          recommendation: 'automate reconciliation before next rollout',
        },
      },
    },
    evidence_pointers: [`roi_pir:${params.pirId}`],
  };
}

describe('ROI-E008 recordRoiPirTeresaLessonsDraft + full P08 handoff (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error(
        '[skip] No Postgres configured — ROI-E008 teresaPirLessonsDraft realdb tests did NOT run. This run is not evidence.'
      );
      return;
    }
    client = new Client(buildClientConfig() as ClientConfig);
    await client.connect();
    await client.query('SELECT 1 FROM rvn_roi_post_investment_reviews LIMIT 0');
    await client.query('SELECT 1 FROM teresa_proposals LIMIT 0');
    reachable = true;

    modules = await loadRoiPirTestModules();
    teresaService = await import('../../../server/src/services/v8/teresaCopilotService.js');

    await insertOrganization(client, ORG_ID, 'ROI-E008 Teresa Lessons-Draft RealDB Org');
    await insertVisibilityPolicy(client, ORG_ID, 'roi', 'OPEN_ORG', USER_OWNER);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await client.query(`DELETE FROM teresa_handoff_results WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM teresa_audit_log WHERE proposal_id IN (SELECT id FROM teresa_proposals WHERE organization_id = $1)`, [
      ORG_ID,
    ]);
    await client.query(`DELETE FROM teresa_proposals WHERE organization_id = $1`, [ORG_ID]);
    await cleanupRoiPirFixtures(client, ORG_ID);
    await client.end();
    if (modules.closePgPool) await modules.closePgPool();
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
    '1+2. full P08 handoff (createProposal -> approveProposal -> executeProposal) writes ONLY the two Teresa columns, lessons_learned stays untouched',
    async () => {
      const started = await freshPir();

      const handoffContext = buildRoiHandoffContext();
      const targetPayload = buildRoiTargetPayload({
        pirId: started.pirId,
        caseId: started.caseId,
        expectedVersion: started.pirRowVersion,
      });

      const proposal = await teresaService.createProposal({
        organizationId: ORG_ID,
        userId: USER_APPROVER,
        // Plain UUID, not a `session-<uuid>` string — `runtime_binding
        // .conversation_id` defaults to this sessionId and flows through to
        // `recordRoiPirTeresaLessonsDraft`'s `correlationId`, which lands in
        // `rvn_platform_events.correlation_id` (a real UUID column) — a
        // prefixed non-UUID string fails there on real Postgres, caught only
        // by actually running this test against it.
        sessionId: randomUUID(),
        handoffContext,
        targetModule: 'roi',
        targetPayload,
      });
      expect(proposal.state).toBe('proposal');

      await teresaService.approveProposal({
        proposalId: proposal.id,
        organizationId: ORG_ID,
        userId: USER_APPROVER,
      });

      const result: any = await teresaService.executeProposal({
        proposalId: proposal.id,
        organizationId: ORG_ID,
        userId: USER_APPROVER,
      });

      expect(result.success).toBe(true);
      expect(result.state).toBe('completed');
      expect(result.handoff_result.handoff).toBe('roi');
      expect(result.handoff_result.advisor_mode).toBe('pir_lessons_draft');
      expect(result.handoff_result.pir_id).toBe(started.pirId);
      expect(result.handoff_result.case_id).toBe(started.caseId);
      expect(result.handoff_result.real_entity).toBe(true);
      expect(result.handoff_result.outcome).toBe('applied');

      // AC-01/AC-03 literal proof: only the two Teresa columns changed —
      // lessons_learned/outcome/recommendation stay exactly as they were
      // (all NULL, this PIR was never drafted by a human).
      const dbRow = await client.query<{
        lessons_learned: string | null;
        outcome: string | null;
        recommendation: string | null;
        teresa_draft_lessons_payload: unknown;
        teresa_draft_generated_at: string | null;
        teresa_draft_disposition: string | null;
      }>(
        `SELECT lessons_learned, outcome, recommendation, teresa_draft_lessons_payload, teresa_draft_generated_at, teresa_draft_disposition
           FROM rvn_roi_post_investment_reviews WHERE pir_id = $1`,
        [started.pirId]
      );
      const row = dbRow.rows[0]!;
      expect(row.lessons_learned).toBeNull();
      expect(row.outcome).toBeNull();
      expect(row.recommendation).toBeNull();
      expect(row.teresa_draft_disposition).toBeNull();
      expect(row.teresa_draft_generated_at).not.toBeNull();
      expect(row.teresa_draft_lessons_payload).toMatchObject({
        draft_lessons_text: 'Teresa-drafted: automate the manual reconciliation step earlier in the rollout.',
      });

      // Teresa's own audit trail — a real, non-fallback receipt.
      const receipt = await client.query(
        `SELECT result_ref FROM teresa_handoff_results WHERE proposal_id = $1 AND target_module = 'roi'`,
        [proposal.id]
      );
      expect(receipt.rows).toHaveLength(1);
      expect(receipt.rows[0]!.result_ref).toBe(started.pirId);

      // ---- 3. Separately dispose the draft -> lessons_learned NOW updates. ----
      const afterDraftVersion = Number(result.handoff_result.row_version);
      const dispositionOutcome = await modules.recordRoiPirTeresaDraftDisposition({
        pirId: started.pirId,
        caseId: started.caseId,
        organizationId: ORG_ID,
        expectedVersion: afterDraftVersion,
        disposition: 'accepted',
        finalLessonsText: 'Teresa draft accepted: automate the manual reconciliation step.',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `disposition-${randomUUID()}`,
      });
      expect(dispositionOutcome.outcome).toBe('applied');
      expect(dispositionOutcome.result.lessonsLearned).toBe(
        'Teresa draft accepted: automate the manual reconciliation step.'
      );

      const dbRowAfterDisposition = await client.query<{ lessons_learned: string }>(
        `SELECT lessons_learned FROM rvn_roi_post_investment_reviews WHERE pir_id = $1`,
        [started.pirId]
      );
      expect(dbRowAfterDisposition.rows[0]!.lessons_learned).toBe(
        'Teresa draft accepted: automate the manual reconciliation step.'
      );
    }
  );

  itDB(
    '4. closeRoiCase still requires outcome+lessons_learned even after a Teresa draft (no disposition) — PIR_INCOMPLETE, ROI-E006 gate not weakened',
    async () => {
      const started = await freshPir();

      const draftOutcome = await import('../../../server/src/services/resultsVnext/roi/roiPirCommands.js').then(
        (mod) =>
          mod.recordRoiPirTeresaLessonsDraft({
            pirId: started.pirId,
            caseId: started.caseId,
            organizationId: ORG_ID,
            expectedVersion: started.pirRowVersion,
            draftPayload: { draft_lessons_text: 'draft only, never disposed', evidence_breakdown: {} },
            actorUserId: USER_OWNER,
            actorEffectiveRole: 'teresa_initiated',
            idempotencyKey: `draft-${randomUUID()}`,
          })
      );
      expect(draftOutcome.outcome).toBe('applied');

      await expect(
        modules.closeRoiCase({
          caseId: started.caseId,
          organizationId: ORG_ID,
          expectedVersion: started.rowVersion,
          actorUserId: USER_CLOSER,
          actorEffectiveRole: 'admin',
          idempotencyKey: `close-${randomUUID()}`,
        })
      ).rejects.toMatchObject({ code: 'PIR_INCOMPLETE' });
    }
  );

  itDB(
    '5. D6/D13: a second recordRoiPirTeresaLessonsDraft after a disposition was recorded -> DISPOSITION_ALREADY_RECORDED',
    async () => {
      const started = await freshPir();
      const { recordRoiPirTeresaLessonsDraft } = await import(
        '../../../server/src/services/resultsVnext/roi/roiPirCommands.js'
      );

      const firstDraft = await recordRoiPirTeresaLessonsDraft({
        pirId: started.pirId,
        caseId: started.caseId,
        organizationId: ORG_ID,
        expectedVersion: started.pirRowVersion,
        draftPayload: { draft_lessons_text: 'first draft', evidence_breakdown: {} },
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'teresa_initiated',
        idempotencyKey: `draft1-${randomUUID()}`,
      });
      expect(firstDraft.outcome).toBe('applied');

      const dispositionOutcome = await modules.recordRoiPirTeresaDraftDisposition({
        pirId: started.pirId,
        caseId: started.caseId,
        organizationId: ORG_ID,
        expectedVersion: firstDraft.resultingVersion,
        disposition: 'rejected',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `disposition-${randomUUID()}`,
      });
      expect(dispositionOutcome.result.teresaDraftDisposition).toBe('rejected');

      // D6/D13: regeneration is now blocked, forever, for this PIR.
      await expect(
        recordRoiPirTeresaLessonsDraft({
          pirId: started.pirId,
          caseId: started.caseId,
          organizationId: ORG_ID,
          expectedVersion: dispositionOutcome.resultingVersion,
          draftPayload: { draft_lessons_text: 'second draft, must be blocked', evidence_breakdown: {} },
          actorUserId: USER_OWNER,
          actorEffectiveRole: 'teresa_initiated',
          idempotencyKey: `draft2-${randomUUID()}`,
        })
      ).rejects.toMatchObject({ code: 'DISPOSITION_ALREADY_RECORDED' });
    }
  );

  itDB('guard: rejects drafting once the PIR is no longer "draft" (finalized)', async () => {
    const started = await freshPir();
    const { recordRoiPirTeresaLessonsDraft } = await import(
      '../../../server/src/services/resultsVnext/roi/roiPirCommands.js'
    );
    await modules.updateRoiPostInvestmentReviewDraft({
      pirId: started.pirId,
      caseId: started.caseId,
      organizationId: ORG_ID,
      expectedVersion: started.pirRowVersion,
      outcome: 'benefits_fully_realized',
      lessonsLearned: 'Ship smaller batches.',
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `draft-${randomUUID()}`,
    });
    const closeOutcome = await modules.closeRoiCase({
      caseId: started.caseId,
      organizationId: ORG_ID,
      expectedVersion: started.rowVersion,
      actorUserId: USER_CLOSER,
      actorEffectiveRole: 'admin',
      idempotencyKey: `close-${randomUUID()}`,
    });
    expect(closeOutcome.result.pir.status).toBe('finalized');

    await expect(
      recordRoiPirTeresaLessonsDraft({
        pirId: started.pirId,
        caseId: started.caseId,
        organizationId: ORG_ID,
        expectedVersion: closeOutcome.result.pir.rowVersion,
        draftPayload: { draft_lessons_text: 'too late', evidence_breakdown: {} },
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'teresa_initiated',
        idempotencyKey: `draft-finalized-${randomUUID()}`,
      })
    ).rejects.toMatchObject({ code: 'NOT_EDITABLE' });
  });

  itDB('guard: case_id mismatch -> RoiPirNotFoundError (PIR_NOT_FOUND)', async () => {
    const started = await freshPir();
    const { recordRoiPirTeresaLessonsDraft } = await import(
      '../../../server/src/services/resultsVnext/roi/roiPirCommands.js'
    );
    await expect(
      recordRoiPirTeresaLessonsDraft({
        pirId: started.pirId,
        caseId: randomUUID(), // wrong case_id
        organizationId: ORG_ID,
        expectedVersion: started.pirRowVersion,
        draftPayload: { draft_lessons_text: 'wrong case', evidence_breakdown: {} },
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'teresa_initiated',
        idempotencyKey: `draft-wrongcase-${randomUUID()}`,
      })
    ).rejects.toMatchObject({ code: 'PIR_NOT_FOUND' });
  });
});
