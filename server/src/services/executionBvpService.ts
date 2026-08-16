import { withPgTransaction } from '../utils/queryHelpers.js';

type ExecutionLinkRow = {
  link_id: string;
  organization_id: string;
  initiative_id: string;
  case_id: string;
  project_id: string;
  work_ref: string | null;
  resource_ref: string | null;
  control_ref: string | null;
  report_ref: string | null;
  status: 'ACTIVE' | 'CLOSED';
  version: number;
};

type EvidenceRow = {
  evidence_id: string;
  execution_link_id: string;
  artifact_link_id: string;
  artifact_revision: string;
  content_digest: string;
  approval_status: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  submitted_by: string;
  approved_by: string | null;
  version: number;
};

function required(value: string, code: string): string {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

export async function linkInitiativeToExecutionCase(input: {
  organizationId: string;
  initiativeId: string;
  caseId: string;
  actorId: string;
  idempotencyKey: string;
}): Promise<ExecutionLinkRow> {
  const organizationId = required(input.organizationId, 'execution_org_required');
  const initiativeId = required(input.initiativeId, 'execution_initiative_required');
  const caseId = required(input.caseId, 'execution_case_required');
  const actorId = required(input.actorId, 'execution_actor_required');
  const idempotencyKey = required(input.idempotencyKey, 'execution_idempotency_key_required');

  return withPgTransaction(async (tx) => {
    const initiative = await tx.query<{ id: string; project_id: string; organization_id: string }>(
      `SELECT id,project_id,organization_id FROM initiatives
        WHERE id = ? AND organization_id = ? FOR UPDATE`,
      [initiativeId, organizationId]
    );
    if (!initiative.rows[0]) throw new Error('execution_initiative_not_found');
    const caseResult = await tx.query<{
      case_id: string;
      project_id: string;
      organization_id: string;
    }>(
      `SELECT case_id,project_id,organization_id FROM case_core
        WHERE case_id = ? AND organization_id = ? FOR UPDATE`,
      [caseId, organizationId]
    );
    const caseRow = caseResult.rows[0];
    if (!caseRow) throw new Error('execution_case_not_found');
    if (caseRow.project_id !== initiative.rows[0].project_id) {
      throw new Error('execution_project_mismatch');
    }

    const replay = await tx.query<ExecutionLinkRow>(
      `SELECT * FROM execution_case_links
        WHERE organization_id = ? AND intake_idempotency_key = ?`,
      [organizationId, idempotencyKey]
    );
    if (replay.rows[0]) {
      if (replay.rows[0].initiative_id !== initiativeId || replay.rows[0].case_id !== caseId) {
        throw new Error('execution_idempotency_payload_collision');
      }
      return replay.rows[0];
    }

    const inserted = await tx.query<ExecutionLinkRow>(
      `INSERT INTO execution_case_links
         (organization_id,initiative_id,case_id,project_id,intake_idempotency_key,created_by)
       VALUES (?,?,?,?,?,?) RETURNING *`,
      [organizationId, initiativeId, caseId, caseRow.project_id, idempotencyKey, actorId]
    );
    return inserted.rows[0];
  });
}

export async function recordExecutionSpine(input: {
  organizationId: string;
  linkId: string;
  workRef: string;
  resourceRef: string;
  controlRef: string;
  reportRef: string;
  expectedVersion: number;
}): Promise<ExecutionLinkRow> {
  return withPgTransaction(async (tx) => {
    const updated = await tx.query<ExecutionLinkRow>(
      `UPDATE execution_case_links
          SET work_ref = ?,resource_ref = ?,control_ref = ?,report_ref = ?,
              version = version + 1,updated_at = now()
        WHERE link_id = ? AND organization_id = ? AND status = 'ACTIVE' AND version = ?
        RETURNING *`,
      [
        required(input.workRef, 'execution_work_ref_required'),
        required(input.resourceRef, 'execution_resource_ref_required'),
        required(input.controlRef, 'execution_control_ref_required'),
        required(input.reportRef, 'execution_report_ref_required'),
        required(input.linkId, 'execution_link_required'),
        required(input.organizationId, 'execution_org_required'),
        input.expectedVersion,
      ]
    );
    if (!updated.rows[0]) throw new Error('execution_link_stale_or_not_found');
    return updated.rows[0];
  });
}

export async function submitDeliveryEvidence(input: {
  organizationId: string;
  linkId: string;
  artifactLinkId: string;
  contentDigest: string;
  submittedBy: string;
  idempotencyKey: string;
}): Promise<EvidenceRow> {
  return withPgTransaction(async (tx) => {
    const artifact = await tx.query<{
      link_id: string;
      artifact_revision: string | null;
      relation: string;
      link_status: string;
      is_stale: boolean;
    }>(
      `SELECT a.link_id,a.artifact_revision,a.relation,a.link_status,a.is_stale
         FROM case_workspace_artifact_links a
         JOIN execution_case_links e ON e.case_id = a.case_id AND e.organization_id = a.organization_id
        WHERE e.link_id = ? AND e.organization_id = ? AND a.link_id = ?`,
      [input.linkId, input.organizationId, input.artifactLinkId]
    );
    const row = artifact.rows[0];
    if (!row) throw new Error('execution_evidence_not_linked');
    if (row.link_status !== 'ACTIVE' || row.is_stale)
      throw new Error('execution_evidence_not_current');
    if (!['EVIDENCE', 'DELIVERABLE'].includes(row.relation)) {
      throw new Error('execution_evidence_wrong_relation');
    }
    const revision = required(row.artifact_revision || '', 'execution_evidence_revision_required');
    const inserted = await tx.query<EvidenceRow>(
      `INSERT INTO execution_delivery_evidence
         (organization_id,execution_link_id,artifact_link_id,artifact_revision,
          content_digest,submitted_by,idempotency_key)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT (organization_id,idempotency_key) DO UPDATE
         SET idempotency_key = EXCLUDED.idempotency_key
       RETURNING *`,
      [
        input.organizationId,
        input.linkId,
        input.artifactLinkId,
        revision,
        required(input.contentDigest, 'execution_evidence_digest_required'),
        required(input.submittedBy, 'execution_evidence_submitter_required'),
        required(input.idempotencyKey, 'execution_evidence_idempotency_required'),
      ]
    );
    return inserted.rows[0];
  });
}

export async function approveDeliveryEvidence(input: {
  organizationId: string;
  evidenceId: string;
  approvedBy: string;
  expectedVersion: number;
}): Promise<EvidenceRow> {
  const approvedBy = required(input.approvedBy, 'execution_evidence_approver_required');
  return withPgTransaction(async (tx) => {
    const updated = await tx.query<EvidenceRow>(
      `UPDATE execution_delivery_evidence
          SET approval_status = 'APPROVED',approved_by = ?,approved_at = now(),
              version = version + 1,updated_at = now()
        WHERE evidence_id = ? AND organization_id = ? AND approval_status = 'SUBMITTED'
          AND submitted_by <> ? AND version = ?
        RETURNING *`,
      [approvedBy, input.evidenceId, input.organizationId, approvedBy, input.expectedVersion]
    );
    if (!updated.rows[0]) throw new Error('execution_evidence_stale_forbidden_or_not_found');
    return updated.rows[0];
  });
}

export async function closeExecutionAndEmitResultsSignal(input: {
  organizationId: string;
  linkId: string;
  evidenceId: string;
  expectedVersion: number;
  idempotencyKey: string;
}): Promise<{ link: ExecutionLinkRow; signalId: string; replay: boolean }> {
  return withPgTransaction(async (tx) => {
    // Serialize equal delivery intents before the replay read. Without this,
    // two transactions can both observe "no signal", one closes the link,
    // and the loser reports a stale-link error instead of an idempotent replay.
    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended(?, 0))`, [
      `${input.organizationId}:${input.idempotencyKey}`,
    ]);
    const existing = await tx.query<{ signal_id: string; evidence_id: string }>(
      `SELECT signal_id,evidence_id FROM execution_results_signal_outbox
        WHERE organization_id = ? AND idempotency_key = ?`,
      [input.organizationId, input.idempotencyKey]
    );
    if (existing.rows[0]) {
      if (existing.rows[0].evidence_id !== input.evidenceId) {
        throw new Error('execution_signal_idempotency_payload_collision');
      }
      const link = await tx.query<ExecutionLinkRow>(
        `SELECT * FROM execution_case_links WHERE link_id = ? AND organization_id = ?`,
        [input.linkId, input.organizationId]
      );
      return { link: link.rows[0], signalId: existing.rows[0].signal_id, replay: true };
    }

    const evidence = await tx.query<EvidenceRow>(
      `SELECT * FROM execution_delivery_evidence
        WHERE evidence_id = ? AND execution_link_id = ? AND organization_id = ?
          AND approval_status = 'APPROVED' FOR UPDATE`,
      [input.evidenceId, input.linkId, input.organizationId]
    );
    if (!evidence.rows[0]) throw new Error('execution_approved_evidence_required');
    const closed = await tx.query<ExecutionLinkRow>(
      `UPDATE execution_case_links SET status = 'CLOSED',version = version + 1,updated_at = now()
        WHERE link_id = ? AND organization_id = ? AND status = 'ACTIVE' AND version = ?
          AND work_ref IS NOT NULL AND resource_ref IS NOT NULL
          AND control_ref IS NOT NULL AND report_ref IS NOT NULL
        RETURNING *`,
      [input.linkId, input.organizationId, input.expectedVersion]
    );
    const link = closed.rows[0];
    if (!link) throw new Error('execution_spine_incomplete_stale_or_not_found');
    const signal = await tx.query<{ signal_id: string }>(
      `INSERT INTO execution_results_signal_outbox
         (organization_id,execution_link_id,initiative_id,case_id,evidence_id,
          payload_json,idempotency_key)
       VALUES (?,?,?,?,?,?::jsonb,?) RETURNING signal_id`,
      [
        input.organizationId,
        link.link_id,
        link.initiative_id,
        link.case_id,
        input.evidenceId,
        JSON.stringify({
          initiativeId: link.initiative_id,
          caseId: link.case_id,
          evidenceId: input.evidenceId,
          reportRef: link.report_ref,
        }),
        required(input.idempotencyKey, 'execution_signal_idempotency_required'),
      ]
    );
    return { link, signalId: signal.rows[0].signal_id, replay: false };
  });
}
