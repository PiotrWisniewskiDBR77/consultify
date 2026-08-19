import fs from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL =
  process.env.DATABASE_URL || 'postgres://consultinity:consultinity@localhost:5442/consultinity';
process.env.DATABASE_URL = DATABASE_URL;
process.env.DB_TYPE = 'postgres';

const prefix = `flow-four-${Date.now()}`;
const org = `${prefix}-org`;
const foreignOrg = `${prefix}-foreign`;
const maker = `${prefix}-maker`;
const checker = `${prefix}-checker`;
const projectId = `${prefix}-project`;
const kinds = ['organization', 'interview', 'drd', 'swot'] as const;
type Kind = (typeof kinds)[number];
const sourceReceipts = new Map<Kind, string>();

async function db() {
  const c = new Client({ connectionString: DATABASE_URL });
  await c.connect();
  return c;
}

async function seedChain(client: Client, kind: Kind, index: number) {
  const candidateId = `${prefix}-${kind}-candidate`;
  const initiativeId = `${prefix}-${kind}-initiative`;
  const caseId = `${prefix}-${kind}-case`;
  const executionLinkId = randomUUID();
  const roiCaseId = randomUUID();
  const actualId = randomUUID();
  const financeLinkId = randomUUID();
  const reconciliationId = randomUUID();
  const decisionId = randomUUID();
  const pirId = randomUUID();
  const sourceReceiptId = randomUUID();
  sourceReceipts.set(kind, sourceReceiptId);

  await client.query(
    `INSERT INTO initiatives(id,name,organization_id,status) VALUES ($1,$2,$3,'EXECUTING')`,
    [initiativeId, `${kind} initiative`, org]
  );
  await client.query(
    `INSERT INTO initiative_candidates(id,organization_id,source_type,source_id,title,rationale,fit_score,status,created_by,initiative_id,accepted_at) VALUES ($1,$2,$3,$4,$5,'source',1,'accepted',$6,$7,now())`,
    [
      candidateId,
      org,
      `flow_${kind}`,
      `${prefix}-${kind}-source`,
      `${kind} candidate`,
      maker,
      initiativeId,
    ]
  );
  await client.query(
    `INSERT INTO case_core(case_id,project_id,organization_id,case_name,created_by_actor_id,contracted_closure_type) VALUES ($1,$2,$3,$4,$5,'OUTCOME_VALIDATED')`,
    [caseId, projectId, org, `${kind} execution`, maker]
  );
  await client.query(
    `INSERT INTO execution_case_links(link_id,organization_id,initiative_id,case_id,project_id,intake_idempotency_key,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [executionLinkId, org, initiativeId, caseId, projectId, `${prefix}-${kind}-execution`, maker]
  );
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

  if (kind === 'organization') {
    const snapshotId = `${prefix}-flow-snapshot`;
    await client.query(
      `INSERT INTO organization_context_snapshot_versions(id,organization_id,version,schema_version,content_hash,claim_count,snapshot_json,source_refs_json,created_by) VALUES ($1,$2,90,1,$3,1,'{}','[]',$4)`,
      [snapshotId, org, 'a'.repeat(64), maker]
    );
    await client.query(
      `INSERT INTO organization_snapshot_candidate_handoffs(id,organization_id,snapshot_id,snapshot_version,snapshot_content_hash,candidate_id,created_by) VALUES ($1,$2,$3,90,$4,$5,$6)`,
      [sourceReceiptId, org, snapshotId, 'a'.repeat(64), candidateId, maker]
    );
  } else if (kind === 'interview') {
    await client.query(
      `INSERT INTO interview_candidate_handoffs(id,organization_id,source_type,source_id,accepted_snapshot_id,candidate_id,created_by,source_version,snapshot_content_hash) VALUES ($1,$2,'interview_submission',$3,$4,$5,$6,$4,$7)`,
      [
        sourceReceiptId,
        org,
        `${prefix}-assignment`,
        `${prefix}-submission-v1`,
        candidateId,
        maker,
        'b'.repeat(64),
      ]
    );
  } else if (kind === 'drd') {
    await client.query(
      `INSERT INTO assessment_candidate_handoffs(id,organization_id,assessment_id,output_id,candidate_id,created_by,source_version,snapshot_content_hash) VALUES ($1,$2,$3,$4,$5,$6,$4,$7)`,
      [
        sourceReceiptId,
        org,
        `${prefix}-assessment`,
        `${prefix}-output`,
        candidateId,
        maker,
        'c'.repeat(64),
      ]
    );
  } else {
    await client.query(
      `INSERT INTO swot_candidate_handoffs(id,organization_id,tool_session_id,recommendation_id,candidate_id,created_by,tool_output_id,tool_output_version,tool_output_content_hash,source_revision) VALUES ($1,$2,$3,'rec',$4,$5,$6,1,$7,1)`,
      [
        sourceReceiptId,
        org,
        `${prefix}-swot`,
        candidateId,
        maker,
        `${prefix}-tool-output`,
        'd'.repeat(16),
      ]
    );
  }
}

beforeAll(async () => {
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
    for (let i = 0; i < kinds.length; i++) await seedChain(client, kinds[i], i);
  } finally {
    await client.end();
  }
}, 30_000);

describe('FLOW-TRANSFORM four-source full lineage', () => {
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
