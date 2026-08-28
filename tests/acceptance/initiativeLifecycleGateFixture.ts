import { createHash } from 'node:crypto';
import type pg from 'pg';

export async function seedCanonicalLifecycleDecision(
  client: pg.Client,
  input: {
    decisionId: string;
    organizationId: string;
    initiativeId: string;
    actorUserId: string;
    pmoDomain: 'SCHEDULE_MILESTONES' | 'GOVERNANCE_DECISION_MAKING' | 'CLOSURE';
    decisionStatus?: 'approved' | 'rejected';
  }
): Promise<void> {
  const status = input.decisionStatus ?? 'approved';
  const caseId = `${input.decisionId}-case`;
  const proposalVersionId = `${input.decisionId}-proposal-version`;
  const reviewId = `${input.decisionId}-review`;
  const digest = createHash('sha256').update(`acceptance-gate|${input.decisionId}`).digest('hex');
  const versionResult = await client.query(
    `SELECT COALESCE(MAX(version),0)::int + 1 AS version
       FROM initiative_lifecycle_gate_decisions
      WHERE organization_id=$1 AND initiative_id=$2 AND pmo_domain=$3`,
    [input.organizationId, input.initiativeId, input.pmoDomain]
  );
  await client.query(
    `INSERT INTO transformation_cases
       (transformation_case_id, organization_id, initiated_by_user_id, mandate,
        lineage_id, idempotency_key, version)
     VALUES ($1,$2,$3,'Acceptance lifecycle gate fixture',$4,$5,1)`,
    [caseId, input.organizationId, input.actorUserId, `${input.decisionId}-lineage`, `${input.decisionId}-case-idem`]
  );
  await client.query(
    `INSERT INTO v8_agent_proposal_versions
       (proposal_version_id, proposal_id, organization_id, canonical_run_id,
        proposal_version, plan_version, context_digest, before_json, after_json,
        approval_scopes_json, reviewer_authority_json, expires_at, status, created_by_user_id)
     VALUES ($1,$2,$3,$4,1,1,$5,'{}'::jsonb,'{}'::jsonb,$6::jsonb,$7::jsonb,
             NOW()+INTERVAL '1 day','approved',$8)`,
    [proposalVersionId, `${input.decisionId}-proposal`, input.organizationId,
     `${input.decisionId}-run`, digest, JSON.stringify(['initiative_lifecycle']),
     JSON.stringify({ userId: input.actorUserId, authority: 'initiative_lifecycle' }), input.actorUserId]
  );
  await client.query(
    `INSERT INTO v8_agent_proposal_scope_reviews
       (review_id, proposal_version_id, scope_key, decision, reason, reviewed_by_user_id)
     VALUES ($1,$2,'initiative_lifecycle','approved','Acceptance lifecycle gate fixture',$3)`,
    [reviewId, proposalVersionId, input.actorUserId]
  );
  await client.query(
    `INSERT INTO initiative_lifecycle_gate_decisions
       (decision_id, organization_id, initiative_id, transformation_case_id, pmo_domain,
        version, decision_status, source_digest, source_case_version, baseline_refs_json,
        a05_proposal_version_id, a05_approval_receipt_ref, human_actor_user_id,
        human_authority_ref, rationale, deadline_at, idempotency_key, input_digest)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,1,$9::jsonb,$10,$11,$12,
             'initiative_lifecycle','Acceptance governed lifecycle fixture',
             '2026-12-31T00:00:00.000Z',$13,$14)`,
    [input.decisionId, input.organizationId, input.initiativeId, caseId, input.pmoDomain,
     Number(versionResult.rows[0].version), status, digest,
     JSON.stringify([`initiative:${input.initiativeId}:${input.pmoDomain}`]),
     proposalVersionId, reviewId, input.actorUserId, `${input.decisionId}-gate-idem`,
     createHash('sha256').update(`acceptance-gate-input|${input.decisionId}|${status}`).digest('hex')]
  );
}
