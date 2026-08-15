import { createHash } from 'node:crypto';

import type { Pool } from 'pg';

export const T01_FINAL_OUTPUT_FIXTURE = {
  organizationId: 'org-t01-i03',
  projectId: 'project-t01-i03',
  actorUserId: 'user-t01-actor',
  stakeholderUserId: 'user-t01-stakeholder',
  transformationCaseId: 'tc-t01-i03',
  planId: 'tp-t01-i03',
  executionRunId: 'run-t01-full',
  contextSnapshotId: 'snapshot-t01-full',
  lineageId: 'lineage-t01-i03',
} as const;

/**
 * Deterministic, tenant-scoped fixture for the native final-output proof.
 * It seeds only accepted business facts consumed by loadFacts plus the current
 * agent identity/governance rows. Product services still create the proposal,
 * approval, owner artifacts, immutable versions, registry receipts and files.
 */
export async function seedT01FinalOutputFixture(pool: Pool): Promise<void> {
  const f = T01_FINAL_OUTPUT_FIXTURE;
  const digest = (value: string) => createHash('sha256').update(value).digest('hex');

  await pool.query('BEGIN');
  try {
    const proposalIds = (
      await pool.query<{ governed_proposal_version_id: string }>(
        `SELECT governed_proposal_version_id FROM transformation_final_output_governance
          WHERE transformation_case_id=$1 AND organization_id=$2`,
        [f.transformationCaseId, f.organizationId]
      )
    ).rows.map((row) => row.governed_proposal_version_id);
    await pool.query(
      `DELETE FROM transformation_final_output_governance WHERE transformation_case_id=$1 AND organization_id=$2`,
      [f.transformationCaseId, f.organizationId]
    );
    if (proposalIds.length) {
      await pool.query(
        `DELETE FROM v8_agent_proposal_scope_reviews WHERE proposal_version_id=ANY($1)`,
        [proposalIds]
      );
      await pool.query(
        `DELETE FROM v8_agent_proposal_governance_events WHERE proposal_version_id=ANY($1)`,
        [proposalIds]
      );
      await pool.query(`DELETE FROM v8_agent_proposal_versions WHERE proposal_version_id=ANY($1)`, [
        proposalIds,
      ]);
    }
    await pool.query(
      `DELETE FROM transformation_final_output_runs WHERE transformation_case_id=$1 AND organization_id=$2`,
      [f.transformationCaseId, f.organizationId]
    );
    await pool.query(
      `DELETE FROM transformation_case_artifact_links WHERE transformation_case_id=$1 AND organization_id=$2 AND lifecycle_stage='final_outputs'`,
      [f.transformationCaseId, f.organizationId]
    );
    await pool.query(
      `DELETE FROM transformation_case_audit_events WHERE transformation_case_id=$1 AND organization_id=$2
       AND (event_type LIKE 'transformation_final_outputs.%' OR audit_event_id LIKE 'audit-final-digest-change-%')`,
      [f.transformationCaseId, f.organizationId]
    );
    await pool.query(
      `DELETE FROM v8_agent_adapter_invocations WHERE transformation_case_id=$1 AND organization_id=$2`,
      [f.transformationCaseId, f.organizationId]
    );
    await pool.query(
      `DELETE FROM v8_agent_resource_reservations WHERE run_id=$1 AND organization_id=$2`,
      [f.executionRunId, f.organizationId]
    );
    await pool.query(
      `DELETE FROM v8_artifact_origin_links WHERE organization_id=$1 AND artifact_id IN
       (SELECT artifact_id FROM v8_output_artifacts WHERE organization_id=$1 AND execution_run_id=$2)`,
      [f.organizationId, f.executionRunId]
    );
    await pool.query(
      `DELETE FROM v8_artifact_origin_links l WHERE l.organization_id=$1 AND NOT EXISTS
       (SELECT 1 FROM v8_output_artifacts a WHERE a.artifact_id=l.artifact_id AND a.organization_id=l.organization_id)`,
      [f.organizationId]
    );
    await pool.query(
      `DELETE FROM v8_output_artifacts WHERE organization_id=$1 AND execution_run_id=$2`,
      [f.organizationId, f.executionRunId]
    );
    await pool.query(
      `DELETE FROM report_builder_sections WHERE report_id IN (SELECT id FROM report_builder_reports WHERE organization_id=$1 AND source_id=$2)`,
      [f.organizationId, f.transformationCaseId]
    );
    await pool.query(
      `DELETE FROM report_builder_versions WHERE report_id IN (SELECT id FROM report_builder_reports WHERE organization_id=$1 AND source_id=$2)`,
      [f.organizationId, f.transformationCaseId]
    );
    await pool.query(
      `DELETE FROM report_builder_reports WHERE organization_id=$1 AND source_id=$2`,
      [f.organizationId, f.transformationCaseId]
    );
    await pool.query(
      `DELETE FROM presentation_deck_versions WHERE deck_id IN (SELECT id FROM presentation_decks WHERE organization_id=$1 AND source_id=$2)`,
      [f.organizationId, f.transformationCaseId]
    );
    await pool.query(`DELETE FROM presentation_decks WHERE organization_id=$1 AND source_id=$2`, [
      f.organizationId,
      f.transformationCaseId,
    ]);
    await pool.query(
      `INSERT INTO organizations (id,name) VALUES ($1,'T01 Final Output Proof') ON CONFLICT (id) DO NOTHING`,
      [f.organizationId]
    );
    await pool.query(
      `INSERT INTO users (id,organization_id,email,first_name,last_name,status,role) VALUES
       ($1,$3,'actor@t01.invalid','Agent','Reviewer','active','SUPERADMIN'),
       ($2,$3,'stakeholder@t01.invalid','Stake','Holder','active','USER')
       ON CONFLICT (id) DO NOTHING`,
      [f.actorUserId, f.stakeholderUserId, f.organizationId]
    );
    await pool.query(
      `INSERT INTO organization_members (id,organization_id,user_id,role) VALUES
       ('member-t01-actor',$1,$2,'ADMIN'),('member-t01-stakeholder',$1,$3,'MEMBER')
       ON CONFLICT (id) DO NOTHING`,
      [f.organizationId, f.actorUserId, f.stakeholderUserId]
    );
    await pool.query(
      `INSERT INTO projects (id,organization_id,name,status) VALUES
       ($1,$2,'T01 final-output proof','ACTIVE') ON CONFLICT (id) DO NOTHING`,
      [f.projectId, f.organizationId]
    );
    await pool.query(
      `INSERT INTO project_members (project_id,user_id,project_role) VALUES ($1,$2,'PROJECT_MANAGER')
       ON CONFLICT DO NOTHING`,
      [f.projectId, f.actorUserId]
    );
    await pool.query(
      `INSERT INTO wave8_agent_definitions
       (agent_id,organization_id,name,role,purpose,persona,allowed_tools_json,blocked_tools_json,
        source_scope_json,output_schema_json,approval_policy,cost_class,risk_level,examples_json,editable)
       VALUES ('consultify:teresa:transformation-agent',$1,'Teresa','transformation_agent',
        'Execute governed transformation','Consultify transformation agent','[]','[]','[]','{}',
        'explicit','medium','high','[]',0)
       ON CONFLICT (agent_id) DO NOTHING`,
      [f.organizationId]
    );
    await pool.query(
      `INSERT INTO v8_context_snapshots
       (snapshot_id,workspace_id,organization_id,project_id,execution_run_id,artifact_refs,
        effective_scope_ref,resolved_role_ref,initiator_user_id,consumer_class,source_context_refs,drift_events)
       VALUES ($1,$2,$2,$3,$4,'[]','project:t01','transformation_agent',$5,'execution','[]','[]')
       ON CONFLICT (snapshot_id) DO NOTHING`,
      [f.contextSnapshotId, f.organizationId, f.projectId, f.executionRunId, f.actorUserId]
    );
    await pool.query(
      `INSERT INTO v8_execution_runs
       (run_id,organization_id,context_snapshot_id,initiator_user_id,state,plan_version,goal,metadata)
       VALUES ($1,$2,$3,$4,'completed',1,'Publish accepted transformation facts',
        '{"fixture":"t01_final_output"}'::jsonb) ON CONFLICT (run_id) DO NOTHING`,
      [f.executionRunId, f.organizationId, f.contextSnapshotId, f.actorUserId]
    );
    await pool.query(
      `INSERT INTO transformation_cases
       (transformation_case_id,organization_id,project_id,context_snapshot_id,execution_run_id,
        initiated_by_user_id,mandate,status,lifecycle_stage,lineage_id,idempotency_key,version)
       VALUES ($1,$2,$3,$4,$5,$6,'Skrócić czas realizacji transformacji','active','final_outputs',$7,
        'idem-t01-i03',23) ON CONFLICT (transformation_case_id) DO NOTHING`,
      [
        f.transformationCaseId,
        f.organizationId,
        f.projectId,
        f.contextSnapshotId,
        f.executionRunId,
        f.actorUserId,
        f.lineageId,
      ]
    );
    await pool.query(
      `INSERT INTO v8_agent_run_identities
       (canonical_run_id,organization_id,transformation_case_id,lineage_id)
       VALUES ($1,$2,$3,$4) ON CONFLICT (canonical_run_id) DO NOTHING`,
      [f.executionRunId, f.organizationId, f.transformationCaseId, f.lineageId]
    );
    await pool.query(
      `INSERT INTO transformation_plans
       (plan_id,transformation_case_id,organization_id,version,status,summary,created_by_user_id)
       VALUES ($1,$2,$3,1,'approved','Accepted T01 transformation plan',$4)
       ON CONFLICT (plan_id) DO NOTHING`,
      [f.planId, f.transformationCaseId, f.organizationId, f.actorUserId]
    );
    await pool.query(
      `UPDATE transformation_cases SET active_plan_id=$1 WHERE transformation_case_id=$2`,
      [f.planId, f.transformationCaseId]
    );

    await pool.query(
      `INSERT INTO my_ideas (id,user_id,organization_id,title,body,source_type)
       VALUES ('idea-t01-final',$1,$2,'Skrócić lead time','Automatyzacja przepływu decyzji','transformation_agent')
       ON CONFLICT (id) DO NOTHING`,
      [f.actorUserId, f.organizationId]
    );
    await pool.query(
      `INSERT INTO interview_insights (id,organization_id,title,content,status,created_by)
       VALUES ('insight-t01-final',$1,'Wąskie gardło decyzyjne','Skrócić akceptację do jednego dnia','approved',$2)
       ON CONFLICT (id) DO NOTHING`,
      [f.organizationId, f.actorUserId]
    );
    await pool.query(
      `INSERT INTO assessments (id,organization_id,project_id,assessment_type,name,status,completion_percent,created_by)
       VALUES ('assessment-t01-final',$1,$2,'DRD','DRD Transformation Readiness','APPROVED',100,$3)
       ON CONFLICT (id) DO NOTHING`,
      [f.organizationId, f.projectId, f.actorUserId]
    );
    await pool.query(
      `INSERT INTO assessment_accepted_snapshots
       (id,organization_id,assessment_id,review_id,snapshot_json,provenance_json,accepted_by,is_current)
       VALUES ('snapshot-assessment-t01',$1,'assessment-t01-final','review-t01',
        '{"score":100}'::text,'{"source":"accepted_drd"}'::text,$2,TRUE)
       ON CONFLICT (id) DO NOTHING`,
      [f.organizationId, f.actorUserId]
    );
    await pool.query(
      `INSERT INTO initiatives (id,organization_id,project_id,name,status,owner_business_id,owner_execution_id)
       VALUES ('initiative-t01-final',$1,$2,'Skrócenie czasu realizacji','DONE',$3,$3)
       ON CONFLICT (id) DO NOTHING`,
      [f.organizationId, f.projectId, f.actorUserId]
    );
    await pool.query(
      `INSERT INTO tasks (id,organization_id,project_id,initiative_id,title,status,created_by)
       VALUES ('task-t01-final',$1,$2,'initiative-t01-final','Wdrożyć przepływ','DONE',$3)
       ON CONFLICT (id) DO NOTHING`,
      [f.organizationId, f.projectId, f.actorUserId]
    );
    await pool.query(
      `INSERT INTO initiative_milestones (id,initiative_id,organization_id,name,status,target_date)
       VALUES ('milestone-t01-final','initiative-t01-final',$1,'Go-live','COMPLETED',CURRENT_DATE)
       ON CONFLICT (id) DO NOTHING`,
      [f.organizationId]
    );
    await pool.query(
      `INSERT INTO initiative_benefits
       (id,initiative_id,organization_id,name,status,actual_annual_value,estimated_annual_value,currency)
       VALUES ('benefit-t01-final','initiative-t01-final',$1,'Lead time saving','achieved',120000,100000,'PLN')
       ON CONFLICT (id) DO NOTHING`,
      [f.organizationId]
    );
    await pool.query(
      `INSERT INTO benefit_measurements
       (id,benefit_id,measured_value,measured_at,measured_by,is_verified,verified_by,verified_at)
       VALUES ('measure-t01-old','benefit-t01-final',3,CURRENT_DATE-INTERVAL '31 days',$1,TRUE,$1,NOW()),
              ('measure-t01-new','benefit-t01-final',2.8,CURRENT_DATE,$1,TRUE,$1,NOW())
       ON CONFLICT (id) DO NOTHING`,
      [f.actorUserId]
    );
    await pool.query(
      `INSERT INTO financial_analyses (id,organization_id,project_id,title,status,created_by)
       VALUES ('finance-t01-final',$1,$2,'Approved business case','APPROVED',$3)
       ON CONFLICT (id) DO NOTHING`,
      [f.organizationId, f.projectId, f.actorUserId]
    );
    await pool.query(
      `INSERT INTO initiative_kpis
       (id,initiative_id,organization_id,name,unit,baseline_value,target_value,current_value,direction)
       VALUES ('kpi-t01-final','initiative-t01-final',$1,'Lead time','days',5,3,2.8,'LOWER_IS_BETTER')
       ON CONFLICT (id) DO NOTHING`,
      [f.organizationId]
    );
    await pool.query(
      `INSERT INTO transformation_stage_proposals
       (proposal_id,transformation_case_id,organization_id,plan_id,plan_version,lifecycle_stage,
        proposal_type,payload_json,payload_digest,status,proposed_by_user_id)
       VALUES ('proposal-finance-t01',$1,$2,$4,1,'finance_kpi','create_finance_kpi_pack',
        '{"economics":{"currency":"PLN","capex":20000,"opexAnnual":10000,"benefitAnnual":100000}}'::jsonb,
        $5,'applied',$3) ON CONFLICT (proposal_id) DO NOTHING`,
      [f.transformationCaseId, f.organizationId, f.actorUserId, f.planId, digest('finance-payload')]
    );
    await pool.query(
      `INSERT INTO transformation_portfolio_decision_receipts
       (receipt_id,transformation_case_id,organization_id,decision_id,pack_id,evidence_digest,
        source_case_version,idempotency_key,request_digest,selected_option,rationale,decided_by_user_id,authorization_type)
       VALUES ('receipt-t01-final',$1,$2,'decision-t01-final','pack-t01-final',$3,23,
        'decision-idem-t01',$4,'go','Approved evidence supports execution',$5,'decision_maker')
       ON CONFLICT (receipt_id) DO NOTHING`,
      [
        f.transformationCaseId,
        f.organizationId,
        digest('evidence-t01'),
        digest('request-t01'),
        f.actorUserId,
      ]
    );

    const links = [
      ['idea', 'my_idea', 'idea-t01-final'],
      ['interviews', 'interview_insight', 'insight-t01-final'],
      ['drd', 'drd_assessment', 'assessment-t01-final'],
      ['initiative', 'initiative', 'initiative-t01-final'],
      ['finance_kpi', 'financial_analysis', 'finance-t01-final'],
      ['finance_kpi', 'initiative_kpi', 'kpi-t01-final'],
      ['benefits', 'initiative_benefit', 'benefit-t01-final'],
    ] as const;
    for (const [stage, type, id] of links) {
      await pool.query(
        `INSERT INTO transformation_case_artifact_links
         (link_id,transformation_case_id,organization_id,lifecycle_stage,artifact_type,artifact_id,lineage_role,created_by_user_id)
         VALUES ($1,$2,$3,$4,$5,$6,'output',$7) ON CONFLICT (link_id) DO NOTHING`,
        [`link-${id}`, f.transformationCaseId, f.organizationId, stage, type, id, f.actorUserId]
      );
    }
    await pool.query(
      `INSERT INTO transformation_case_audit_events
       (audit_event_id,transformation_case_id,organization_id,event_type,actor_user_id,payload_digest,detail_json)
       VALUES ('audit-t01-accepted',$1,$2,'transformation.sustainability.accepted',$3,$4,'{}'::jsonb)
       ON CONFLICT (audit_event_id) DO NOTHING`,
      [f.transformationCaseId, f.organizationId, f.actorUserId, digest('accepted')]
    );
    await pool.query(
      `INSERT INTO v8_tool_catalog
       (tool_id,organization_id,name,description,category,risk_class,mutation_type,
        classification_status,default_approval_mode,version,created_at,updated_at)
       VALUES ('tool-t01-final-output',$1,'transformation.final_outputs.publish',
        'Publish governed final outputs','workflow_action','high_risk','bounded_write','ratified',
        'auto_executable','1',NOW(),NOW())
       ON CONFLICT (tool_id) DO UPDATE SET
         classification_status=EXCLUDED.classification_status,
         default_approval_mode=EXCLUDED.default_approval_mode,
         updated_at=EXCLUDED.updated_at`,
      [f.organizationId]
    );
    await pool.query(
      `INSERT INTO v8_consumer_tool_policies
       (policy_id,organization_id,project_id,consumer_class,tool_id,allowed,approval_override,effective_from,created_at,updated_at)
       VALUES ('policy-t01-final-output',$1,$2,'execution','tool-t01-final-output',1,
        'inherit_from_tool',NOW(),NOW(),NOW())
       ON CONFLICT (policy_id) DO UPDATE SET
         allowed=EXCLUDED.allowed,approval_override=EXCLUDED.approval_override,
         effective_from=EXCLUDED.effective_from,updated_at=EXCLUDED.updated_at`,
      [f.organizationId, f.projectId]
    );
    await pool.query(
      `INSERT INTO v8_agent_resource_policies
       (policy_id,organization_id,project_id,max_concurrent_executions,max_estimated_cost_usd_per_run,
        lease_seconds,enabled)
       VALUES ('resource-policy-t01-final',$1,$2,1,1000,300,1)
       ON CONFLICT (policy_id) DO UPDATE SET enabled=1,updated_at=NOW()`,
      [f.organizationId, f.projectId]
    );
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
}
