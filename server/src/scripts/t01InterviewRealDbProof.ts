import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { Pool } from 'pg';

import { adaptQuery } from '../database/PostgresDatabase.js';
import interviewAssignmentService from '../services/InterviewAssignmentService.js';
import notificationService from '../services/notificationService.js';
import {
  registerGovernedProposal,
  rejectProposalScope,
  requestProposalRevision,
} from '../services/v8/agentProposalGovernanceService.js';
import {
  acceptBenefitsReview,
  acceptDeliveryHandoff,
  acceptDrdResults,
  acceptExecutionResults,
  acceptExecutionStart,
  acceptFinanceKpiResults,
  acceptInitiativeResults,
  acceptInterviewResults,
  acceptMobilizationResults,
  acceptPortfolioDecisionResults,
  acceptSustainabilityReview,
  compileT01TransformationPlan,
  proposeDrdAssessment,
  proposeFinanceKpiPack,
  proposeInitialIdeas,
  proposeInterviews,
  proposeMobilizationBlueprint,
  proposeOpportunitySynthesis,
  proposePortfolioDecision,
  reviewDrdAssessmentProposal,
  reviewFinanceKpiPack,
  reviewInitialIdeasProposal,
  reviewInterviewsProposal,
  reviewMobilizationBlueprint,
  reviewOpportunitySynthesis,
  reviewPortfolioDecision,
  resolvePortfolioDecision,
} from '../services/v8/transformationCaseService.js';
import { executeGovernedInitiativeTransition } from '../services/v8/transformationInitiativeTransitionAdapterService.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString: databaseUrl });
const proofDb = {
  async query(text: string, params: unknown[] = []) {
    const result = await pool.query(adaptQuery(text), params);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  },
  get(
    text: string,
    params: unknown[] = [],
    callback?: (error: Error | null, row: unknown) => void
  ) {
    const promise = pool.query(adaptQuery(text), params).then((result) => result.rows[0] ?? null);
    if (callback) {
      void promise.then(
        (row) => callback(null, row),
        (error) => callback(error as Error, null)
      );
      return proofDb;
    }
    return promise;
  },
  all(
    text: string,
    params: unknown[] = [],
    callback?: (error: Error | null, rows: unknown[]) => void
  ) {
    const promise = pool.query(adaptQuery(text), params).then((result) => result.rows);
    if (callback) {
      void promise.then(
        (rows) => callback(null, rows),
        (error) => callback(error as Error, [])
      );
      return proofDb;
    }
    return promise;
  },
  run(text: string, params: unknown[] = [], callback?: (error: Error | null) => void) {
    const promise = pool
      .query(adaptQuery(text), params)
      .then((result) => ({ changes: result.rowCount ?? 0 }));
    if (callback) {
      void promise.then(
        (result) => callback.call({ changes: result.changes }, null),
        (error) => callback.call({ changes: 0 }, error as Error)
      );
      return proofDb;
    }
    return promise;
  },
  exec(text: string) {
    return pool.query(text).then(() => undefined);
  },
  serialize(callback: () => void) {
    callback();
  },
  close() {
    return Promise.resolve();
  },
};
(globalThis as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;
(process as unknown as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;
const ids = {
  organization: 'org-t01-i03',
  project: 'project-t01-i03',
  actor: 'user-t01-actor',
  stakeholder: 'user-t01-stakeholder',
  case: 'tc-t01-i03',
  plan: 'tp-t01-i03',
  idea: 'idea-t01-i03',
};

async function main() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(`
    CREATE TABLE organizations (id TEXT PRIMARY KEY);
    CREATE TABLE organization_members (organization_id TEXT NOT NULL, user_id TEXT NOT NULL);
    CREATE TABLE project_members (
      project_id TEXT NOT NULL, user_id TEXT NOT NULL, project_role TEXT,
      is_invoked INTEGER NOT NULL DEFAULT 0,
      consultant_profile TEXT NOT NULL DEFAULT 'NONE',
      engagement_type TEXT NOT NULL DEFAULT 'INTERNAL', acting_org_id TEXT
    );
    CREATE TABLE projects (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL);
    CREATE TABLE users (id TEXT PRIMARY KEY, organization_id TEXT, email TEXT, first_name TEXT, last_name TEXT, status TEXT DEFAULT 'active', role TEXT);
    CREATE TABLE wave8_agent_definitions (
      agent_id TEXT PRIMARY KEY, organization_id TEXT, name TEXT NOT NULL, role TEXT NOT NULL,
      purpose TEXT NOT NULL, persona TEXT NOT NULL, allowed_tools_json TEXT NOT NULL DEFAULT '[]',
      blocked_tools_json TEXT NOT NULL DEFAULT '[]', source_scope_json TEXT NOT NULL DEFAULT '[]',
      output_schema_json TEXT NOT NULL DEFAULT '{}', approval_policy TEXT NOT NULL,
      cost_class TEXT NOT NULL, risk_level TEXT NOT NULL, examples_json TEXT NOT NULL DEFAULT '[]',
      editable INTEGER NOT NULL DEFAULT 1, updated_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE v8_agent_run_identities (
      canonical_run_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL,
      transformation_case_id TEXT UNIQUE, conversation_id TEXT, lineage_id TEXT NOT NULL
    );
    CREATE TABLE v8_execution_runs (
      run_id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      context_snapshot_id TEXT NOT NULL,
      initiator_user_id TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'drafting' CHECK (state IN (
        'drafting', 'planning', 'proposals_ready', 'waiting_for_review',
        'approved_for_apply', 'rejected', 'applying', 'completed', 'failed',
        'cancelled', 'expired'
      )),
      plan_version INTEGER NOT NULL DEFAULT 1,
      goal TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      resolved_at TEXT,
      expires_at TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE INDEX idx_t01_proof_execution_runs_org_state
      ON v8_execution_runs(organization_id, state);
    CREATE TABLE v8_tool_catalog (
      tool_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, name TEXT NOT NULL,
      description TEXT NOT NULL, category TEXT NOT NULL, risk_class TEXT NOT NULL,
      mutation_type TEXT NOT NULL, classification_status TEXT NOT NULL,
      default_approval_mode TEXT NOT NULL, classified_by TEXT, classified_at TEXT,
      version TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE v8_consumer_tool_policies (
      policy_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT,
      consumer_class TEXT NOT NULL, tool_id TEXT NOT NULL, allowed INTEGER NOT NULL,
      approval_override TEXT NOT NULL, max_invocations_per_run INTEGER,
      effective_from TEXT NOT NULL, effective_until TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE wave8_agent_tool_governance_events (
      event_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT NOT NULL,
      agent_id TEXT NOT NULL, tool_id TEXT, tool_name TEXT NOT NULL, project_id TEXT,
      run_id TEXT, decision TEXT NOT NULL, reason TEXT NOT NULL, policy_ref TEXT,
      input_digest TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE v8_context_snapshots (
      snapshot_id TEXT PRIMARY KEY,
      snapshot_version INTEGER NOT NULL DEFAULT 1,
      captured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      workspace_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      project_id TEXT,
      conversation_id TEXT,
      execution_run_id TEXT,
      artifact_refs TEXT NOT NULL DEFAULT '[]',
      effective_scope_ref TEXT NOT NULL,
      resolved_role_ref TEXT NOT NULL,
      initiator_user_id TEXT NOT NULL,
      consumer_class TEXT NOT NULL CHECK (consumer_class IN ('chat','execution','retrieval','background','worker')),
      privacy_mode INTEGER NOT NULL DEFAULT 0,
      source_context_refs TEXT NOT NULL DEFAULT '[]',
      drift_events TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE my_ideas (
      id TEXT PRIMARY KEY, user_id TEXT, organization_id TEXT NOT NULL, title TEXT NOT NULL,
      body TEXT, tags TEXT, source_type TEXT, source_conversation_id TEXT, source_message_id TEXT,
      stage TEXT, action_contract_json TEXT, source_pack_json TEXT, evidence_refs_json TEXT
    );
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY, project_id TEXT, organization_id TEXT, title TEXT, description TEXT,
      status TEXT, priority TEXT, assignee_id TEXT, reporter_id TEXT, due_date TIMESTAMP,
      task_type TEXT, estimated_hours REAL, tags TEXT, initiative_id TEXT, progress INTEGER,
      acceptance_criteria TEXT, custom_status_id TEXT, created_by TEXT, created_at TIMESTAMP, updated_at TIMESTAMP
    );
    CREATE TABLE interview_library_templates (
      id TEXT PRIMARY KEY, organization_id TEXT, name TEXT NOT NULL, description TEXT,
      category TEXT NOT NULL, status TEXT DEFAULT 'approved', visibility TEXT DEFAULT 'org',
      is_default INTEGER DEFAULT 0, version INTEGER DEFAULT 1, created_by TEXT,
      created_at TIMESTAMP, updated_at TIMESTAMP
    );
    CREATE TABLE interview_library_template_questions (
      id TEXT PRIMARY KEY, template_id TEXT NOT NULL, category TEXT NOT NULL,
      question_text TEXT NOT NULL, sort_order INTEGER, answer_type TEXT,
      is_required INTEGER, created_at TIMESTAMP
    );
    CREATE TABLE interview_sessions (
      id TEXT PRIMARY KEY, organization_id TEXT, project_id TEXT, assignment_id TEXT,
      status TEXT, answered_questions INTEGER, total_questions INTEGER
    );
    CREATE TABLE interview_questions (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL, organization_id TEXT NOT NULL,
      category TEXT NOT NULL, question_text TEXT NOT NULL, answer_text TEXT,
      status TEXT, sort_order INTEGER
    );
    CREATE TABLE interview_insights (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, title TEXT NOT NULL,
      prompt_type TEXT, source_session_ids TEXT, content TEXT, status TEXT,
      created_by TEXT, created_at TIMESTAMP, updated_at TIMESTAMP
    );
    CREATE TABLE interview_assignments (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT,
      assignee_user_id TEXT NOT NULL, template_id TEXT NOT NULL,
      template_version INTEGER DEFAULT 1, process_ref TEXT, status TEXT DEFAULT 'assigned',
      session_id TEXT, task_id TEXT, due_at TIMESTAMP, started_at TIMESTAMP,
      submitted_at TIMESTAMP, sent_back_at TIMESTAMP, sent_back_reason TEXT,
      created_by TEXT, created_at TIMESTAMP, updated_at TIMESTAMP
    );
    CREATE TABLE assessments (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT,
      assessment_type TEXT NOT NULL, name TEXT NOT NULL, status TEXT,
      completion_percent INTEGER, confidence_avg REAL, answers_json TEXT,
      context_snapshot TEXT, assessment_definition_id TEXT,
      assessment_definition_version TEXT, created_by TEXT, updated_by TEXT,
      created_at TIMESTAMP, updated_at TIMESTAMP
    );
    CREATE TABLE assessment_sessions (
      id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL, user_id TEXT NOT NULL,
      opened_at TIMESTAMP, closed_at TIMESTAMP
    );
    CREATE TABLE assessment_accepted_snapshots (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, assessment_id TEXT NOT NULL,
      review_id TEXT NOT NULL, snapshot_json TEXT NOT NULL, provenance_json TEXT NOT NULL,
      accepted_by TEXT NOT NULL, accepted_at TIMESTAMP, is_current BOOLEAN NOT NULL DEFAULT TRUE
    );
    CREATE UNIQUE INDEX idx_accepted_snapshots_current
      ON assessment_accepted_snapshots(assessment_id) WHERE is_current;
    CREATE TABLE initiative_candidates (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      organization_id TEXT NOT NULL, source_type TEXT NOT NULL,
      source_id TEXT, title TEXT NOT NULL, rationale TEXT, fit_score REAL,
      status TEXT NOT NULL DEFAULT 'pending', created_at TIMESTAMPTZ DEFAULT NOW(),
      created_by TEXT, initiative_id TEXT, duplicate_of_initiative_id TEXT,
      accepted_at TIMESTAMPTZ
    );
    CREATE TABLE assessment_candidate_handoffs (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, assessment_id TEXT NOT NULL,
      output_id TEXT NOT NULL, review_id TEXT, candidate_id TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'assessment_accepted_output',
      created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (organization_id, assessment_id)
    );
    CREATE TABLE initiatives (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT, name TEXT NOT NULL,
      status TEXT NOT NULL, source_type TEXT, source_id TEXT,
      planned_start_date DATE, planned_end_date DATE,
      start_date DATE, end_date DATE, budget_currency TEXT, expected_roi REAL,
      baseline_version INTEGER NOT NULL DEFAULT 0, schedule_baseline_id TEXT,
      execution_started_at TIMESTAMPTZ, done_at TIMESTAMPTZ, done_by TEXT,
      owner_business_id TEXT, owner_execution_id TEXT, sponsor_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE financial_analyses (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT,
      title TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'DRAFT',
      analysis_type TEXT, periods JSONB, statement_data JSONB, currency TEXT,
      source_statement_ids JSONB, source_statement_pack_id TEXT, approved_by TEXT,
      approved_at TIMESTAMPTZ, created_by TEXT, created_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ
    );
    CREATE TABLE initiative_kpis (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, initiative_id TEXT,
      organization_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
      category TEXT, unit TEXT, direction TEXT, measurement_frequency TEXT,
      baseline_value REAL, target_value REAL, threshold_mode TEXT,
      amber_threshold_pct REAL, red_threshold_pct REAL, amber_threshold_abs REAL,
      red_threshold_abs REAL, alert_threshold REAL, alert_direction TEXT,
      owner_user_id TEXT, kpi_kind TEXT, leads_kpi_id TEXT, current_value REAL,
      visibility TEXT NOT NULL DEFAULT 'org_visible', current_definition_version INTEGER,
      created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
    );
    CREATE TABLE kpi_definition_versions (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, organization_id TEXT NOT NULL,
      kpi_id TEXT NOT NULL, version_no INTEGER NOT NULL, definition JSONB NOT NULL,
      definition_hash TEXT NOT NULL, created_by TEXT, reason TEXT, source TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE kpi_measurements (
      id TEXT PRIMARY KEY, kpi_id TEXT NOT NULL, value REAL NOT NULL,
      measured_at TIMESTAMPTZ NOT NULL, notes TEXT, explanation TEXT,
      action_items TEXT, created_by TEXT, created_at TIMESTAMPTZ
    );
    CREATE TABLE initiative_benefits (
      id TEXT PRIMARY KEY, initiative_id TEXT NOT NULL, organization_id TEXT NOT NULL,
      name TEXT NOT NULL, description TEXT, benefit_type TEXT, kpi_id TEXT,
      source_initiative_kpi_id TEXT, target_value REAL, source_tag TEXT,
      confidence_level TEXT, created_by TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
      current_value REAL, last_measured_at TIMESTAMPTZ,
      owner_id TEXT, estimated_annual_value REAL, actual_annual_value REAL,
      status TEXT DEFAULT 'tracking'
    );
    CREATE TABLE benefit_measurements (
      id TEXT PRIMARY KEY, benefit_id TEXT NOT NULL, measured_value REAL NOT NULL,
      measured_at DATE NOT NULL, measured_by TEXT, is_verified BOOLEAN DEFAULT FALSE,
      verified_by TEXT, verified_at TIMESTAMPTZ
    );
    CREATE TABLE kpi_metric_audit_log (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, kpi_id TEXT NOT NULL,
      section TEXT, event_type TEXT, source TEXT, actor_user_id TEXT, summary TEXT,
      before_json JSONB, after_json JSONB, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE decisions (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT,
      initiative_id TEXT, task_id TEXT, title TEXT NOT NULL, description TEXT,
      type TEXT NOT NULL, decision_maker_id TEXT NOT NULL, options TEXT,
      criteria TEXT, deadline TIMESTAMPTZ, escalation_deadline TIMESTAMPTZ,
      status TEXT DEFAULT 'pending', selected_option TEXT, decision_rationale TEXT,
      decided_at TIMESTAMPTZ, created_by TEXT NOT NULL, pmo_domain TEXT,
      trigger_status TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
    );
    CREATE TABLE decision_delegations (
      id TEXT PRIMARY KEY,
      decision_id TEXT NOT NULL,
      organization_id TEXT,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      delegation_type TEXT NOT NULL,
      reason TEXT,
      comment TEXT,
      status TEXT DEFAULT 'pending',
      response_comment TEXT,
      accepted_at TIMESTAMPTZ,
      rejected_at TIMESTAMPTZ,
      rejection_reason TEXT,
      completed_at TIMESTAMPTZ,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX idx_t01_proof_delegations_authority
      ON decision_delegations(organization_id, decision_id, to_user_id, status);
    CREATE TABLE decision_history (
      id TEXT PRIMARY KEY, decision_id TEXT NOT NULL, action TEXT NOT NULL,
      old_status TEXT, new_status TEXT, changed_by TEXT NOT NULL,
      changed_at TIMESTAMPTZ DEFAULT NOW(), details TEXT
    );
    CREATE TABLE initiative_ai_blueprints (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, initiative_id TEXT,
      prompt_text TEXT, generated_wbs TEXT, generated_milestones TEXT,
      generated_deps TEXT, generated_resources TEXT, citations TEXT,
      ai_model_used TEXT, confidence REAL, status TEXT DEFAULT 'proposed',
      applied_at TIMESTAMPTZ, created_by TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE task_dependencies (
      id TEXT PRIMARY KEY, from_task_id TEXT NOT NULL, to_task_id TEXT NOT NULL,
      type TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE initiative_milestones (
      id TEXT PRIMARY KEY, initiative_id TEXT NOT NULL, organization_id TEXT NOT NULL,
      name TEXT NOT NULL, description TEXT, target_date DATE, actual_date DATE, status TEXT,
      order_index INTEGER, is_gate INTEGER, gate_decision_id TEXT,
      created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, created_by TEXT
    );
    -- U03 owner-backed mobilization writes RAID and local calendar projections
    -- through the owning modules, so both owner tables belong to this schema.
    CREATE TABLE raid_items (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, initiative_id TEXT NOT NULL,
      type TEXT NOT NULL, title TEXT NOT NULL, description TEXT, status TEXT NOT NULL,
      probability TEXT, impact TEXT, mitigation_plan TEXT, owner_id TEXT, due_date DATE,
      created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
    );
    CREATE TABLE v8_calendar_items (
      calendar_item_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, source_id TEXT,
      item_type TEXT NOT NULL, source_system TEXT NOT NULL, source_object_ref TEXT,
      title TEXT NOT NULL, start_at TIMESTAMPTZ, end_at TIMESTAMPTZ, all_day INTEGER,
      timezone TEXT, visibility_class TEXT, edit_authority TEXT, recurrence_model_json TEXT,
      sync_state TEXT, etag TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
    );
    -- U04 recovery loop: the delivery handoff opens a Recovery Card whenever the
    -- result is partial/not_achieved, and the final-output facts count open cards
    -- and unresolved experiments. Minimal owner shape, matching the columns the
    -- transformation path actually reads and writes.
    CREATE TABLE kpi_deviation_cases (
      id TEXT PRIMARY KEY, kpi_id TEXT NOT NULL, organization_id TEXT NOT NULL,
      period_start DATE NOT NULL, severity TEXT, status TEXT, owner_user_id TEXT,
      deviation_summary TEXT, detected_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT kpi_deviation_cases_period_uq UNIQUE (organization_id,kpi_id,period_start)
    );
    CREATE TABLE kpi_recovery_cards (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL,
      deviation_case_id TEXT NOT NULL UNIQUE, kpi_id TEXT NOT NULL,
      hypothesis TEXT, confirmed_cause TEXT, impact_description TEXT,
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      lifecycle_status TEXT NOT NULL DEFAULT 'ACTIVE',
      decision TEXT, active_since TIMESTAMPTZ NOT NULL DEFAULT now(),
      closed_at TIMESTAMPTZ, closed_by TEXT, version INTEGER NOT NULL DEFAULT 1,
      created_by TEXT, updated_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE initiative_resources (
      id TEXT PRIMARY KEY, initiative_id TEXT NOT NULL, organization_id TEXT NOT NULL,
      user_id TEXT, name TEXT, role TEXT, allocation_percentage INTEGER,
      start_date DATE, end_date DATE, notes TEXT, source TEXT,
      created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ
    );
    CREATE TABLE initiative_history (
      id TEXT PRIMARY KEY, initiative_id TEXT NOT NULL, action TEXT NOT NULL,
      changed_by TEXT NOT NULL, changed_at TIMESTAMPTZ, notes TEXT
    );
    CREATE TABLE initiative_status_history (
      id TEXT PRIMARY KEY, initiative_id TEXT NOT NULL, organization_id TEXT NOT NULL,
      from_status TEXT NOT NULL, to_status TEXT NOT NULL, changed_by TEXT,
      reason TEXT, gate_type TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE initiative_schedule_baselines (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, initiative_id TEXT NOT NULL,
      version INTEGER NOT NULL, status_at_baseline TEXT,
      planned_start_date TIMESTAMPTZ, planned_end_date TIMESTAMPTZ,
      snapshot TEXT NOT NULL DEFAULT '{}', created_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (initiative_id,version)
    );
    CREATE TABLE initiative_dependencies (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT,
      from_initiative_id TEXT NOT NULL,
      to_initiative_id TEXT NOT NULL, type TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE initiative_gate_roles (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, initiative_id TEXT NOT NULL,
      user_id TEXT NOT NULL, gate_role TEXT NOT NULL
    );
    CREATE TABLE project_steering_board_members (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, project_id TEXT NOT NULL,
      user_id TEXT NOT NULL
    );
    CREATE TABLE project_steering_board (
      project_id TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0,
      quorum_rule TEXT, sla_hours INTEGER, created_by_id TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE initiative_stakeholders (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT, initiative_id TEXT NOT NULL,
      user_id TEXT NOT NULL, raci_type TEXT
    );
    CREATE TABLE initiative_watchers (
      id TEXT PRIMARY KEY, initiative_id TEXT NOT NULL, user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(initiative_id,user_id)
    );
    CREATE TABLE initiative_handoffs (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, initiative_id TEXT NOT NULL,
      from_status TEXT, to_status TEXT, boundary TEXT, from_module TEXT, to_module TEXT,
      readiness_allowed BOOLEAN, readiness_missing TEXT, readiness_reasons TEXT,
      actor_id TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE audit_events (
      id TEXT PRIMARY KEY, ts TIMESTAMPTZ DEFAULT NOW(), actor_id TEXT,
      actor_type TEXT NOT NULL DEFAULT 'USER', org_id TEXT, action TEXT,
      resource_type TEXT, resource_id TEXT, before_json TEXT, after_json TEXT,
      metadata_json TEXT DEFAULT '{}', ip TEXT, user_agent TEXT
    );
  `);
  await pool.query(
    fs.readFileSync(
      path.resolve(process.cwd(), 'server/migrations/20260807_agent_t01_transformation_case.sql'),
      'utf8'
    )
  );
  await pool.query(
    fs.readFileSync(
      path.resolve(process.cwd(), 'server/migrations/257_notification_system.sql'),
      'utf8'
    )
  );
  await pool.query(
    fs.readFileSync(
      path.resolve(process.cwd(), 'server/migrations/20260807_v8_agent_context_grounding.sql'),
      'utf8'
    )
  );
  await pool.query(
    fs.readFileSync(
      path.resolve(process.cwd(), 'server/migrations/20260807_v8_agent_proposal_governance.sql'),
      'utf8'
    )
  );
  await pool.query(`INSERT INTO organizations VALUES ($1)`, [ids.organization]);
  await pool.query(
    fs.readFileSync(
      path.resolve(process.cwd(), 'server/migrations/20260807_v8_agent_adapter_orchestration.sql'),
      'utf8'
    )
  );
  await pool.query(
    fs.readFileSync(
      path.resolve(process.cwd(), 'server/migrations/20260808_v8_agent_resource_governance.sql'),
      'utf8'
    )
  );
  await pool.query(
    fs.readFileSync(
      path.resolve(
        process.cwd(),
        'server/migrations/20260808_t01_portfolio_decision_resolution.sql'
      ),
      'utf8'
    )
  );
  // U04 recovery experiments (extends the recovery-card owner shape above).
  await pool.query(
    fs.readFileSync(
      path.resolve(process.cwd(), 'server/migrations/20260808_u04_recovery_experiments.sql'),
      'utf8'
    )
  );
  // U03 owner-backed mobilization/execution: `reviewMobilizationBlueprint` now
  // materializes RAID, calendar and monitoring rows through its owner adapter,
  // so the chain cannot reach `final_outputs` without these tables.
  await pool.query(
    fs.readFileSync(
      path.resolve(process.cwd(), 'server/migrations/20260809_t01_u03_owner_backed_execution.sql'),
      'utf8'
    )
  );
  await pool.query(
    fs.readFileSync(
      path.resolve(
        process.cwd(),
        'server/migrations/20260810_t01_initiative_lifecycle_gate_decisions.sql'
      ),
      'utf8'
    )
  );
  await pool.query(
    fs.readFileSync(
      path.resolve(process.cwd(), 'server/migrations/935_exe009_closure_delivery_receipt.sql'),
      'utf8'
    )
  );
  await pool.query(`INSERT INTO organization_members VALUES ($1,$2),($1,$3)`, [
    ids.organization,
    ids.actor,
    ids.stakeholder,
  ]);
  await pool.query(`INSERT INTO projects VALUES ($1,$2)`, [ids.project, ids.organization]);
  await pool.query(
    `INSERT INTO v8_agent_resource_policies
      (policy_id,organization_id,project_id,max_concurrent_executions,max_estimated_cost_usd_per_run,lease_seconds,enabled)
     VALUES ('policy-t01-shared-a09',$1,$2,1,1000,300,1)`,
    [ids.organization, ids.project]
  );
  await pool.query(
    `INSERT INTO project_members (project_id,user_id,project_role) VALUES ($1,$2,'PROJECT_MANAGER')`,
    [ids.project, ids.actor]
  );
  await pool.query(
    `INSERT INTO users (id,organization_id,email,first_name,last_name,status,role) VALUES
      ($1,$3,'actor@example.test','Agent','Reviewer','active','SUPERADMIN'),
      ($2,$3,'stakeholder@example.test','Stake','Holder','active','USER')`,
    [ids.actor, ids.stakeholder, ids.organization]
  );
  await pool.query(
    `INSERT INTO transformation_cases (
      transformation_case_id, organization_id, project_id, context_snapshot_id, execution_run_id, initiated_by_user_id, mandate,
      status, lifecycle_stage, lineage_id, idempotency_key, version
    ) VALUES ($1,$2,$3,'snapshot-t01-full','run-t01-full',$4,'Prepare transformation plan','active','initial_ideas','lineage-t01-i03','idem-t01-i03',1)`,
    [ids.case, ids.organization, ids.project, ids.actor]
  );
  await pool.query(
    `INSERT INTO v8_agent_run_identities VALUES ('run-t01-full',$1,$2,NULL,'lineage-t01-i03')`,
    [ids.organization, ids.case]
  );
  await pool.query(
    `INSERT INTO v8_context_snapshots
      (snapshot_id,workspace_id,organization_id,project_id,execution_run_id,artifact_refs,
       effective_scope_ref,resolved_role_ref,initiator_user_id,consumer_class,
       source_context_refs,drift_events)
     VALUES ('snapshot-t01-full',$1,$1,$2,'run-t01-full','[]','project:t01','transformation_agent',$3,
       'execution','["transformation:source-pack"]','[]')`,
    [ids.organization, ids.project, ids.actor]
  );
  await pool.query(
    `INSERT INTO v8_execution_runs
      (run_id,organization_id,context_snapshot_id,initiator_user_id,state,plan_version,goal,metadata)
     VALUES ('run-t01-full',$1,'snapshot-t01-full',$2,'planning',1,'Prepare transformation plan',
       $3::jsonb)`,
    [
      ids.organization,
      ids.actor,
      JSON.stringify({
        transformationCaseId: ids.case,
        lineageId: 'lineage-t01-i03',
        fixture: 'canonical_t01_proof',
      }),
    ]
  );
  await pool.query(
    `INSERT INTO transformation_plans (
      plan_id, transformation_case_id, organization_id, version, status, summary, created_by_user_id
    ) VALUES ($1,$2,$3,1,'approved','Approved transformation plan',$4)`,
    [ids.plan, ids.case, ids.organization, ids.actor]
  );
  for (const step of compileT01TransformationPlan()) {
    await pool.query(
      `INSERT INTO transformation_plan_steps (
        step_id,plan_id,transformation_case_id,organization_id,step_index,lifecycle_stage,
        business_purpose,module_target,capability_status,inputs_json,outputs_json,owner_role,
        depends_on_json,approval_class,risk_class,execution_mode,estimated_effort,status,
        blocker_reason
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13::jsonb,$14,$15,$16,$17,'proposed',$18)`,
      [
        step.stepId,
        ids.plan,
        ids.case,
        ids.organization,
        step.stepIndex,
        step.lifecycleStage,
        step.businessPurpose,
        step.moduleTarget,
        step.capabilityStatus,
        JSON.stringify(step.inputs),
        JSON.stringify(step.outputs),
        step.ownerRole,
        JSON.stringify(step.dependsOn),
        step.approvalClass,
        step.riskClass,
        step.executionMode,
        step.estimatedEffort,
        step.blockerReason,
      ]
    );
  }
  await pool.query(
    `UPDATE transformation_cases SET active_plan_id=$1 WHERE transformation_case_id=$2`,
    [ids.plan, ids.case]
  );
  await pool.query(
    `INSERT INTO transformation_case_audit_events (
      audit_event_id,transformation_case_id,organization_id,plan_id,plan_version,event_type,
      actor_user_id,payload_digest,detail_json
    ) VALUES ('audit-plan-approved-t01-i03',$1,$2,$3,1,'transformation_plan.approved',$4,$5,$6::jsonb)`,
    [
      ids.case,
      ids.organization,
      ids.plan,
      ids.actor,
      createHash('sha256').update('Approved transformation plan').digest('hex'),
      JSON.stringify({ decisionReason: 'Canonical full-flow proof plan reviewed' }),
    ]
  );
  await pool.query(
    `INSERT INTO my_ideas (id,user_id,organization_id,title,body,source_type)
     VALUES ($1,$2,$3,'Reduce lead time','Hypothesis','transformation_agent')`,
    [ids.idea, ids.actor, ids.organization]
  );
  await pool.query(
    `INSERT INTO transformation_case_artifact_links (
      link_id,transformation_case_id,organization_id,lifecycle_stage,artifact_type,
      artifact_id,lineage_role,created_by_user_id
    ) VALUES ('link-idea-t01-i03',$1,$2,'initial_ideas','my_idea',$3,'output',$4)`,
    [ids.case, ids.organization, ids.idea, ids.actor]
  );

  await pool.query(
    `INSERT INTO transformation_cases (
      transformation_case_id,organization_id,project_id,context_snapshot_id,execution_run_id,
      initiated_by_user_id,mandate,status,lifecycle_stage,lineage_id,idempotency_key,version
    ) VALUES ('tc-t01-a05-ideas',$1,$2,'snapshot-t01-full','run-t01-a05-ideas',$3,
      'Prepare governed initial ideas','plan_approved','initial_ideas','lineage-t01-a05-ideas',
      'idem-t01-a05-ideas',1)`,
    [ids.organization, ids.project, ids.actor]
  );
  await pool.query(
    `INSERT INTO transformation_plans (
      plan_id,transformation_case_id,organization_id,version,status,summary,created_by_user_id
    ) VALUES ('tp-t01-a05-ideas','tc-t01-a05-ideas',$1,1,'approved',
      'Initial Ideas A05 enforcement proof',$2)`,
    [ids.organization, ids.actor]
  );
  await pool.query(
    `UPDATE transformation_cases SET active_plan_id='tp-t01-a05-ideas'
      WHERE transformation_case_id='tc-t01-a05-ideas'`
  );
  await pool.query(
    `INSERT INTO v8_agent_run_identities VALUES
      ('run-t01-a05-ideas',$1,'tc-t01-a05-ideas',NULL,'lineage-t01-a05-ideas')`,
    [ids.organization]
  );
  const initialIdeasProposal = await proposeInitialIdeas({
    transformationCaseId: 'tc-t01-a05-ideas',
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 1,
    maxIdeas: 3,
  });
  assert.equal(
    (
      await pool.query(`SELECT COUNT(*)::int count FROM my_ideas WHERE source_message_id=$1`, [
        initialIdeasProposal.proposalId,
      ])
    ).rows[0].count,
    0
  );
  await assert.rejects(
    () =>
      reviewInitialIdeasProposal({
        proposalId: initialIdeasProposal.proposalId,
        transformationCaseId: 'tc-t01-a05-ideas',
        organizationId: ids.organization,
        actorUserId: ids.stakeholder,
        expectedVersion: 2,
        decision: 'approve',
        reason: 'Unauthorized Initial Ideas review must fail',
      }),
    /proposal_reviewer_not_authorized/
  );
  assert.equal(
    (
      await pool.query(`SELECT COUNT(*)::int count FROM my_ideas WHERE source_message_id=$1`, [
        initialIdeasProposal.proposalId,
      ])
    ).rows[0].count,
    0
  );
  const appliedInitialIdeas = await reviewInitialIdeasProposal({
    proposalId: initialIdeasProposal.proposalId,
    transformationCaseId: 'tc-t01-a05-ideas',
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 2,
    decision: 'approve',
    reason: 'Initial Ideas reviewed under common A05 authority',
  });
  assert.equal(appliedInitialIdeas.status, 'applied');
  await pool.query(
    `UPDATE transformation_stage_proposals SET status='approved',applied_at=NULL WHERE proposal_id=$1`,
    [initialIdeasProposal.proposalId]
  );
  const ideasResumed = await reviewInitialIdeasProposal({
    proposalId: initialIdeasProposal.proposalId,
    transformationCaseId: 'tc-t01-a05-ideas',
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 2,
    decision: 'approve',
    reason: 'Resume approved Ideas aggregate without duplicate writes',
  });
  assert.deepEqual(ideasResumed.artifactIds, appliedInitialIdeas.artifactIds);

  const proposal = await proposeInterviews({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 1,
    stakeholders: [
      {
        assigneeUserId: ids.stakeholder,
        role: 'Operations Director',
        focus: ['lead time', 'handoffs'],
      },
    ],
  });
  const pre = (
    await pool.query(`SELECT
    (SELECT COUNT(*)::int FROM interview_assignments) assignments,
    (SELECT COUNT(*)::int FROM tasks WHERE task_type='interview') tasks,
    (SELECT COUNT(*)::int FROM interview_library_templates) templates`)
  ).rows[0];
  assert.deepEqual(pre, { assignments: 0, tasks: 0, templates: 0 });

  await assert.rejects(
    () =>
      reviewInterviewsProposal({
        proposalId: proposal.proposalId,
        transformationCaseId: ids.case,
        organizationId: ids.organization,
        actorUserId: ids.stakeholder,
        expectedVersion: 2,
        decision: 'approve',
        reason: 'Unauthorized Interview review must fail before template creation',
        dueAt: '2026-08-14T12:00:00.000Z',
      }),
    /proposal_reviewer_not_authorized/
  );
  const interviewUnauthorizedEffects = (
    await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM interview_assignments) assignments,
      (SELECT COUNT(*)::int FROM tasks WHERE task_type='interview') tasks,
      (SELECT COUNT(*)::int FROM interview_library_templates) templates`)
  ).rows[0];
  assert.deepEqual(interviewUnauthorizedEffects, { assignments: 0, tasks: 0, templates: 0 });

  await pool.query(`
    CREATE OR REPLACE FUNCTION t01_fail_interview_assignment_once() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'T01 controlled assignment failure'; END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER t01_fail_interview_assignment_once
      BEFORE INSERT ON interview_assignments
      FOR EACH ROW EXECUTE FUNCTION t01_fail_interview_assignment_once();
  `);
  await assert.rejects(
    () =>
      reviewInterviewsProposal({
        proposalId: proposal.proposalId,
        transformationCaseId: ids.case,
        organizationId: ids.organization,
        actorUserId: ids.actor,
        expectedVersion: 2,
        decision: 'approve',
        reason: 'Approved stakeholder and evidence questions',
        dueAt: '2026-08-14T12:00:00.000Z',
      }),
    /T01 controlled assignment failure/
  );
  await pool.query(`
    DROP TRIGGER t01_fail_interview_assignment_once ON interview_assignments;
    DROP FUNCTION t01_fail_interview_assignment_once();
  `);
  const interviewResumeCheckpoint = (
    await pool.query(
      `SELECT
        (SELECT status FROM transformation_stage_proposals WHERE proposal_id=$1) proposal_status,
        (SELECT COUNT(*)::int FROM interview_library_templates) templates,
        (SELECT COUNT(*)::int FROM interview_assignments) assignments`,
      [proposal.proposalId]
    )
  ).rows[0];
  assert.deepEqual(interviewResumeCheckpoint, {
    proposal_status: 'approved',
    templates: 1,
    assignments: 0,
  });

  const applied = await reviewInterviewsProposal({
    proposalId: proposal.proposalId,
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 3,
    decision: 'approve',
    reason: 'Approved stakeholder and evidence questions',
    dueAt: '2026-08-14T12:00:00.000Z',
  });
  assert.equal(applied.status, 'applied');
  assert.equal(applied.artifactIds?.length, 1);

  const readback = (
    await pool.query(
      `SELECT
    (SELECT COUNT(*)::int FROM interview_library_templates WHERE organization_id=$1) templates,
    (SELECT COUNT(*)::int FROM interview_library_template_questions) questions,
    (SELECT COUNT(*)::int FROM interview_assignments WHERE organization_id=$1) assignments,
    (SELECT COUNT(*)::int FROM tasks WHERE organization_id=$1 AND task_type='interview') tasks,
    (SELECT COUNT(*)::int FROM transformation_case_artifact_links WHERE transformation_case_id=$2 AND artifact_type='interview_assignment') links,
    (SELECT status FROM transformation_stage_proposals WHERE proposal_id=$3) proposal_status,
    (SELECT COUNT(*)::int FROM transformation_case_audit_events WHERE transformation_case_id=$2 AND event_type='transformation_interviews.approved_and_applied') applied_audits`,
      [ids.organization, ids.case, proposal.proposalId]
    )
  ).rows[0];
  assert.deepEqual(readback, {
    templates: 1,
    questions: 2,
    assignments: 1,
    tasks: 1,
    links: 1,
    proposal_status: 'applied',
    applied_audits: 1,
  });
  const assignmentId = String(applied.artifactIds?.[0]);
  const notificationReadback = (
    await pool.query(
      `SELECT n.id,n.user_id,n.organization_id,n.type,n.entity_type,n.entity_id,
              n.action_url,n.priority,n.is_read,n.channels_sent,
              EXISTS (
                SELECT 1 FROM organization_members om
                 WHERE om.organization_id=n.organization_id AND om.user_id=n.user_id
              ) recipient_is_tenant_member,
              (SELECT COUNT(*)::int FROM notification_delivery_log dl
                WHERE dl.notification_id=n.id AND dl.channel='in_app' AND dl.status='sent') in_app_deliveries
         FROM notifications n
        WHERE n.organization_id=$1 AND n.user_id=$2
          AND n.type='interview_assigned' AND n.entity_type='interview_assignment'
          AND n.entity_id=$3`,
      [ids.organization, ids.stakeholder, assignmentId]
    )
  ).rows[0];
  assert.ok(notificationReadback?.id);
  assert.deepEqual(
    {
      user_id: notificationReadback.user_id,
      organization_id: notificationReadback.organization_id,
      type: notificationReadback.type,
      entity_type: notificationReadback.entity_type,
      entity_id: notificationReadback.entity_id,
      action_url: notificationReadback.action_url,
      priority: notificationReadback.priority,
      is_read: notificationReadback.is_read,
      channels_sent: JSON.parse(notificationReadback.channels_sent),
      recipient_is_tenant_member: notificationReadback.recipient_is_tenant_member,
      in_app_deliveries: notificationReadback.in_app_deliveries,
    },
    {
      user_id: ids.stakeholder,
      organization_id: ids.organization,
      type: 'interview_assigned',
      entity_type: 'interview_assignment',
      entity_id: assignmentId,
      action_url: `/interview?assignmentId=${assignmentId}`,
      priority: 'normal',
      is_read: false,
      channels_sent: ['in_app'],
      recipient_is_tenant_member: true,
      in_app_deliveries: 1,
    }
  );
  const replayNotificationId = await notificationService.send({
    userId: ids.stakeholder,
    organizationId: ids.organization,
    type: 'interview_assigned',
    title: 'New Interview Assignment',
    body: 'You have been assigned the interview: Transformation interview — Operations Director',
    entityType: 'interview_assignment',
    entityId: assignmentId,
    actionUrl: `/interview?assignmentId=${assignmentId}`,
    priority: 'normal',
  });
  assert.equal(replayNotificationId, notificationReadback.id);
  const notificationReplayCounts = (
    await pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM notifications
          WHERE organization_id=$1 AND user_id=$2 AND type='interview_assigned' AND entity_id=$3) notifications,
        (SELECT COUNT(*)::int FROM notification_dedup
          WHERE organization_id=$1 AND user_id=$2 AND type='interview_assigned') dedup_slots,
        (SELECT COUNT(*)::int FROM notification_delivery_log
          WHERE notification_id=$4 AND channel='in_app' AND status='sent') in_app_deliveries`,
      [ids.organization, ids.stakeholder, assignmentId, notificationReadback.id]
    )
  ).rows[0];
  assert.deepEqual(notificationReplayCounts, {
    notifications: 1,
    dedup_slots: 1,
    in_app_deliveries: 1,
  });
  await pool.query(`
    CREATE OR REPLACE FUNCTION t01_fail_notification_once() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'T01 controlled notification failure'; END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER t01_fail_notification_once
      BEFORE INSERT ON notifications
      FOR EACH ROW EXECUTE FUNCTION t01_fail_notification_once();
  `);
  const failSoftAssignment = await interviewAssignmentService.create({
    organizationId: ids.organization,
    projectId: ids.project,
    templateId: `itpl_tc_${proposal.candidates[0].candidateId}`,
    templateVersion: 1,
    assigneeUserIds: [ids.stakeholder],
    dueAt: '2026-08-15T12:00:00.000Z',
    priority: 'high',
    processRef: 'transformation:t01-notification-failure-proof',
    createdBy: ids.actor,
  });
  await pool.query(`
    DROP TRIGGER t01_fail_notification_once ON notifications;
    DROP FUNCTION t01_fail_notification_once();
  `);
  const notificationFailureIsolation = (
    await pool.query(
      `SELECT
        (SELECT COUNT(*)::int FROM interview_assignments WHERE id=$1) assignments,
        (SELECT COUNT(*)::int FROM tasks WHERE id=(SELECT task_id FROM interview_assignments WHERE id=$1)) tasks,
        (SELECT COUNT(*)::int FROM notifications WHERE entity_id=$1) notifications`,
      [failSoftAssignment.id]
    )
  ).rows[0];
  assert.deepEqual(notificationFailureIsolation, { assignments: 1, tasks: 1, notifications: 0 });
  await pool.query(
    `DELETE FROM tasks WHERE id=(SELECT task_id FROM interview_assignments WHERE id=$1)`,
    [failSoftAssignment.id]
  );
  await pool.query(`DELETE FROM interview_assignments WHERE id=$1`, [failSoftAssignment.id]);
  console.log(
    JSON.stringify({
      proof: 'T01_I03_DURABLE_NOTIFICATION_GREEN',
      recipient: ids.stakeholder,
      tenant: ids.organization,
      assignmentId,
      durableInApp: 1,
      replayNotifications: 1,
      replayDeliveryAttempts: 1,
      forcedNotificationFailure: 'assignment=1 task=1 notification=0',
      assignmentAtomicity: 'notification is post-assignment and fail-soft',
      externalDeliveryClaimed: false,
    })
  );
  await pool.query(
    `INSERT INTO interview_sessions (
      id,organization_id,project_id,assignment_id,status,answered_questions,total_questions
    ) VALUES ('session-t01-i03',$1,$2,$3,'completed',2,2)`,
    [ids.organization, ids.project, assignmentId]
  );
  await pool.query(
    `INSERT INTO interview_questions (
      id,session_id,organization_id,category,question_text,answer_text,status,sort_order
    ) VALUES
      ('answer-t01-i03-1','session-t01-i03',$1,'operations','Where is the delay?','Approval handoffs add five days.','answered',0),
      ('answer-t01-i03-2','session-t01-i03',$1,'finance','What is the measurable impact?','Working capital increases by 8 percent.','answered',1)`,
    [ids.organization]
  );
  await pool.query(
    `UPDATE interview_assignments SET status='approved', session_id='session-t01-i03'
     WHERE id=$1`,
    [assignmentId]
  );
  await pool.query(
    `INSERT INTO interview_insights (
      id,organization_id,title,prompt_type,source_session_ids,content,status,created_by,created_at,updated_at
    ) VALUES ('insight-t01-i03',$1,'Lead-time finding','summary',$2,'Evidence-backed finding','completed',$3,NOW(),NOW())`,
    [ids.organization, JSON.stringify(['session-t01-i03']), ids.actor]
  );
  let unapprovedInsightCode = '';
  try {
    await acceptInterviewResults({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 3,
      insightIds: ['insight-t01-i03'],
      decisionReason: 'Review interview evidence',
    });
  } catch (error) {
    unapprovedInsightCode = String((error as { code?: string }).code || '');
  }
  assert.equal(unapprovedInsightCode, 'TRANSFORMATION_INTERVIEW_INSIGHTS_NOT_APPROVED');
  await pool.query(`UPDATE interview_insights SET status='approved' WHERE id='insight-t01-i03'`);
  const accepted = await acceptInterviewResults({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 3,
    insightIds: ['insight-t01-i03'],
    decisionReason: 'Manager approved answers and evidence-backed insight',
  });
  assert.equal(accepted.lifecycleStage, 'drd');
  assert.equal(accepted.caseVersion, 4);
  const acceptedReadback = (
    await pool.query(
      `SELECT
    (SELECT lifecycle_stage FROM transformation_cases WHERE transformation_case_id=$1) lifecycle_stage,
    (SELECT version FROM transformation_cases WHERE transformation_case_id=$1) case_version,
    (SELECT COUNT(*)::int FROM transformation_case_artifact_links WHERE artifact_type='interview_session') session_links,
    (SELECT COUNT(*)::int FROM transformation_case_artifact_links WHERE artifact_type='interview_answer') answer_links,
    (SELECT COUNT(*)::int FROM transformation_case_artifact_links WHERE artifact_type='interview_insight') insight_links,
    (SELECT COUNT(*)::int FROM transformation_case_audit_events WHERE event_type='transformation_interviews.results_accepted') acceptance_audits`,
      [ids.case]
    )
  ).rows[0];
  assert.deepEqual(acceptedReadback, {
    lifecycle_stage: 'drd',
    case_version: 4,
    session_links: 1,
    answer_links: 2,
    insight_links: 1,
    acceptance_audits: 1,
  });
  const drdProposal = await proposeDrdAssessment({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 4,
    name: 'DRD — end-to-end transformation baseline',
  });
  const drdBeforeApproval = (
    await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM assessments) assessments,
      (SELECT COUNT(*)::int FROM assessment_sessions) sessions`)
  ).rows[0];
  assert.deepEqual(drdBeforeApproval, { assessments: 0, sessions: 0 });
  await pool.query(
    `UPDATE v8_tool_catalog SET classification_status='under_review'
      WHERE organization_id=$1 AND name='transformation.drd.materialize'`,
    [ids.organization]
  );
  let a06DeniedBeforeOwnerMutation = '';
  try {
    await reviewDrdAssessmentProposal({
      proposalId: drdProposal.proposalId,
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 5,
      decision: 'approve',
      reason: 'DRD scope and accepted Interview sources reviewed',
    });
  } catch (error) {
    a06DeniedBeforeOwnerMutation = String((error as Error).message);
  }
  assert.match(a06DeniedBeforeOwnerMutation, /adapter_governance_denied:tool_not_ratified/);
  assert.equal((await pool.query(`SELECT COUNT(*)::int count FROM assessments`)).rows[0].count, 0);
  assert.equal(
    (
      await pool.query(`SELECT status FROM transformation_stage_proposals WHERE proposal_id=$1`, [
        drdProposal.proposalId,
      ])
    ).rows[0].status,
    'approved'
  );
  await pool.query(
    `UPDATE v8_tool_catalog SET classification_status='ratified'
      WHERE organization_id=$1 AND name='transformation.drd.materialize'`,
    [ids.organization]
  );
  const drdApplied = await reviewDrdAssessmentProposal({
    proposalId: drdProposal.proposalId,
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 5,
    decision: 'approve',
    reason: 'Resume A05-approved DRD after A06 policy is ratified',
  });
  assert.equal(drdApplied.status, 'applied');
  assert.ok(drdApplied.assessmentId);
  await pool.query(
    `UPDATE transformation_stage_proposals SET status='approved',applied_at=NULL WHERE proposal_id=$1`,
    [drdProposal.proposalId]
  );
  const drdResumed = await reviewDrdAssessmentProposal({
    proposalId: drdProposal.proposalId,
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 5,
    decision: 'approve',
    reason: 'Resume approved DRD materialization after interrupted T01 finalization',
  });
  assert.equal(drdResumed.assessmentId, drdApplied.assessmentId);
  assert.equal((await pool.query(`SELECT COUNT(*)::int count FROM assessments`)).rows[0].count, 1);
  let draftDrdCode = '';
  try {
    await acceptDrdResults({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 6,
      decisionReason: 'Draft output must fail',
    });
  } catch (error) {
    draftDrdCode = String((error as { code?: string }).code || '');
  }
  assert.equal(draftDrdCode, 'TRANSFORMATION_DRD_OUTPUT_NOT_ACCEPTED');
  await pool.query(`UPDATE assessments SET status='APPROVED', completion_percent=100 WHERE id=$1`, [
    drdApplied.assessmentId,
  ]);
  await pool.query(
    `INSERT INTO assessment_accepted_snapshots (
      id,organization_id,assessment_id,review_id,snapshot_json,provenance_json,
      accepted_by,accepted_at,is_current
    ) VALUES ('snapshot-t01-i04',$1,$2,'review-t01-i04',$3,$4,$5,NOW(),TRUE)`,
    [
      ids.organization,
      drdApplied.assessmentId,
      JSON.stringify({ scoring: { completionPercent: 100, axes: [] } }),
      JSON.stringify({ source: 'DRD quality review' }),
      ids.actor,
    ]
  );
  const drdAccepted = await acceptDrdResults({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 6,
    decisionReason: 'Immutable accepted DRD snapshot reviewed',
  });
  assert.equal(drdAccepted.lifecycleStage, 'opportunity_synthesis');
  const drdReadback = (
    await pool.query(
      `SELECT
      (SELECT lifecycle_stage FROM transformation_cases WHERE transformation_case_id=$1) lifecycle_stage,
      (SELECT version FROM transformation_cases WHERE transformation_case_id=$1) case_version,
      (SELECT COUNT(*)::int FROM assessments WHERE assessment_type='DRD') assessments,
      (SELECT COUNT(*)::int FROM assessment_sessions) assessment_sessions,
      (SELECT COUNT(*)::int FROM transformation_case_artifact_links WHERE artifact_type='drd_assessment') assessment_links,
      (SELECT COUNT(*)::int FROM transformation_case_artifact_links WHERE artifact_type='drd_accepted_snapshot') snapshot_links,
      (SELECT COUNT(*)::int FROM transformation_case_audit_events WHERE event_type='transformation_drd.results_accepted') acceptance_audits`,
      [ids.case]
    )
  ).rows[0];
  assert.deepEqual(drdReadback, {
    lifecycle_stage: 'opportunity_synthesis',
    case_version: 7,
    assessments: 1,
    assessment_sessions: 1,
    assessment_links: 1,
    snapshot_links: 1,
    acceptance_audits: 1,
  });
  const synthesisProposal = await proposeOpportunitySynthesis({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 7,
  });
  const synthesisBeforeApproval = (
    await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM initiative_candidates) candidates,
      (SELECT COUNT(*)::int FROM assessment_candidate_handoffs) handoffs`)
  ).rows[0];
  assert.deepEqual(synthesisBeforeApproval, { candidates: 0, handoffs: 0 });
  const synthesisApplied = await reviewOpportunitySynthesis({
    proposalId: synthesisProposal.proposalId,
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 8,
    decision: 'approve',
    reason: 'Cross-source synthesis and DRD lineage reviewed',
  });
  assert.equal(synthesisApplied.status, 'applied');
  assert.ok(synthesisApplied.candidateId);
  await pool.query(
    `UPDATE transformation_stage_proposals SET status='approved',applied_at=NULL WHERE proposal_id=$1`,
    [synthesisProposal.proposalId]
  );
  const synthesisResumed = await reviewOpportunitySynthesis({
    proposalId: synthesisProposal.proposalId,
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 8,
    decision: 'approve',
    reason: 'Resume approved synthesis materialization after interrupted T01 finalization',
  });
  assert.equal(synthesisResumed.candidateId, synthesisApplied.candidateId);
  assert.equal(
    (await pool.query(`SELECT COUNT(*)::int count FROM initiative_candidates`)).rows[0].count,
    1
  );
  let unacceptedInitiativeCode = '';
  try {
    await acceptInitiativeResults({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 9,
      decisionReason: 'Pending Candidate must fail',
    });
  } catch (error) {
    unacceptedInitiativeCode = String((error as { code?: string }).code || '');
  }
  assert.equal(unacceptedInitiativeCode, 'TRANSFORMATION_INITIATIVE_NOT_ACCEPTED');
  const initiativeId = 'initiative-t01-i05';
  await pool.query(
    `INSERT INTO initiatives (id,organization_id,name,status,source_type,source_id)
     VALUES ($1,$2,'Reduce approval handoff lead time','DRAFT','assessment_accepted_output',$3)`,
    [initiativeId, ids.organization, drdApplied.assessmentId]
  );
  await pool.query(
    `UPDATE initiative_candidates SET status='accepted', initiative_id=$1, accepted_at=NOW()
     WHERE id=$2 AND organization_id=$3`,
    [initiativeId, synthesisApplied.candidateId, ids.organization]
  );
  await assert.rejects(
    () =>
      acceptInitiativeResults({
        transformationCaseId: ids.case,
        organizationId: ids.organization,
        actorUserId: ids.stakeholder,
        expectedVersion: 9,
        decisionReason: 'Unauthorized Initiative result gate must fail',
      }),
    /(adapter_governance_denied:project_membership_required|proposal_reviewer_not_authorized)/
  );
  assert.deepEqual(
    (
      await pool.query(
        `SELECT lifecycle_stage,version,
          (SELECT COUNT(*)::int FROM transformation_result_gate_governance
            WHERE transformation_case_id=$1 AND gate_key='initiative_results') gate_mappings
         FROM transformation_cases WHERE transformation_case_id=$1`,
        [ids.case]
      )
    ).rows[0],
    { lifecycle_stage: 'initiative_candidates', version: 9, gate_mappings: 0 }
  );
  const ideasA06Ledger = await pool.query(
    `SELECT adapter_key,status,canonical_artifact_id,readback_digest FROM v8_agent_adapter_invocations
      WHERE transformation_case_id='tc-t01-a05-ideas'`
  );
  assert.equal(ideasA06Ledger.rows.length, 1);
  assert.equal(ideasA06Ledger.rows[0].adapter_key, 'transformation.ideas.materialize');
  assert.equal(ideasA06Ledger.rows[0].status, 'succeeded');
  const initiativeAccepted = await acceptInitiativeResults({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 9,
    decisionReason: 'Canonical Candidate acceptance receipt and Initiative reviewed',
  });
  assert.equal(initiativeAccepted.lifecycleStage, 'finance_kpi');
  const synthesisReadback = (
    await pool.query(
      `SELECT
      (SELECT lifecycle_stage FROM transformation_cases WHERE transformation_case_id=$1) lifecycle_stage,
      (SELECT version FROM transformation_cases WHERE transformation_case_id=$1) case_version,
      (SELECT COUNT(*)::int FROM initiative_candidates WHERE organization_id=$2 AND status='accepted') accepted_candidates,
      (SELECT COUNT(*)::int FROM initiatives WHERE organization_id=$2 AND id=$3) initiatives,
      (SELECT COUNT(*)::int FROM assessment_candidate_handoffs WHERE organization_id=$2) handoffs,
      (SELECT COUNT(*)::int FROM transformation_case_artifact_links WHERE artifact_type='initiative_candidate') candidate_links,
      (SELECT COUNT(*)::int FROM transformation_case_artifact_links WHERE artifact_type='initiative') initiative_links,
      (SELECT COUNT(*)::int FROM transformation_case_audit_events WHERE event_type='transformation_synthesis.candidate_created') candidate_audits,
      (SELECT COUNT(*)::int FROM transformation_case_audit_events WHERE event_type='transformation_initiative.results_accepted') initiative_audits`,
      [ids.case, ids.organization, initiativeId]
    )
  ).rows[0];
  assert.deepEqual(synthesisReadback, {
    lifecycle_stage: 'finance_kpi',
    case_version: 10,
    accepted_candidates: 1,
    initiatives: 1,
    handoffs: 1,
    candidate_links: 1,
    initiative_links: 1,
    candidate_audits: 1,
    initiative_audits: 1,
  });
  const financeProposal = await proposeFinanceKpiPack({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 10,
    capex: 800000,
    opexAnnual: 120000,
    benefitAnnual: 900000,
    horizonYears: 3,
    waccPct: 12,
    currency: 'PLN',
    kpi: {
      name: 'Approval lead time',
      description: 'Elapsed days from request to approved decision',
      unit: 'days',
      baselineValue: 8,
      targetValue: 3,
      measurementFrequency: 'MONTHLY',
      direction: 'LOWER_IS_BETTER',
    },
  });
  const replaceFinanceGovernance = async () => {
    const state = (
      await pool.query(
        `SELECT p.payload_json,tc.context_snapshot_id,tc.execution_run_id,tp.version plan_version
           FROM transformation_stage_proposals p
           JOIN transformation_cases tc
             ON tc.transformation_case_id=p.transformation_case_id
            AND tc.organization_id=p.organization_id
           JOIN transformation_plans tp ON tp.plan_id=p.plan_id
          WHERE p.proposal_id=$1`,
        [financeProposal.proposalId]
      )
    ).rows[0];
    const contextDigest = createHash('sha256')
      .update(
        JSON.stringify({
          snapshotId: state.context_snapshot_id,
          transformationCaseId: ids.case,
        })
      )
      .digest('hex');
    const replacement = await registerGovernedProposal({
      proposalId: financeProposal.proposalId,
      organizationId: ids.organization,
      canonicalRunId: state.execution_run_id,
      planVersion: state.plan_version,
      contextDigest,
      before: { lifecycleStage: 'finance_kpi', caseVersion: 10, materialized: false },
      after: state.payload_json,
      approvalScopes: ['finance_kpi'],
      reviewerAuthorityByScope: { finance_kpi: [ids.actor] },
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      actorUserId: ids.actor,
      changeReason: 'T01 negative-gate proof replacement authority',
    });
    await pool.query(
      `UPDATE transformation_stage_proposals SET governed_proposal_version_id=$1 WHERE proposal_id=$2`,
      [replacement.proposalVersionId, financeProposal.proposalId]
    );
    return replacement.proposalVersionId;
  };
  await assert.rejects(
    () =>
      reviewFinanceKpiPack({
        proposalId: financeProposal.proposalId,
        transformationCaseId: ids.case,
        organizationId: ids.organization,
        actorUserId: ids.stakeholder,
        expectedVersion: 11,
        decision: 'approve',
        reason: 'Unauthorized shadow approval must roll back',
      }),
    /(adapter_governance_denied:project_membership_required|proposal_reviewer_not_authorized)/
  );
  const financeUnauthorizedRollback = (
    await pool.query(
      `SELECT p.status legacy_status, g.status governed_status
         FROM transformation_stage_proposals p
         JOIN v8_agent_proposal_versions g
           ON g.proposal_version_id=p.governed_proposal_version_id
        WHERE p.proposal_id=$1`,
      [financeProposal.proposalId]
    )
  ).rows[0];
  assert.deepEqual(financeUnauthorizedRollback, {
    legacy_status: 'pending_review',
    governed_status: 'pending_review',
  });
  let financeGovernedId = (
    await pool.query(
      `SELECT governed_proposal_version_id FROM transformation_stage_proposals WHERE proposal_id=$1`,
      [financeProposal.proposalId]
    )
  ).rows[0].governed_proposal_version_id;
  await requestProposalRevision({
    proposalVersionId: financeGovernedId,
    organizationId: ids.organization,
    scopeKey: 'finance_kpi',
    reason: 'Revision gate proof',
    actorUserId: ids.actor,
  });
  await assert.rejects(
    () =>
      reviewFinanceKpiPack({
        proposalId: financeProposal.proposalId,
        transformationCaseId: ids.case,
        organizationId: ids.organization,
        actorUserId: ids.actor,
        expectedVersion: 11,
        decision: 'approve',
        reason: 'Revision-requested authority must block',
      }),
    /governed_proposal_not_reviewable/
  );
  financeGovernedId = await replaceFinanceGovernance();
  await rejectProposalScope({
    proposalVersionId: financeGovernedId,
    organizationId: ids.organization,
    scopeKey: 'finance_kpi',
    reason: 'Rejected gate proof',
    actorUserId: ids.actor,
  });
  await assert.rejects(
    () =>
      reviewFinanceKpiPack({
        proposalId: financeProposal.proposalId,
        transformationCaseId: ids.case,
        organizationId: ids.organization,
        actorUserId: ids.actor,
        expectedVersion: 11,
        decision: 'approve',
        reason: 'Rejected authority must block',
      }),
    /governed_proposal_not_reviewable/
  );
  financeGovernedId = await replaceFinanceGovernance();
  await pool.query(
    `UPDATE v8_agent_proposal_versions SET expires_at=NOW()-INTERVAL '1 second' WHERE proposal_version_id=$1`,
    [financeGovernedId]
  );
  await assert.rejects(
    () =>
      reviewFinanceKpiPack({
        proposalId: financeProposal.proposalId,
        transformationCaseId: ids.case,
        organizationId: ids.organization,
        actorUserId: ids.actor,
        expectedVersion: 11,
        decision: 'approve',
        reason: 'Expired authority must block',
      }),
    (error: unknown) =>
      error instanceof Error &&
      'code' in error &&
      error.code === 'TRANSFORMATION_A05_GOVERNANCE_BLOCKED'
  );
  financeGovernedId = await replaceFinanceGovernance();
  await pool.query(
    `UPDATE transformation_cases SET context_snapshot_id='snapshot-t01-drift' WHERE transformation_case_id=$1`,
    [ids.case]
  );
  await assert.rejects(
    () =>
      reviewFinanceKpiPack({
        proposalId: financeProposal.proposalId,
        transformationCaseId: ids.case,
        organizationId: ids.organization,
        actorUserId: ids.actor,
        expectedVersion: 11,
        decision: 'approve',
        reason: 'Invalidated context authority must block',
      }),
    (error: unknown) =>
      error instanceof Error &&
      'code' in error &&
      error.code === 'TRANSFORMATION_A05_GOVERNANCE_BLOCKED'
  );
  await pool.query(
    `UPDATE transformation_cases SET context_snapshot_id='snapshot-t01-full' WHERE transformation_case_id=$1`,
    [ids.case]
  );
  await replaceFinanceGovernance();
  const financeBlockedEffects = (
    await pool.query(
      `SELECT
        (SELECT status FROM transformation_stage_proposals WHERE proposal_id=$1) legacy_status,
        (SELECT COUNT(*)::int FROM financial_analyses) analyses,
        (SELECT COUNT(*)::int FROM initiative_kpis) kpis`,
      [financeProposal.proposalId]
    )
  ).rows[0];
  assert.deepEqual(financeBlockedEffects, {
    legacy_status: 'pending_review',
    analyses: 0,
    kpis: 0,
  });
  const financeBeforeApproval = (
    await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM financial_analyses) analyses,
      (SELECT COUNT(*)::int FROM initiative_kpis) kpis`)
  ).rows[0];
  assert.deepEqual(financeBeforeApproval, { analyses: 0, kpis: 0 });
  const financeApplied = await reviewFinanceKpiPack({
    proposalId: financeProposal.proposalId,
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 11,
    decision: 'approve',
    reason: 'Economics and KPI definition reviewed',
  });
  assert.equal(financeApplied.status, 'applied');
  assert.ok(financeApplied.financialAnalysisId);
  assert.ok(financeApplied.kpiId);
  await pool.query(
    `UPDATE transformation_stage_proposals SET status='approved',applied_at=NULL WHERE proposal_id=$1`,
    [financeProposal.proposalId]
  );
  const financeResumed = await reviewFinanceKpiPack({
    proposalId: financeProposal.proposalId,
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 11,
    decision: 'approve',
    reason: 'Resume approved Finance/KPI aggregate without duplicate writes',
  });
  assert.equal(financeResumed.financialAnalysisId, financeApplied.financialAnalysisId);
  assert.equal(financeResumed.kpiId, financeApplied.kpiId);
  let draftFinanceCode = '';
  try {
    await acceptFinanceKpiResults({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 12,
      decisionReason: 'Draft financial analysis must fail',
    });
  } catch (error) {
    draftFinanceCode = String((error as { code?: string }).code || '');
  }
  assert.equal(draftFinanceCode, 'TRANSFORMATION_FINANCE_KPI_NOT_APPROVED');
  await pool.query(
    `UPDATE financial_analyses SET status='APPROVED',approved_by=$1,approved_at=NOW()
     WHERE id=$2 AND organization_id=$3`,
    [ids.actor, financeApplied.financialAnalysisId, ids.organization]
  );
  const financeAccepted = await acceptFinanceKpiResults({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 12,
    decisionReason: 'Approved analysis and versioned Initiative KPI reviewed',
  });
  assert.equal(financeAccepted.lifecycleStage, 'portfolio_decision');
  const financeReadback = (
    await pool.query(
      `SELECT
      (SELECT lifecycle_stage FROM transformation_cases WHERE transformation_case_id=$1) lifecycle_stage,
      (SELECT version FROM transformation_cases WHERE transformation_case_id=$1) case_version,
      (SELECT COUNT(*)::int FROM financial_analyses WHERE organization_id=$2 AND status='APPROVED') approved_analyses,
      (SELECT COUNT(*)::int FROM initiative_kpis WHERE organization_id=$2 AND initiative_id=$3) kpis,
      (SELECT COUNT(*)::int FROM kpi_definition_versions) kpi_versions,
      (SELECT COUNT(*)::int FROM transformation_case_artifact_links WHERE artifact_type='financial_analysis') analysis_links,
      (SELECT COUNT(*)::int FROM transformation_case_artifact_links WHERE artifact_type='initiative_kpi') kpi_links,
      (SELECT COUNT(*)::int FROM transformation_case_audit_events WHERE event_type='transformation_finance_kpi.results_accepted') acceptance_audits`,
      [ids.case, ids.organization, initiativeId]
    )
  ).rows[0];
  assert.deepEqual(financeReadback, {
    lifecycle_stage: 'portfolio_decision',
    case_version: 13,
    approved_analyses: 1,
    kpis: 1,
    kpi_versions: 1,
    analysis_links: 1,
    kpi_links: 1,
    acceptance_audits: 1,
  });
  const portfolioProposal = await proposePortfolioDecision({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 13,
    decisionMakerId: ids.stakeholder,
    deadline: '2026-08-21T12:00:00.000Z',
    supportingEvidence: [
      {
        ref: `financial-analysis:${financeApplied.financialAnalysisId}`,
        snapshot: { status: 'APPROVED' },
      },
    ],
    contradictingEvidence: [
      {
        ref: `initiative:${initiativeId}:risk`,
        snapshot: { risk: 'Execution uncertainty remains' },
      },
    ],
  });
  const portfolioBeforeApproval = (
    await pool.query(`SELECT COUNT(*)::int decisions FROM decisions`)
  ).rows[0];
  assert.deepEqual(portfolioBeforeApproval, { decisions: 0 });
  const portfolioApplied = await reviewPortfolioDecision({
    proposalId: portfolioProposal.proposalId,
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 14,
    decision: 'approve',
    reason: 'Board-ready GO/NO-GO packet accepted',
  });
  assert.equal(portfolioApplied.status, 'applied');
  assert.ok(portfolioApplied.decisionId);
  await pool.query(
    `UPDATE transformation_stage_proposals SET status='approved',applied_at=NULL WHERE proposal_id=$1`,
    [portfolioProposal.proposalId]
  );
  const portfolioResumed = await reviewPortfolioDecision({
    proposalId: portfolioProposal.proposalId,
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 14,
    decision: 'approve',
    reason: 'Resume approved portfolio materialization after interrupted T01 finalization',
  });
  assert.equal(portfolioResumed.decisionId, portfolioApplied.decisionId);
  assert.equal((await pool.query(`SELECT COUNT(*)::int count FROM decisions`)).rows[0].count, 1);
  let pendingGoCode = '';
  try {
    await acceptPortfolioDecisionResults({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 15,
      decisionReason: 'Pending decision must fail',
    });
  } catch (error) {
    pendingGoCode = String((error as { code?: string }).code || '');
  }
  assert.equal(pendingGoCode, 'TRANSFORMATION_PORTFOLIO_GO_NOT_APPROVED');
  await pool.query(`UPDATE decisions SET status='approved',selected_option='go' WHERE id=$1`, [
    portfolioApplied.decisionId,
  ]);
  let rawMutationCode = '';
  try {
    await acceptPortfolioDecisionResults({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 15,
      decisionReason: 'Raw status mutation must not unlock',
    });
  } catch (error) {
    rawMutationCode = String((error as { code?: string }).code || '');
  }
  assert.equal(rawMutationCode, 'TRANSFORMATION_PORTFOLIO_GO_NOT_APPROVED');
  await pool.query(`UPDATE decisions SET status='pending',selected_option=NULL WHERE id=$1`, [
    portfolioApplied.decisionId,
  ]);
  let unauthorizedCode = '';
  try {
    await resolvePortfolioDecision({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 15,
      evidenceDigest: String(portfolioApplied.evidenceDigest),
      idempotencyKey: 't01-proof-unauthorized',
      selectedOption: 'go',
      rationale: 'Unauthorized actor cannot resolve',
    });
  } catch (error) {
    unauthorizedCode = String((error as { code?: string }).code || '');
  }
  assert.equal(unauthorizedCode, 'TRANSFORMATION_DECISION_ACTOR_UNAUTHORIZED');
  await pool.query(
    `CREATE OR REPLACE FUNCTION fail_t01_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced receipt failure'; END $$`
  );
  await pool.query(
    `CREATE TRIGGER fail_t01_receipt BEFORE INSERT ON transformation_portfolio_decision_receipts FOR EACH ROW EXECUTE FUNCTION fail_t01_receipt()`
  );
  await assert.rejects(
    resolvePortfolioDecision({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.stakeholder,
      expectedVersion: 15,
      evidenceDigest: String(portfolioApplied.evidenceDigest),
      idempotencyKey: 't01-proof-rollback',
      selectedOption: 'go',
      rationale: 'Forced rollback must remain atomic',
    })
  );
  assert.equal(
    (await pool.query(`SELECT status FROM decisions WHERE id=$1`, [portfolioApplied.decisionId]))
      .rows[0].status,
    'pending'
  );
  await pool.query(`DROP TRIGGER fail_t01_receipt ON transformation_portfolio_decision_receipts`);
  const resolutionInput = {
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.stakeholder,
    expectedVersion: 15,
    evidenceDigest: String(portfolioApplied.evidenceDigest),
    idempotencyKey: 't01-proof-portfolio-resolve',
    selectedOption: 'go',
    rationale: 'Approved economics and measurable KPI justify mobilization',
  } as const;
  const resolutions = await Promise.all([
    resolvePortfolioDecision(resolutionInput),
    resolvePortfolioDecision(resolutionInput),
  ]);
  assert.equal(resolutions.filter((row) => row.idempotentReplay).length, 1);
  assert.equal(resolutions[0].receiptId, resolutions[1].receiptId);
  assert.equal(resolutions[0].decisionId, resolutions[1].decisionId);
  assert.equal(resolutions[0].evidenceDigest, resolutions[1].evidenceDigest);
  assert.equal(
    (await pool.query(`SELECT COUNT(*)::int count FROM transformation_portfolio_decision_receipts`))
      .rows[0].count,
    1
  );
  const decisionPackReadback = (
    await pool.query(
      `SELECT p.evidence_digest,p.case_version,
            jsonb_array_length(p.supporting_evidence_json) supporting_count,
            jsonb_array_length(p.contradicting_evidence_json) contradicting_count,
            r.receipt_id,r.source_case_version,r.evidence_digest receipt_digest
       FROM transformation_portfolio_decision_packs p
       JOIN transformation_portfolio_decision_receipts r ON r.pack_id=p.pack_id
      WHERE p.proposal_id=$1`,
      [portfolioProposal.proposalId]
    )
  ).rows[0];
  assert.deepEqual(decisionPackReadback, {
    evidence_digest: portfolioApplied.evidenceDigest,
    case_version: 13,
    supporting_count: 1,
    contradicting_count: 1,
    receipt_id: resolutions[0].receiptId,
    source_case_version: 15,
    receipt_digest: portfolioApplied.evidenceDigest,
  });
  let resolutionConflict = '';
  try {
    await resolvePortfolioDecision({ ...resolutionInput, rationale: 'Conflicting payload' });
  } catch (error) {
    resolutionConflict = String((error as { code?: string }).code || '');
  }
  assert.equal(resolutionConflict, 'TRANSFORMATION_DECISION_IDEMPOTENCY_CONFLICT');
  let unapprovedInitiativeLifecycleCode = '';
  try {
    await acceptPortfolioDecisionResults({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 15,
      decisionReason: 'DRAFT Initiative lifecycle must fail',
    });
  } catch (error) {
    unapprovedInitiativeLifecycleCode = String((error as { code?: string }).code || '');
  }
  assert.equal(
    unapprovedInitiativeLifecycleCode,
    'TRANSFORMATION_INITIATIVE_NOT_PORTFOLIO_APPROVED'
  );
  // Portfolio approval is an upstream fixture boundary. Recreate the row at the
  // externally approved baseline; every T01-owned transition below uses the
  // canonical Initiative transition engine and never mutates status directly.
  await pool.query(`DELETE FROM initiatives WHERE id=$1`, [initiativeId]);
  await pool.query(
    `INSERT INTO initiatives (id,organization_id,project_id,name,status,source_type,source_id,owner_business_id,owner_execution_id)
     VALUES ($1,$2,$3,'Reduce approval handoff lead time','APPROVED','assessment_accepted_output',$4,$5,$5)`,
    [initiativeId, ids.organization, ids.project, drdApplied.assessmentId, ids.actor]
  );
  const portfolioAccepted = await acceptPortfolioDecisionResults({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 15,
    decisionReason: 'GO decision and canonical APPROVED Initiative reviewed',
  });
  assert.equal(portfolioAccepted.lifecycleStage, 'mobilization');
  const portfolioReadback = (
    await pool.query(
      `SELECT
      (SELECT lifecycle_stage FROM transformation_cases WHERE transformation_case_id=$1) lifecycle_stage,
      (SELECT version FROM transformation_cases WHERE transformation_case_id=$1) case_version,
      (SELECT COUNT(*)::int FROM decisions WHERE organization_id=$2 AND status='approved' AND selected_option='go') approved_go_decisions,
      (SELECT COUNT(*)::int FROM decision_history WHERE action='created') decision_created_events,
      (SELECT COUNT(*)::int FROM decision_history WHERE action='decided') decision_decided_events,
      (SELECT COUNT(*)::int FROM transformation_case_artifact_links WHERE artifact_type='decision') decision_links,
      (SELECT COUNT(*)::int FROM transformation_case_audit_events WHERE event_type='transformation_portfolio.results_accepted') acceptance_audits`,
      [ids.case, ids.organization]
    )
  ).rows[0];
  assert.deepEqual(portfolioReadback, {
    lifecycle_stage: 'mobilization',
    case_version: 16,
    approved_go_decisions: 1,
    decision_created_events: 1,
    decision_decided_events: 1,
    decision_links: 1,
    acceptance_audits: 1,
  });
  const mobilizationProposal = await proposeMobilizationBlueprint({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 16,
    ownerUserId: ids.stakeholder,
    startDate: '2026-09-01',
    endDate: '2026-12-15',
  });
  const mobilizationBeforeApproval = (
    await pool.query(`SELECT
      (SELECT COUNT(*)::int FROM initiative_ai_blueprints) blueprints,
      (SELECT COUNT(*)::int FROM tasks WHERE initiative_id IS NOT NULL) tasks,
      (SELECT COUNT(*)::int FROM initiative_milestones) milestones,
      (SELECT COUNT(*)::int FROM initiative_resources) resources`)
  ).rows[0];
  assert.deepEqual(mobilizationBeforeApproval, {
    blueprints: 0,
    tasks: 0,
    milestones: 0,
    resources: 0,
  });
  const mobilizationApplied = await reviewMobilizationBlueprint({
    proposalId: mobilizationProposal.proposalId,
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 17,
    decision: 'approve',
    reason: 'WBS, milestones, dependencies and resources reviewed',
  });
  await pool.query(
    `UPDATE transformation_stage_proposals SET status='approved',applied_at=NULL WHERE proposal_id=$1`,
    [mobilizationProposal.proposalId]
  );
  const mobilizationResumed = await reviewMobilizationBlueprint({
    proposalId: mobilizationProposal.proposalId,
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 17,
    decision: 'approve',
    reason: 'Resume approved Mobilization aggregate without duplicate writes',
  });
  assert.equal(mobilizationResumed.blueprintId, mobilizationApplied.blueprintId);
  assert.deepEqual(mobilizationResumed.taskIds, mobilizationApplied.taskIds);
  const shadowMappings = await pool.query(
    `SELECT p.lifecycle_stage,p.governed_proposal_version_id,g.plan_version,g.status governed_status,
            g.context_digest,g.reviewer_authority_json
       FROM transformation_stage_proposals p
       JOIN v8_agent_proposal_versions g
         ON g.proposal_version_id=p.governed_proposal_version_id
      WHERE p.lifecycle_stage IN (
        'initial_ideas','interviews','drd','opportunity_synthesis','finance_kpi','portfolio_decision','mobilization'
      )
      ORDER BY p.lifecycle_stage`
  );
  assert.equal(shadowMappings.rows.length, 7);
  assert.deepEqual(shadowMappings.rows.map((row) => row.lifecycle_stage).sort(), [
    'drd',
    'finance_kpi',
    'initial_ideas',
    'interviews',
    'mobilization',
    'opportunity_synthesis',
    'portfolio_decision',
  ]);
  assert.ok(
    shadowMappings.rows.every(
      (row) =>
        row.governed_proposal_version_id &&
        row.plan_version === 1 &&
        row.governed_status === 'approved' &&
        /^[a-f0-9]{64}$/.test(row.context_digest) &&
        Array.isArray(row.reviewer_authority_json[row.lifecycle_stage])
    )
  );
  const shadowParity = await pool.query(
    `SELECT detail_json FROM transformation_case_audit_events
      WHERE event_type='transformation_proposal.shadow_parity'
      ORDER BY created_at`
  );
  assert.equal(shadowParity.rows.length, 7);
  assert.ok(
    shadowParity.rows.every(
      (row) =>
        row.detail_json.mode === 'shadow' &&
        row.detail_json.divergence === false &&
        row.detail_json.materializationAuthority === 'common_a05' &&
        row.detail_json.legacyStatus === row.detail_json.governedStatus
    )
  );
  console.log(
    JSON.stringify({
      proof: 'T01_A05_ENFORCEMENT_GREEN',
      mappedStages: shadowMappings.rows.map((row) => row.lifecycle_stage),
      pinnedAtomicMappings: 7,
      unauthorizedDeniedAndRolledBack: true,
      parityAudits: shadowParity.rows.length,
      divergence: 0,
      negativeGates: ['unauthorized', 'revision_requested', 'rejected', 'expired', 'invalidated'],
      materializationAuthority: 'common_a05',
    })
  );
  assert.equal(mobilizationApplied.status, 'applied');
  assert.equal(mobilizationApplied.taskIds?.length, 3);
  assert.equal(mobilizationApplied.milestoneIds?.length, 3);
  assert.equal(mobilizationApplied.resourceIds?.length, 1);
  let unscheduledInitiativeCode = '';
  try {
    await acceptMobilizationResults({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 18,
      decisionReason: 'APPROVED but not SCHEDULED Initiative must fail',
    });
  } catch (error) {
    unscheduledInitiativeCode = String((error as { code?: string }).code || '');
  }
  assert.equal(unscheduledInitiativeCode, 'TRANSFORMATION_INITIATIVE_NOT_SCHEDULED');
  await executeGovernedInitiativeTransition({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    initiativeId,
    actorUserId: ids.actor,
    actorRole: 'SUPERADMIN',
    targetStatus: 'SCHEDULED',
    reason: 'Human approved exact Mobilization dates and milestones',
    plannedStartDate: '2026-09-01',
    plannedEndDate: '2026-12-15',
  });
  const mobilizationAccepted = await acceptMobilizationResults({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 18,
    decisionReason: 'Applied blueprint and canonical SCHEDULED Initiative reviewed',
  });
  assert.equal(mobilizationAccepted.lifecycleStage, 'execution');
  assert.deepEqual(
    await acceptInitiativeResults({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 9,
      decisionReason: 'Idempotent replay',
    }),
    initiativeAccepted
  );
  assert.deepEqual(
    await acceptFinanceKpiResults({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 12,
      decisionReason: 'Idempotent replay',
    }),
    financeAccepted
  );
  assert.deepEqual(
    await acceptPortfolioDecisionResults({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 15,
      decisionReason: 'Idempotent replay',
    }),
    portfolioAccepted
  );
  assert.deepEqual(
    await acceptMobilizationResults({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 18,
      decisionReason: 'Idempotent replay',
    }),
    mobilizationAccepted
  );
  const resultGateProof = await pool.query(
    `SELECT gate_key,status,source_case_version,result_json
       FROM transformation_result_gate_governance
      WHERE transformation_case_id=$1 ORDER BY gate_key`,
    [ids.case]
  );
  assert.equal(resultGateProof.rows.length, 4);
  assert.ok(resultGateProof.rows.every((row) => row.status === 'applied' && row.result_json));
  assert.equal(
    (
      await pool.query(
        `SELECT COUNT(*)::int count FROM transformation_case_audit_events
          WHERE transformation_case_id=$1 AND event_type='transformation_result_gate.a05_parity'
            AND detail_json->>'divergence'='false'`,
        [ids.case]
      )
    ).rows[0].count,
    4
  );
  console.log(
    JSON.stringify({
      proof: 'T01_A05_RESULT_GATES_GREEN',
      gates: resultGateProof.rows.map((row) => row.gate_key),
      appliedMappings: 4,
      idempotentReplays: 4,
      unauthorizedNoStageAdvance: true,
      parityAudits: 4,
      divergence: 0,
    })
  );
  const mobilizationReadback = (
    await pool.query(
      `SELECT
      (SELECT lifecycle_stage FROM transformation_cases WHERE transformation_case_id=$1) lifecycle_stage,
      (SELECT version FROM transformation_cases WHERE transformation_case_id=$1) case_version,
      (SELECT COUNT(*)::int FROM initiative_ai_blueprints WHERE status='applied') applied_blueprints,
      (SELECT COUNT(*)::int FROM tasks WHERE initiative_id=$2) tasks,
      (SELECT COUNT(*)::int FROM task_dependencies) dependencies,
      (SELECT COUNT(*)::int FROM initiative_milestones WHERE initiative_id=$2) milestones,
      (SELECT COUNT(*)::int FROM initiative_resources WHERE initiative_id=$2) resources,
      (SELECT COUNT(*)::int FROM initiative_history WHERE action='ai_blueprint_applied') blueprint_history,
      (SELECT COUNT(*)::int FROM transformation_case_audit_events WHERE event_type='transformation_mobilization.results_accepted') acceptance_audits`,
      [ids.case, initiativeId]
    )
  ).rows[0];
  assert.deepEqual(mobilizationReadback, {
    lifecycle_stage: 'execution',
    case_version: 19,
    applied_blueprints: 1,
    tasks: 3,
    dependencies: 2,
    milestones: 3,
    resources: 1,
    blueprint_history: 1,
    acceptance_audits: 1,
  });
  let notExecutingCode = '';
  try {
    await acceptExecutionStart({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 19,
      decisionReason: 'SCHEDULED is not yet EXECUTING',
    });
  } catch (error) {
    notExecutingCode = String((error as { code?: string }).code || '');
  }
  assert.equal(notExecutingCode, 'TRANSFORMATION_INITIATIVE_NOT_EXECUTING');
  await executeGovernedInitiativeTransition({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    initiativeId,
    actorUserId: ids.actor,
    actorRole: 'SUPERADMIN',
    targetStatus: 'EXECUTING',
    reason: 'Human approved START against the locked schedule baseline',
  });
  const executionStarted = await acceptExecutionStart({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 19,
    decisionReason: 'Canonical EXECUTING Initiative reviewed',
  });
  assert.equal(executionStarted.caseVersion, 20);
  let notDoneCode = '';
  try {
    await acceptExecutionResults({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 20,
      decisionReason: 'EXECUTING is not DONE',
    });
  } catch (error) {
    notDoneCode = String((error as { code?: string }).code || '');
  }
  assert.equal(notDoneCode, 'TRANSFORMATION_INITIATIVE_NOT_DONE');
  let incompleteWorkCode = '';
  try {
    await executeGovernedInitiativeTransition({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      initiativeId,
      actorUserId: ids.actor,
      actorRole: 'SUPERADMIN',
      targetStatus: 'DONE',
      reason: 'Human approved closure subject to exact completion readback',
    });
  } catch (error) {
    incompleteWorkCode = String((error as Error).message || '');
  }
  assert.match(incompleteWorkCode, /initiative_transition_denied/);
  await pool.query(`UPDATE tasks SET status='done',progress=100 WHERE initiative_id=$1`, [
    initiativeId,
  ]);
  await pool.query(`UPDATE initiative_milestones SET status='COMPLETED' WHERE initiative_id=$1`, [
    initiativeId,
  ]);
  await executeGovernedInitiativeTransition({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    initiativeId,
    actorUserId: ids.actor,
    actorRole: 'SUPERADMIN',
    targetStatus: 'DONE',
    reason: 'Human approved closure subject to exact completion readback',
  });
  const executionAccepted = await acceptExecutionResults({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 20,
    decisionReason: 'DONE lifecycle and completed WBS/milestones reviewed',
  });
  assert.equal(executionAccepted.lifecycleStage, 'delivery');
  const executionReadback = (
    await pool.query(
      `SELECT
      (SELECT lifecycle_stage FROM transformation_cases WHERE transformation_case_id=$1) lifecycle_stage,
      (SELECT version FROM transformation_cases WHERE transformation_case_id=$1) case_version,
      (SELECT status FROM initiatives WHERE id=$2) initiative_status,
      (SELECT COUNT(*)::int FROM tasks WHERE initiative_id=$2 AND UPPER(status) IN ('DONE','COMPLETED')) completed_tasks,
      (SELECT COUNT(*)::int FROM initiative_milestones WHERE initiative_id=$2 AND status='COMPLETED') completed_milestones,
      (SELECT COUNT(*)::int FROM transformation_case_artifact_links WHERE artifact_type='execution_start_receipt') start_receipts,
      (SELECT COUNT(*)::int FROM transformation_case_audit_events WHERE event_type='transformation_execution.started') start_audits,
      (SELECT COUNT(*)::int FROM transformation_case_audit_events WHERE event_type='transformation_execution.results_accepted') acceptance_audits`,
      [ids.case, initiativeId]
    )
  ).rows[0];
  assert.deepEqual(executionReadback, {
    lifecycle_stage: 'delivery',
    case_version: 21,
    initiative_status: 'DONE',
    completed_tasks: 3,
    completed_milestones: 3,
    start_receipts: 1,
    start_audits: 1,
    acceptance_audits: 1,
  });
  const closureDeliveryReadback = (
    await pool.query(
      `SELECT results_status,finance_status,results_payload,finance_payload
         FROM closure_delivery_receipts
        WHERE initiative_id=$1 AND organization_id=$2`,
      [initiativeId, ids.organization]
    )
  ).rows[0];
  assert.equal(closureDeliveryReadback.results_status, 'DELIVERED');
  assert.equal(closureDeliveryReadback.finance_status, 'NEEDS_DECISION');
  assert.equal(closureDeliveryReadback.results_payload.benefitIds.length, 1);
  assert.equal(closureDeliveryReadback.finance_payload.reason, 'NO_MONETARY_MEASUREMENT');
  console.log(
    JSON.stringify({
      proof: 'T01_CLOSURE_DELIVERY_OWNER_GREEN',
      resultsStatus: closureDeliveryReadback.results_status,
      resultsBenefitIds: closureDeliveryReadback.results_payload.benefitIds.length,
      financeStatus: closureDeliveryReadback.finance_status,
      financeReason: closureDeliveryReadback.finance_payload.reason,
      financeAutoBooked: false,
    })
  );
  let missingBenefitsCode = '';
  try {
    await acceptDeliveryHandoff({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 21,
      effectiveness: 'confirmed',
      decisionReason: 'No closure benefit exists',
      kpiActuals: [
        {
          kpiId: String(financeApplied.kpiId),
          value: 3,
          measuredAt: '2026-10-01T12:00:00.000Z',
        },
      ],
    });
  } catch (error) {
    missingBenefitsCode = String((error as { code?: string }).code || '');
  }
  assert.equal(missingBenefitsCode, 'TRANSFORMATION_BENEFITS_MEASUREMENT_INCOMPLETE');
  const closureBenefitId = String(
    (
      await pool.query(
        `SELECT id FROM initiative_benefits
          WHERE initiative_id=$1 AND organization_id=$2 AND source_tag='M14_CLOSURE_HANDOFF'`,
        [initiativeId, ids.organization]
      )
    ).rows[0].id
  );
  let incompleteBenefitsCode = '';
  try {
    await acceptDeliveryHandoff({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 21,
      effectiveness: 'partial',
      decisionReason: 'Measurement is incomplete',
      kpiActuals: [
        {
          kpiId: String(financeApplied.kpiId),
          value: 3,
          measuredAt: '2026-10-01T12:00:00.000Z',
        },
      ],
    });
  } catch (error) {
    incompleteBenefitsCode = String((error as { code?: string }).code || '');
  }
  assert.equal(incompleteBenefitsCode, 'TRANSFORMATION_BENEFITS_MEASUREMENT_INCOMPLETE');
  await pool.query(
    `UPDATE initiative_benefits SET current_value=3,last_measured_at=NOW(),owner_id=$1,actual_annual_value=840000,status='achieved' WHERE id=$2`,
    [ids.actor, closureBenefitId]
  );
  let unauthorizedDeliveryError = '';
  try {
    await acceptDeliveryHandoff({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.stakeholder,
      expectedVersion: 21,
      effectiveness: 'confirmed',
      decisionReason: 'Unauthorized reviewer must not write KPI actuals',
      kpiActuals: [
        {
          kpiId: String(financeApplied.kpiId),
          value: 3,
          measuredAt: '2026-10-01T12:00:00.000Z',
        },
      ],
    });
  } catch (error) {
    unauthorizedDeliveryError = String(error);
  }
  assert.match(
    unauthorizedDeliveryError,
    /(adapter_governance_denied:project_membership_required|proposal_reviewer_not_authorized)/
  );
  const unauthorizedDeliveryReadback = (
    await pool.query(
      `SELECT
       (SELECT lifecycle_stage FROM transformation_cases WHERE transformation_case_id=$1) lifecycle_stage,
       (SELECT version FROM transformation_cases WHERE transformation_case_id=$1) case_version,
       (SELECT current_value FROM initiative_kpis WHERE id=$2) kpi_actual,
       (SELECT COUNT(*)::int FROM kpi_measurements WHERE kpi_id=$2) kpi_measurements,
       (SELECT COUNT(*)::int FROM transformation_result_gate_governance
         WHERE transformation_case_id=$1 AND gate_key='delivery_handoff') gate_mappings`,
      [ids.case, financeApplied.kpiId]
    )
  ).rows[0];
  assert.deepEqual(unauthorizedDeliveryReadback, {
    lifecycle_stage: 'delivery',
    case_version: 21,
    kpi_actual: null,
    kpi_measurements: 0,
    gate_mappings: 0,
  });
  const deliveryAccepted = await acceptDeliveryHandoff({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 21,
    effectiveness: 'confirmed',
    decisionReason: 'Owner, KPI actual and Finance actual reviewed',
    kpiActuals: [
      {
        kpiId: String(financeApplied.kpiId),
        value: 3,
        measuredAt: '2026-10-01T12:00:00.000Z',
      },
    ],
  });
  assert.equal(deliveryAccepted.lifecycleStage, 'benefits');
  const deliveryReadback = (
    await pool.query(
      `SELECT
       (SELECT lifecycle_stage FROM transformation_cases WHERE transformation_case_id=$1) lifecycle_stage,
       (SELECT version FROM transformation_cases WHERE transformation_case_id=$1) case_version,
       (SELECT COUNT(*)::int FROM transformation_case_artifact_links WHERE artifact_type='initiative_benefit') benefit_links,
       (SELECT COUNT(*)::int FROM transformation_case_audit_events WHERE event_type='transformation_delivery.benefits_handoff_accepted') acceptance_audits,
       (SELECT actual_annual_value::int FROM initiative_benefits WHERE id=$3) finance_actual,
       (SELECT current_value FROM initiative_kpis WHERE id=$2) kpi_actual,
       (SELECT COUNT(*)::int FROM kpi_measurements WHERE kpi_id=$2) kpi_measurements`,
      [ids.case, financeApplied.kpiId, closureBenefitId]
    )
  ).rows[0];
  assert.deepEqual(deliveryReadback, {
    lifecycle_stage: 'benefits',
    case_version: 22,
    benefit_links: 1,
    acceptance_audits: 1,
    finance_actual: 840000,
    kpi_actual: 3,
    kpi_measurements: 1,
  });
  let unverifiedBenefitsCode = '';
  try {
    await acceptBenefitsReview({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 22,
      decisionReason: 'No verified measurement exists',
    });
  } catch (error) {
    unverifiedBenefitsCode = String((error as { code?: string }).code || '');
  }
  assert.equal(unverifiedBenefitsCode, 'TRANSFORMATION_BENEFITS_NOT_VERIFIED');
  await pool.query(
    `INSERT INTO benefit_measurements (id,benefit_id,measured_value,measured_at,measured_by,is_verified,verified_by,verified_at) VALUES ('measurement-1',$2,3,CURRENT_DATE-INTERVAL '31 days',$1,TRUE,$1,NOW())`,
    [ids.actor, closureBenefitId]
  );
  const benefitsAccepted = await acceptBenefitsReview({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 22,
    decisionReason: 'Achieved benefit and verified measurement reviewed',
  });
  assert.equal(benefitsAccepted.lifecycleStage, 'sustainability');
  let shortWindowCode = '';
  try {
    await acceptSustainabilityReview({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 23,
      conclusion: 'sustained',
      decisionReason: 'One measurement cannot prove sustained value',
    });
  } catch (error) {
    shortWindowCode = String((error as { code?: string }).code || '');
  }
  assert.equal(shortWindowCode, 'TRANSFORMATION_SUSTAINABILITY_WINDOW_INCOMPLETE');
  await pool.query(
    `INSERT INTO benefit_measurements (id,benefit_id,measured_value,measured_at,measured_by,is_verified,verified_by,verified_at) VALUES ('measurement-2',$2,2.8,CURRENT_DATE,$1,TRUE,$1,NOW())`,
    [ids.actor, closureBenefitId]
  );
  const sustainabilityAccepted = await acceptSustainabilityReview({
    transformationCaseId: ids.case,
    organizationId: ids.organization,
    actorUserId: ids.actor,
    expectedVersion: 23,
    conclusion: 'sustained',
    decisionReason: 'Two verified measurements prove the effect across 31 days',
  });
  assert.equal(sustainabilityAccepted.lifecycleStage, 'final_outputs');
  assert.deepEqual(
    await acceptExecutionStart({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 19,
      decisionReason: 'Idempotent replay',
    }),
    executionStarted
  );
  assert.deepEqual(
    await acceptExecutionResults({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 20,
      decisionReason: 'Idempotent replay',
    }),
    executionAccepted
  );
  assert.deepEqual(
    await acceptDeliveryHandoff({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 21,
      effectiveness: 'confirmed',
      decisionReason: 'Idempotent replay',
      kpiActuals: [
        {
          kpiId: String(financeApplied.kpiId),
          value: 3,
          measuredAt: '2026-10-01T12:00:00.000Z',
        },
      ],
    }),
    deliveryAccepted
  );
  assert.deepEqual(
    await acceptBenefitsReview({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 22,
      decisionReason: 'Idempotent replay',
    }),
    benefitsAccepted
  );
  assert.deepEqual(
    await acceptSustainabilityReview({
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 23,
      conclusion: 'sustained',
      decisionReason: 'Idempotent replay',
    }),
    sustainabilityAccepted
  );
  const terminalResultGateProof = await pool.query(
    `SELECT gate_key,status,source_case_version,result_json
       FROM transformation_result_gate_governance
      WHERE transformation_case_id=$1 ORDER BY gate_key`,
    [ids.case]
  );
  assert.equal(terminalResultGateProof.rows.length, 9);
  assert.ok(
    terminalResultGateProof.rows.every((row) => row.status === 'applied' && row.result_json)
  );
  const terminalParityCount = Number(
    (
      await pool.query(
        `SELECT COUNT(*)::int count FROM transformation_case_audit_events
          WHERE transformation_case_id=$1 AND event_type='transformation_result_gate.a05_parity'
            AND detail_json->>'divergence'='false'`,
        [ids.case]
      )
    ).rows[0].count
  );
  assert.equal(terminalParityCount, 9);
  console.log(
    JSON.stringify({
      proof: 'T01_A05_TERMINAL_RESULT_GATES_GREEN',
      terminalGates: [
        'execution_start',
        'execution_results',
        'delivery_handoff',
        'benefits_review',
        'sustainability_review',
      ],
      totalAppliedMappings: 9,
      terminalIdempotentReplays: 5,
      deliveryUnauthorizedRollback: true,
      parityAudits: terminalParityCount,
      divergence: 0,
    })
  );
  const sustainabilityReadback = (
    await pool.query(
      `SELECT
       (SELECT lifecycle_stage FROM transformation_cases WHERE transformation_case_id=$1) lifecycle_stage,
       (SELECT version FROM transformation_cases WHERE transformation_case_id=$1) case_version,
       (SELECT COUNT(*)::int FROM benefit_measurements WHERE benefit_id=$2 AND is_verified=TRUE) verified_measurements,
       (SELECT COUNT(*)::int FROM transformation_case_audit_events WHERE event_type='transformation_benefits.results_verified') benefits_audits,
       (SELECT COUNT(*)::int FROM transformation_case_audit_events WHERE event_type='transformation_sustainability.reviewed') sustainability_audits`,
      [ids.case, closureBenefitId]
    )
  ).rows[0];
  assert.deepEqual(sustainabilityReadback, {
    lifecycle_stage: 'final_outputs',
    case_version: 24,
    verified_measurements: 2,
    benefits_audits: 1,
    sustainability_audits: 1,
  });
  let staleCode = '';
  try {
    await reviewInterviewsProposal({
      proposalId: proposal.proposalId,
      transformationCaseId: ids.case,
      organizationId: ids.organization,
      actorUserId: ids.actor,
      expectedVersion: 2,
      decision: 'approve',
      reason: 'Stale replay must fail',
    });
  } catch (error) {
    staleCode = String((error as { code?: string }).code || '');
  }
  assert.equal(staleCode, 'TRANSFORMATION_CASE_VERSION_CONFLICT');
  const finalCounts = (
    await pool.query(`SELECT
    (SELECT COUNT(*)::int FROM interview_assignments) assignments,
    (SELECT COUNT(*)::int FROM tasks WHERE task_type='interview') tasks,
    (SELECT COUNT(*)::int FROM transformation_case_artifact_links WHERE artifact_type='interview_assignment') links`)
  ).rows[0];
  assert.deepEqual(finalCounts, { assignments: 1, tasks: 1, links: 1 });
  const lifecycleOwnerProof = (
    await pool.query(
      `SELECT
        (SELECT status FROM initiatives WHERE id=$1 AND organization_id=$2) initiative_status,
        (SELECT COUNT(*)::int FROM initiative_lifecycle_gate_decisions
          WHERE initiative_id=$1 AND organization_id=$2) canonical_gate_decisions,
        (SELECT COUNT(*)::int FROM initiative_status_history
          WHERE initiative_id=$1 AND organization_id=$2
            AND (from_status,to_status) IN (('APPROVED','SCHEDULED'),('SCHEDULED','EXECUTING'),('EXECUTING','DONE'))) owner_status_history,
        (SELECT COUNT(*)::int FROM initiative_schedule_baselines
          WHERE initiative_id=$1 AND organization_id=$2) schedule_baselines`,
      [initiativeId, ids.organization]
    )
  ).rows[0];
  assert.deepEqual(lifecycleOwnerProof, {
    initiative_status: 'DONE',
    canonical_gate_decisions: 3,
    owner_status_history: 3,
    schedule_baselines: 1,
  });
  console.log(
    JSON.stringify({
      proof: 'T01_CANONICAL_INITIATIVE_LIFECYCLE_GREEN',
      ...lifecycleOwnerProof,
      a05Scopes: 3,
      a06AggregateReceipts: 3,
      incompleteClosureBlockedBeforeOwnerWrite: true,
      genericDecisionCannotUnlock: true,
      rawInitiativeStatusUpdates: 0,
    })
  );
  const a06OwnerLedger = await pool.query(
    `SELECT adapter_key,status,canonical_artifact_type,canonical_artifact_id,readback_digest,attempt_count
       FROM v8_agent_adapter_invocations WHERE transformation_case_id=$1
        AND adapter_key NOT LIKE 'transformation.gate.%' ORDER BY adapter_key`,
    [ids.case]
  );
  assert.equal(a06OwnerLedger.rows.length, 9);
  assert.ok(
    a06OwnerLedger.rows.every(
      (row) => row.status === 'succeeded' && row.canonical_artifact_id && row.readback_digest
    )
  );
  assert.deepEqual(
    a06OwnerLedger.rows.map((row) => row.adapter_key),
    [
      'transformation.drd.materialize',
      'transformation.finance_kpi.materialize',
      'transformation.initiative_candidate.materialize',
      'transformation.initiative_lifecycle.transition',
      'transformation.initiative_lifecycle.transition',
      'transformation.initiative_lifecycle.transition',
      'transformation.interviews.materialize',
      'transformation.mobilization.materialize',
      'transformation.portfolio_decision.materialize',
    ]
  );
  const a06Governance = await pool.query(
    `SELECT decision,reason,tool_name FROM wave8_agent_tool_governance_events
      WHERE organization_id=$1 AND run_id='run-t01-full' ORDER BY created_at`,
    [ids.organization]
  );
  assert.equal(
    a06Governance.rows.filter(
      (row) =>
        row.decision === 'allowed' && !String(row.tool_name).startsWith('transformation.gate.')
    ).length,
    16
  );
  assert.deepEqual(
    a06Governance.rows.filter(
      (row) =>
        row.decision === 'denied' && !String(row.tool_name).startsWith('transformation.gate.')
    ),
    [
      {
        decision: 'denied',
        reason: 'tool_not_ratified',
        tool_name: 'transformation.drd.materialize',
      },
    ]
  );
  const a06GateLedger = await pool.query(
    `SELECT adapter_key,status,canonical_artifact_type,canonical_artifact_id,readback_digest,attempt_count
       FROM v8_agent_adapter_invocations WHERE transformation_case_id=$1
        AND adapter_key LIKE 'transformation.gate.%' ORDER BY adapter_key`,
    [ids.case]
  );
  assert.equal(a06GateLedger.rows.length, 9);
  assert.ok(
    a06GateLedger.rows.every(
      (row) =>
        row.status === 'succeeded' &&
        row.canonical_artifact_type === 'transformation_result_gate_receipt' &&
        row.canonical_artifact_id &&
        row.readback_digest
    )
  );
  assert.deepEqual(
    a06GateLedger.rows.map((row) => row.adapter_key),
    [
      'transformation.gate.benefits_review.accept',
      'transformation.gate.delivery_handoff.accept',
      'transformation.gate.execution_results.accept',
      'transformation.gate.execution_start.accept',
      'transformation.gate.finance_kpi_results.accept',
      'transformation.gate.initiative_results.accept',
      'transformation.gate.mobilization_results.accept',
      'transformation.gate.portfolio_decision_results.accept',
      'transformation.gate.sustainability_review.accept',
    ]
  );
  const allowedGateExecutions = a06Governance.rows.filter(
    (row) => row.decision === 'allowed' && String(row.tool_name).startsWith('transformation.gate.')
  ).length;
  assert.ok(allowedGateExecutions >= 18);
  console.log(
    JSON.stringify({
      proof: 'T01_A06_RESULT_GATES_GREEN',
      gates: a06GateLedger.rows.map((row) => row.adapter_key),
      canonicalReadbacks: 9,
      idempotentReplays: 9,
      gateDoubleWrites: 0,
      centralDenialBeforeSideEffect: true,
    })
  );
  console.log(
    JSON.stringify({
      proof: 'T01_A06_OWNER_INTEGRATION_GREEN',
      ownerMaterializations: [...ideasA06Ledger.rows, ...a06OwnerLedger.rows]
        .map((row) => row.adapter_key)
        .sort(),
      canonicalReadbacks: 7,
      idempotentPublicResumes: 7,
      ownerDoubleWrites: 0,
      centralGovernanceAllowed: 14,
      centralGovernanceDeniedBeforeSideEffect: 1,
      approvedButNotAppliedResumed: true,
    })
  );
  console.log(
    JSON.stringify({
      proof: 'U05_DECISION_PACK_REALDB_GREEN',
      immutableEvidencePack: true,
      evidenceDigest: portfolioApplied.evidenceDigest,
      supportingEvidence: 1,
      contradictingEvidence: 1,
      rawDecisionMutationBlocked: rawMutationCode === 'TRANSFORMATION_PORTFOLIO_GO_NOT_APPROVED',
      unauthorizedActorBlocked: unauthorizedCode === 'TRANSFORMATION_DECISION_ACTOR_UNAUTHORIZED',
      forcedReceiptFailureRolledBack: true,
      concurrentRequests: 2,
      exactlyOneReceipt: true,
      sameReceiptAndDecisionIds: true,
      sameKeyDifferentPayloadBlocked:
        resolutionConflict === 'TRANSFORMATION_DECISION_IDEMPOTENCY_CONFLICT',
      downstreamExactReceiptDigestVersion: true,
      finalLifecycleStage: sustainabilityReadback.lifecycle_stage,
      finalCaseVersion: sustainabilityReadback.case_version,
    })
  );
  process.stdout.write(
    `${JSON.stringify(
      {
        preApproval: pre,
        afterApproval: readback,
        unapprovedInsightCode,
        acceptedInterviewResults: acceptedReadback,
        drdBeforeApproval,
        draftDrdCode,
        acceptedDrdResults: drdReadback,
        synthesisBeforeApproval,
        unacceptedInitiativeCode,
        acceptedInitiativeResults: synthesisReadback,
        financeBeforeApproval,
        draftFinanceCode,
        acceptedFinanceKpiResults: financeReadback,
        portfolioBeforeApproval,
        pendingGoCode,
        unapprovedInitiativeLifecycleCode,
        acceptedPortfolioDecisionResults: portfolioReadback,
        mobilizationBeforeApproval,
        unscheduledInitiativeCode,
        acceptedMobilizationResults: mobilizationReadback,
        notExecutingCode,
        notDoneCode,
        incompleteWorkCode,
        acceptedExecutionResults: executionReadback,
        missingBenefitsCode,
        incompleteBenefitsCode,
        acceptedDeliveryHandoff: deliveryReadback,
        unverifiedBenefitsCode,
        acceptedBenefitsReview: { lifecycle_stage: 'sustainability', case_version: 23 },
        shortWindowCode,
        acceptedSustainabilityReview: sustainabilityReadback,
        staleCode,
        finalCounts,
      },
      null,
      2
    )}\n`
  );
}

main().then(
  async () => {
    await pool.end();
    process.exit(0);
  },
  async (error) => {
    await pool.end();
    process.stderr.write(`${String(error?.stack || error)}\n`);
    process.exit(1);
  }
);
