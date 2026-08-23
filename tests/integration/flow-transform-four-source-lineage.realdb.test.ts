import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://consultinity:consultinity@localhost:5442/consultinity';
process.env.DATABASE_URL = DATABASE_URL;
process.env.DB_TYPE = 'postgres';
const runRealDb = process.env.RUN_DB_TESTS === '1' && DATABASE_URL.startsWith('postgres');
const describeRealDb = runRealDb ? describe : describe.skip;

const prefix = `flow-four-${Date.now()}`;
const org = `${prefix}-org`;
const foreignOrg = `${prefix}-foreign`;
const maker = `${prefix}-maker`;
const checker = `${prefix}-checker`;
const projectId = `${prefix}-project`;
const kinds = ['organization', 'interview', 'drd', 'swot'] as const;
type Kind = (typeof kinds)[number];
const sourceReceipts = new Map<Kind, string>();
const sourceCandidates = new Map<Kind, string>();

async function db() {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  return c;
}

async function seedChain(client: Client, kind: Kind, candidateId: string) {
  const initiativeId = `${prefix}-${kind}-initiative`;
  const caseId = `${prefix}-${kind}-case`;
  const executionLinkId = randomUUID();
  const roiCaseId = randomUUID();
  const actualId = randomUUID();
  const financeLinkId = randomUUID();
  const reconciliationId = randomUUID();
  const decisionId = randomUUID();
  const pirId = randomUUID();
  await client.query(
    `INSERT INTO initiatives(id,name,organization_id,status) VALUES ($1,$2,$3,'EXECUTING')`,
    [initiativeId, `${kind} initiative`, org]
  );
  await client.query(
    `UPDATE initiative_candidates
        SET status='accepted', initiative_id=$1, accepted_at=now()
      WHERE id=$2 AND organization_id=$3`,
    [initiativeId, candidateId, org]
  );
  await client.query(
    `INSERT INTO case_core(case_id,project_id,organization_id,case_name,created_by_actor_id,contracted_closure_type) VALUES ($1,$2,$3,$4,$5,'OUTCOME_VALIDATED')`,
    [caseId, projectId, org, `${kind} execution`, maker]
  );
  if (kind === 'swot') {
    await client.query(
      `INSERT INTO execution_case_links
        (link_id,organization_id,source_kind,runtime_initiative_id,runtime_execution_case_id,
         source_version,source_project_id,intake_idempotency_key,created_by)
       VALUES ($1,$2,'RUNTIME_V1',$3,$4,1,$5,$6,$7)`,
      [executionLinkId, org, initiativeId, caseId, projectId, `${prefix}-${kind}-execution`, maker]
    );
  } else {
    await client.query(
      `INSERT INTO execution_case_links(link_id,organization_id,initiative_id,case_id,project_id,intake_idempotency_key,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [executionLinkId, org, initiativeId, caseId, projectId, `${prefix}-${kind}-execution`, maker]
    );
  }
  await client.query(
    `INSERT INTO rvn_roi_cases(case_id,organization_id,initiative_id,title,owner_user_id,status,currency,created_by) VALUES ($1,$2,$3,$4,$5,'post_investment_review','PLN',$5)`,
    [roiCaseId, org, initiativeId, `${kind} results`, maker]
  );
  await client.query(
    `INSERT INTO rvn_roi_actual_snapshots(actual_snapshot_id,case_id,organization_id,sequence_number,as_of_period_end,published_by,periods_with_actual_count,periods_expected_count,unverified_entry_count,disputed_entry_count,entry_ids_included) VALUES ($1,$2,$3,1,CURRENT_DATE,$4,1,1,0,0,'[]')`,
    [actualId, roiCaseId, org, maker]
  );
  await client.query(`UPDATE rvn_roi_cases SET current_actual_snapshot_id=$1 WHERE case_id=$2`, [
    actualId,
    roiCaseId,
  ]);
  await client.query(
    `INSERT INTO rvn_roi_finance_links(link_id,case_id,organization_id,finance_artifact_type,finance_artifact_id,finance_version_id,source,as_of,link_purpose,linked_by,created_by) VALUES ($1,$2,$3,'business_version',$4,$5,'finance',now(),'reconciliation',$6,$6)`,
    [financeLinkId, roiCaseId, org, `${prefix}-${kind}-finance`, `${prefix}-${kind}-bv`, maker]
  );
  await client.query(
    `INSERT INTO rvn_roi_finance_reconciliations(reconciliation_id,case_id,organization_id,finance_link_id,roi_value,finance_value,status,opened_by,reconciliation_kind,results_actual_snapshot_id,results_actual_sequence_number,results_actual_metric,finance_artifact_id,finance_business_version_id,finance_working_revision_id,finance_content_semantic_hash,finance_tracked_metric,finance_pinned_value,source_identity_digest) VALUES ($1,$2,$3,$4,100,120,'open',$5,'dispute',$6,1,'npv',$7,$8,$9,$10,'npv',120,$11)`,
    [
      reconciliationId,
      roiCaseId,
      org,
      financeLinkId,
      maker,
      actualId,
      `${prefix}-${kind}-finance`,
      `${prefix}-${kind}-bv`,
      `${prefix}-${kind}-wr`,
      'f'.repeat(64),
      `${prefix}-${kind}-digest`,
    ]
  );
  await client.query(
    `INSERT INTO rvn_finance_reconciliation_decisions(decision_id,reconciliation_id,organization_id,decision_version,decision_status,resolution_notes,decided_by,decision_policy_version,decision_policy_digest) VALUES ($1,$2,$3,1,'resolved','checked',$4,'DEC-FIN-RESULTS-RECONCILIATION-001/v1','sha256:a0b04a2bcd42d9fa8a2680f0dd35008f4226bc92db5ecc63756732d7a8854e6d')`,
    [decisionId, reconciliationId, org, checker]
  );
  await client.query(
    `UPDATE rvn_roi_finance_reconciliations SET status='resolved',resolved_by=$1,resolved_at=now(),terminal_decision_id=$2,terminal_decision_version=1,terminal_decision_status='resolved',row_version=2 WHERE reconciliation_id=$3`,
    [checker, decisionId, reconciliationId]
  );
  await client.query(
    `INSERT INTO rvn_roi_post_investment_reviews(pir_id,case_id,organization_id,sequence_number,status,started_by,review_snapshot_payload,review_snapshot_hash,outcome,lessons_learned,recommendation,finalized_by,finalized_at,created_by) VALUES ($1,$2,$3,1,'finalized',$4,$5,$6,'benefits_fully_realized','learned','continue',$7,now(),$4)`,
    [
      pirId,
      roiCaseId,
      org,
      maker,
      JSON.stringify({ currentActualSnapshotId: actualId }),
      'e'.repeat(64),
      checker,
    ]
  );
}

async function produceCanonicalSources(client: Client) {
  const organizationSnapshotId = `${prefix}-organization-snapshot`;
  const interviewInsightId = `${prefix}-interview-insight`;
  const interviewFindingId = `${prefix}-interview-finding`;
  const assessmentId = `${prefix}-assessment`;
  const assessmentSnapshotId = `${prefix}-assessment-snapshot`;
  const swotSessionId = `${prefix}-swot`;
  const swotOutputId = `${prefix}-swot-output`;

  await client.query(
    `INSERT INTO organization_context_snapshot_versions
       (id,organization_id,version,schema_version,content_hash,claim_count,snapshot_json,source_refs_json,created_by)
     VALUES ($1,$2,1,1,$3,1,$4,'[]',$5)`,
    [
      organizationSnapshotId,
      org,
      'a'.repeat(64),
      JSON.stringify({ organizationId: org, claims: [{ claimId: 'flow-claim' }] }),
      maker,
    ]
  );
  await client.query(
    `INSERT INTO interview_insights(id,organization_id,title,status,content,created_by)
     VALUES ($1,$2,'Approved interview insight','completed','Accepted evidence',$3)`,
    [interviewInsightId, org, maker]
  );
  await client.query(
    `INSERT INTO interview_insight_findings
       (id,organization_id,insight_id,source_key,finding_statement,limits_text,next_action_text,review_status,readback_status,created_by)
     VALUES ($1,$2,$3,$4,'Confirmed interview finding','','Execute finding','published','confirmed_by_client',$5)`,
    [interviewFindingId, org, interviewInsightId, `${prefix}-finding-key`, maker]
  );
  await client.query(
    `INSERT INTO assessments(id,organization_id,status,name,assessment_type)
     VALUES ($1,$2,'APPROVED','Approved DRD','DRD')`,
    [assessmentId, org]
  );
  await client.query(
    `INSERT INTO assessment_accepted_snapshots
       (id,organization_id,assessment_id,review_id,snapshot_json,provenance_json,accepted_by,is_current)
     VALUES ($1,$2,$3,$4,$5,$6,$7,true)`,
    [
      assessmentSnapshotId,
      org,
      assessmentId,
      `${prefix}-drd-review`,
      JSON.stringify({ axis: 'strategy', score: 4 }),
      JSON.stringify({ source: 'owner-approved-drd' }),
      maker,
    ]
  );
  await client.query(
    `INSERT INTO tool_sessions
       (id,organization_id,project_id,tool_type,name,status,completion_percent,confidence_avg,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,$3,'dynamic-swot','Approved SWOT','APPROVED',100,4,$4,$4,now(),now())`,
    [swotSessionId, org, projectId, maker]
  );
  await client.query(
    `INSERT INTO tool_outputs
       (id,organization_id,tool_session_id,tool_type,method_pack_version,version,title,payload_json,content_hash,status,created_by,approved_by,approved_at,frozen_at)
     VALUES ($1,$2,$3,'dynamic-swot','dynamic-swot@1',1,'Approved SWOT output',$4,$5,'approved',$6,$6,now(),now())`,
    [
      swotOutputId,
      org,
      swotSessionId,
      JSON.stringify({
        sourceRevision: 1,
        conclusions: [{ id: 'rec', k3Actions: ['Execute approved SWOT recommendation'] }],
      }),
      'd'.repeat(16),
      maker,
    ]
  );

  const organizationService =
    await import('../../server/src/services/organizationContext/organizationSnapshotCandidateHandoffService.js');
  const interviewService =
    await import('../../server/src/services/interview/interviewCandidateHandoff.js');
  const drdService = await import('../../server/src/services/assessment/drdCandidateHandoff.js');
  const swotService =
    await import('../../server/src/services/tools/swotCandidateHandoffService.js');
  const produced = {
    organization: await organizationService.handoffOrganizationSnapshotToCandidate({
      organizationId: org,
      snapshotId: organizationSnapshotId,
      snapshotVersion: 1,
      snapshotContentHash: 'a'.repeat(64),
      actorId: maker,
    }),
    interview: await interviewService.approveInterviewCandidateHandoff({
      organizationId: org,
      actorId: maker,
      source: { kind: 'insight_finding', findingId: interviewFindingId },
    }),
    drd: await drdService.handoffAssessmentToCandidate({
      organizationId: org,
      assessmentId,
      actorId: maker,
    }),
    swot: await swotService.handoffSwotRecommendation({
      organizationId: org,
      toolSessionId: swotSessionId,
      recommendationId: 'rec',
      actorId: maker,
    }),
  };
  sourceReceipts.set('organization', produced.organization.receipt.receiptId);
  sourceReceipts.set('interview', produced.interview.handoff.id);
  sourceReceipts.set('drd', produced.drd.handoff.id);
  sourceReceipts.set('swot', produced.swot.receipt.receiptId);
  sourceCandidates.set('organization', produced.organization.candidate.id);
  sourceCandidates.set('interview', produced.interview.candidate.id);
  sourceCandidates.set('drd', produced.drd.candidate.id);
  sourceCandidates.set('swot', produced.swot.candidate.id);
}

beforeAll(async () => {
  if (!runRealDb) return;
  const databaseName = new URL(DATABASE_URL).pathname.slice(1);
  if (
    process.env.FLOW_ALLOW_IMMUTABLE_FIXTURE_CLEANUP !== '1' ||
    !databaseName.startsWith(process.env.FLOW_DISPOSABLE_DB_PREFIX || 'never-match')
  ) {
    throw new Error(
      'Four-source lineage requires an explicitly guarded disposable flow_* database'
    );
  }
  const client = await db();
  try {
    await client.query(
      await fs.readFile('server/migrations/20261035_flow_transform_source_lineage.sql', 'utf8')
    );
    await client.query(
      `INSERT INTO organizations(id,name) VALUES ($1,'Flow org'),($2,'Foreign org')`,
      [org, foreignOrg]
    );
    await client.query(
      `INSERT INTO projects(id,name,organization_id) VALUES ($1,'Flow project',$2)`,
      [projectId, org]
    );
    await produceCanonicalSources(client);
    for (const kind of kinds) await seedChain(client, kind, sourceCandidates.get(kind)!);
  } finally {
    await client.end();
  }
}, 30_000);

describeRealDb('FLOW-TRANSFORM four-source full lineage', () => {
  it('fails closed when one Initiative has both legacy and runtime Execution identities', async () => {
    const candidateId = sourceCandidates.get('swot')!;
    const client = await db();
    const initiative = await client.query<{ initiative_id: string }>(
      `SELECT initiative_id FROM initiative_candidates WHERE organization_id=$1 AND id=$2`,
      [org, candidateId]
    );
    const initiativeId = initiative.rows[0].initiative_id;
    const legacyLinkId = randomUUID();
    const legacyCaseId = `${prefix}-swot-ambiguous-legacy-case`;
    try {
      await client.query(
        `INSERT INTO case_core(case_id,project_id,organization_id,case_name,created_by_actor_id,contracted_closure_type)
         VALUES ($1,$2,$3,'Ambiguous legacy execution',$4,'OUTCOME_VALIDATED')`,
        [legacyCaseId, projectId, org, maker]
      );
      await client.query(
        `INSERT INTO execution_case_links
          (link_id,organization_id,initiative_id,case_id,project_id,intake_idempotency_key,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          legacyLinkId,
          org,
          initiativeId,
          legacyCaseId,
          projectId,
          `${prefix}-swot-ambiguous`,
          maker,
        ]
      );
      const { certifyFlowTransformLineage } =
        await import('../../server/src/services/flowTransform/flowTransformLineageService.js');
      await expect(
        certifyFlowTransformLineage({
          organizationId: org,
          sourceKind: 'swot',
          sourceReceiptId: sourceReceipts.get('swot')!,
          actorId: checker,
        })
      ).rejects.toMatchObject({ code: 'EXECUTION_IDENTITY_AMBIGUOUS', status: 409 });
      expect(
        (
          await client.query(
            `SELECT count(*)::int n FROM flow_transform_lineage_receipts
        WHERE organization_id=$1 AND source_kind='swot'`,
            [org]
          )
        ).rows[0].n
      ).toBe(0);
    } finally {
      await client.query(`DELETE FROM execution_case_links WHERE link_id=$1`, [legacyLinkId]);
      await client.query(`DELETE FROM case_core WHERE case_id=$1`, [legacyCaseId]);
      await client.end();
    }
  });

  it.each(kinds)(
    '%s source certifies stable source→Candidate→Initiative→Execution→Actual→Finance→PIR identities and cold replay',
    async (sourceKind) => {
      const { certifyFlowTransformLineage } =
        await import('../../server/src/services/flowTransform/flowTransformLineageService.js');
      const sourceReceiptId = sourceReceipts.get(sourceKind)!;
      const first = await certifyFlowTransformLineage({
        organizationId: org,
        sourceKind,
        sourceReceiptId,
        actorId: checker,
      });
      const replay = await certifyFlowTransformLineage({
        organizationId: org,
        sourceKind,
        sourceReceiptId,
        actorId: checker,
        correlationId: randomUUID(),
      });
      expect(first.created).toBe(true);
      expect(replay.created).toBe(false);
      expect(replay.receipt).toEqual(first.receipt);
      expect(
        new Set([
          first.receipt.sourceReceiptId,
          first.receipt.candidateId,
          first.receipt.initiativeId,
          first.receipt.executionLinkId,
          first.receipt.resultsActualSnapshotId,
          first.receipt.financeReconciliationId,
          first.receipt.pirId,
        ]).size
      ).toBe(7);
    }
  );

  it('foreign tenant cannot discover a source and failed certification leaves no receipt', async () => {
    const { certifyFlowTransformLineage } =
      await import('../../server/src/services/flowTransform/flowTransformLineageService.js');
    await expect(
      certifyFlowTransformLineage({
        organizationId: foreignOrg,
        sourceKind: 'organization',
        sourceReceiptId: sourceReceipts.get('organization')!,
        actorId: checker,
      })
    ).rejects.toMatchObject({ code: 'SOURCE_RECEIPT_NOT_FOUND', status: 404 });
    const client = await db();
    try {
      expect(
        (
          await client.query(
            `SELECT count(*)::int n FROM flow_transform_lineage_receipts WHERE organization_id=$1`,
            [foreignOrg]
          )
        ).rows[0].n
      ).toBe(0);
    } finally {
      await client.end();
    }
  });

  it('correlation receipts are append-only', async () => {
    const client = await db();
    try {
      await expect(
        client.query(
          `UPDATE flow_transform_lineage_receipts SET candidate_id='forged' WHERE organization_id=$1`,
          [org]
        )
      ).rejects.toMatchObject({ code: '23514' });
    } finally {
      await client.end();
    }
  });
});
