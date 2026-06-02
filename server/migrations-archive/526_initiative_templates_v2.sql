-- Migration: 526_initiative_templates_v2
-- Purpose: Extend initiative_templates for full process blueprint support (4 levels)
-- Date: 2026-02-08
--
-- Adds: level, source_types, is_system, visible_sections, required_fields,
--        workflow_config, notification_config columns to initiative_templates.
-- Replaces old card-scope seed data with new 4-level templates.

-- New columns for rich template definitions
ALTER TABLE initiative_templates ADD COLUMN level TEXT DEFAULT 'standard'
  CHECK(level IN ('quick_win', 'standard', 'enterprise', 'full_charter'));

ALTER TABLE initiative_templates ADD COLUMN source_types TEXT DEFAULT '[]';
  -- JSON array: which sources can use this template e.g. ["assessment","tool","manual"]

ALTER TABLE initiative_templates ADD COLUMN is_system INTEGER DEFAULT 0;
  -- 1 = system/app template, 0 = organization template

ALTER TABLE initiative_templates ADD COLUMN visible_sections TEXT DEFAULT '{}';
  -- JSON: full section visibility map (extends cardScope)

ALTER TABLE initiative_templates ADD COLUMN required_fields TEXT DEFAULT '[]';
  -- JSON array: fields required before gate transitions

ALTER TABLE initiative_templates ADD COLUMN workflow_config TEXT DEFAULT '{}';
  -- JSON: phases, gates, decisions configuration

ALTER TABLE initiative_templates ADD COLUMN notification_config TEXT DEFAULT '{}';
  -- JSON: notification triggers configuration

ALTER TABLE initiative_templates ADD COLUMN suggested_decisions TEXT DEFAULT '[]';
  -- JSON array: predefined decision definitions

ALTER TABLE initiative_templates ADD COLUMN suggested_milestones TEXT DEFAULT '[]';
  -- JSON array: predefined milestone definitions

ALTER TABLE initiative_templates ADD COLUMN suggested_kpis TEXT DEFAULT '[]';
  -- JSON array: predefined KPI definitions

ALTER TABLE initiative_templates ADD COLUMN sections_count INTEGER DEFAULT 0;
  -- Computed: number of visible sections (for table display)

-- Index for fast filtering
CREATE INDEX IF NOT EXISTS idx_initiative_templates_level ON initiative_templates(level);
CREATE INDEX IF NOT EXISTS idx_initiative_templates_is_system ON initiative_templates(is_system);

-- =====================================================
-- Update existing card-scope templates to new schema
-- =====================================================

-- tpl-card-lite → Quick Win
UPDATE initiative_templates SET
  level = 'quick_win',
  is_system = 1,
  name = 'Quick Win',
  description = 'Minimal initiative for quick wins and action items. Simple tasks, basic team, no governance overhead.',
  source_types = '["assessment","tool","manual","ai"]',
  visible_sections = '{
    "overview": true,
    "problemDefinition": false,
    "targetState": false,
    "scope": false,
    "tasks": true,
    "decisions": false,
    "raid": false,
    "gates": false,
    "financialAnalysis": false,
    "financialImpact": false,
    "team": true,
    "timeline": true,
    "milestones": false,
    "stakeholders": false,
    "kpis": false,
    "pilot": false,
    "dependencies": false,
    "intelligence": false,
    "resources": false,
    "watchers": false
  }',
  required_fields = '["title","summary","axis","priority","owner_execution_id"]',
  workflow_config = '{
    "phases": ["PLAN"],
    "skipGates": ["GOVERNANCE_DECISION_MAKING","RESOURCE_RESPONSIBILITY","SCHEDULE_MILESTONES"],
    "autoPromoteToPlanning": true,
    "requireApproval": false
  }',
  notification_config = '{
    "onStatusChange": true,
    "onTaskOverdue": true,
    "onDecisionNeeded": false,
    "onGateApproach": false,
    "onBlocked": true,
    "onCompleted": true
  }',
  suggested_decisions = '[]',
  suggested_milestones = '[]',
  suggested_kpis = '[]',
  sections_count = 4,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'tpl-card-lite';

-- tpl-card-standard → Standard
UPDATE initiative_templates SET
  level = 'standard',
  is_system = 1,
  name = 'Standard',
  description = 'Standard initiative template for operational and transformational projects. Structured problem definition, scope, RAID, and basic financial tracking.',
  source_types = '["assessment","tool","manual","ai"]',
  visible_sections = '{
    "overview": true,
    "problemDefinition": true,
    "targetState": true,
    "scope": true,
    "tasks": true,
    "decisions": false,
    "raid": true,
    "gates": false,
    "financialAnalysis": false,
    "financialImpact": true,
    "team": true,
    "timeline": true,
    "milestones": true,
    "stakeholders": false,
    "kpis": false,
    "pilot": false,
    "dependencies": false,
    "intelligence": false,
    "resources": false,
    "watchers": false
  }',
  required_fields = '["title","summary","description","axis","priority","complexity","problem_statement","target_state","deliverables","success_criteria","owner_business_id","owner_execution_id","planned_start_date","planned_end_date"]',
  workflow_config = '{
    "phases": ["PLAN"],
    "skipGates": [],
    "autoPromoteToPlanning": false,
    "requireApproval": true,
    "requireReviewBeforeApproval": true
  }',
  notification_config = '{
    "onStatusChange": true,
    "onTaskOverdue": true,
    "onDecisionNeeded": true,
    "onGateApproach": true,
    "onBlocked": true,
    "onCompleted": true
  }',
  suggested_decisions = '[
    {"title":"Go/No-Go Review","type":"GO_NO_GO","pmoDomain":"GOVERNANCE_DECISION_MAKING","priority":"HIGH","triggerAtStatus":"REVIEW"},
    {"title":"Resource Commitment","type":"RESOURCE_ALLOCATION","pmoDomain":"RESOURCE_RESPONSIBILITY","priority":"MEDIUM","triggerAtStatus":"PROMOTED"}
  ]',
  suggested_milestones = '[
    {"name":"Scope Defined","isGate":false,"orderIndex":1},
    {"name":"Team Assigned","isGate":false,"orderIndex":2},
    {"name":"Implementation Complete","isGate":false,"orderIndex":3},
    {"name":"Results Validated","isGate":true,"orderIndex":4}
  ]',
  suggested_kpis = '[]',
  sections_count = 10,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'tpl-card-standard';

-- tpl-card-governance → Enterprise
UPDATE initiative_templates SET
  level = 'enterprise',
  is_system = 1,
  name = 'Enterprise',
  description = 'Full governance initiative with gate decisions, RACI stakeholders, milestones, and structured approval workflow. For strategic programs and large-scale transformations.',
  source_types = '["assessment","tool","manual","ai"]',
  visible_sections = '{
    "overview": true,
    "problemDefinition": true,
    "targetState": true,
    "scope": true,
    "tasks": true,
    "decisions": true,
    "raid": true,
    "gates": true,
    "financialAnalysis": false,
    "financialImpact": true,
    "team": true,
    "timeline": true,
    "milestones": true,
    "stakeholders": true,
    "kpis": false,
    "pilot": false,
    "dependencies": true,
    "intelligence": false,
    "resources": true,
    "watchers": true
  }',
  required_fields = '["title","summary","description","axis","priority","complexity","problem_statement","target_state","deliverables","success_criteria","scope_in","scope_out","key_risks","kill_criteria","owner_business_id","owner_execution_id","sponsor_id","planned_start_date","planned_end_date","roadmap_quarter","cost_capex","cost_opex","expected_roi"]',
  workflow_config = '{
    "phases": ["PLAN","PILOT","SCALE"],
    "skipGates": [],
    "autoPromoteToPlanning": false,
    "requireApproval": true,
    "requireReviewBeforeApproval": true,
    "requireSteeringCommittee": true,
    "requirePhaseGateDecisions": true
  }',
  notification_config = '{
    "onStatusChange": true,
    "onTaskOverdue": true,
    "onDecisionNeeded": true,
    "onGateApproach": true,
    "onBlocked": true,
    "onCompleted": true,
    "onMilestoneReached": true,
    "onEscalation": true,
    "onPhaseTransition": true
  }',
  suggested_decisions = '[
    {"title":"Go/No-Go Decision","type":"GO_NO_GO","pmoDomain":"GOVERNANCE_DECISION_MAKING","priority":"HIGH","triggerAtStatus":"REVIEW"},
    {"title":"Resource Commitment","type":"RESOURCE_ALLOCATION","pmoDomain":"RESOURCE_RESPONSIBILITY","priority":"HIGH","triggerAtStatus":"PROMOTED"},
    {"title":"Schedule Lock","type":"APPROVAL","pmoDomain":"SCHEDULE_MILESTONES","priority":"HIGH","triggerAtStatus":"APPROVED"},
    {"title":"Phase Transition Review","type":"PHASE_TRANSITION","pmoDomain":"GOVERNANCE_DECISION_MAKING","priority":"HIGH","triggerAtStatus":"EXECUTING"}
  ]',
  suggested_milestones = '[
    {"name":"Problem & Scope Validated","isGate":true,"orderIndex":1},
    {"name":"Team Assembled & Resources Committed","isGate":true,"orderIndex":2},
    {"name":"Design Complete","isGate":false,"orderIndex":3},
    {"name":"Pilot Launched","isGate":true,"orderIndex":4},
    {"name":"Pilot Results Evaluated","isGate":true,"orderIndex":5},
    {"name":"Scale Decision","isGate":true,"orderIndex":6},
    {"name":"Full Rollout Complete","isGate":false,"orderIndex":7},
    {"name":"Benefits Baseline Established","isGate":true,"orderIndex":8}
  ]',
  suggested_kpis = '[]',
  sections_count = 16,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'tpl-card-governance';

-- tpl-card-economics → Full Charter
UPDATE initiative_templates SET
  level = 'full_charter',
  is_system = 1,
  name = 'Full Charter',
  description = 'Complete investment case with deep financial analysis, KPIs, benefits tracking, pilot management, and full intelligence suite. For Steering Committee presentations and major investment decisions.',
  source_types = '["assessment","tool","manual","ai"]',
  visible_sections = '{
    "overview": true,
    "problemDefinition": true,
    "targetState": true,
    "scope": true,
    "tasks": true,
    "decisions": true,
    "raid": true,
    "gates": true,
    "financialAnalysis": true,
    "financialImpact": true,
    "team": true,
    "timeline": true,
    "milestones": true,
    "stakeholders": true,
    "kpis": true,
    "pilot": true,
    "dependencies": true,
    "intelligence": true,
    "resources": true,
    "watchers": true
  }',
  required_fields = '["title","summary","description","strategic_intent","business_value","axis","priority","complexity","problem_statement","target_state","deliverables","success_criteria","scope_in","scope_out","key_risks","kill_criteria","owner_business_id","owner_execution_id","sponsor_id","planned_start_date","planned_end_date","roadmap_quarter","roadmap_year","cost_capex","cost_opex","expected_roi","annual_benefit","confidence_level","required_capacity_fte"]',
  workflow_config = '{
    "phases": ["PLAN","PILOT","SCALE"],
    "skipGates": [],
    "autoPromoteToPlanning": false,
    "requireApproval": true,
    "requireReviewBeforeApproval": true,
    "requireSteeringCommittee": true,
    "requirePhaseGateDecisions": true,
    "requireFinancialSignoff": true,
    "requireBenefitsTracking": true
  }',
  notification_config = '{
    "onStatusChange": true,
    "onTaskOverdue": true,
    "onDecisionNeeded": true,
    "onGateApproach": true,
    "onBlocked": true,
    "onCompleted": true,
    "onMilestoneReached": true,
    "onEscalation": true,
    "onPhaseTransition": true,
    "onBudgetThreshold": true,
    "onKpiMeasurementDue": true,
    "onBenefitsReview": true
  }',
  suggested_decisions = '[
    {"title":"Go/No-Go Decision","type":"GO_NO_GO","pmoDomain":"GOVERNANCE_DECISION_MAKING","priority":"CRITICAL","triggerAtStatus":"REVIEW"},
    {"title":"Budget & Resource Commitment","type":"RESOURCE_ALLOCATION","pmoDomain":"RESOURCE_RESPONSIBILITY","priority":"CRITICAL","triggerAtStatus":"PROMOTED"},
    {"title":"Schedule & Milestone Lock","type":"APPROVAL","pmoDomain":"SCHEDULE_MILESTONES","priority":"HIGH","triggerAtStatus":"APPROVED"},
    {"title":"Pilot Launch Decision","type":"PHASE_TRANSITION","pmoDomain":"GOVERNANCE_DECISION_MAKING","priority":"HIGH","triggerAtStatus":"EXECUTING"},
    {"title":"Scale Decision","type":"PHASE_TRANSITION","pmoDomain":"GOVERNANCE_DECISION_MAKING","priority":"CRITICAL","triggerAtStatus":"EXECUTING"},
    {"title":"Benefits Realization Gate","type":"APPROVAL","pmoDomain":"BENEFITS_REALIZATION","priority":"HIGH","triggerAtStatus":"DONE"}
  ]',
  suggested_milestones = '[
    {"name":"Business Case Approved","isGate":true,"orderIndex":1},
    {"name":"Team & Budget Secured","isGate":true,"orderIndex":2},
    {"name":"Solution Design Finalized","isGate":true,"orderIndex":3},
    {"name":"Pilot Scope Defined","isGate":false,"orderIndex":4},
    {"name":"Pilot Launched","isGate":true,"orderIndex":5},
    {"name":"Pilot KPIs Measured","isGate":true,"orderIndex":6},
    {"name":"Scale Decision Gate","isGate":true,"orderIndex":7},
    {"name":"Rollout Phase 1 Complete","isGate":false,"orderIndex":8},
    {"name":"Full Rollout Complete","isGate":false,"orderIndex":9},
    {"name":"Benefits Baseline Measured","isGate":true,"orderIndex":10},
    {"name":"6-Month Benefits Review","isGate":true,"orderIndex":11},
    {"name":"12-Month Benefits Review","isGate":true,"orderIndex":12}
  ]',
  suggested_kpis = '[
    {"name":"ROI Achievement","unit":"%","measurementFrequency":"quarterly","isPrimary":true},
    {"name":"Budget Variance","unit":"%","measurementFrequency":"monthly","isPrimary":true},
    {"name":"Timeline Adherence","unit":"%","measurementFrequency":"monthly","isPrimary":false},
    {"name":"Stakeholder Satisfaction","unit":"score","measurementFrequency":"quarterly","isPrimary":false},
    {"name":"Adoption Rate","unit":"%","measurementFrequency":"monthly","isPrimary":true}
  ]',
  sections_count = 20,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 'tpl-card-economics';

-- Update template_data.cardScope to match visible_sections for backward compat
UPDATE initiative_templates
SET template_data = (
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(
            jsonb_set(
              jsonb_set(
                jsonb_set(
                  template_data::jsonb,
                  '{cardScope,showOverview}', 'true'::jsonb, true
                ),
                '{cardScope,showTasks}', COALESCE(visible_sections::jsonb->'tasks', 'false'::jsonb), true
              ),
              '{cardScope,showDecisions}', COALESCE(visible_sections::jsonb->'decisions', 'false'::jsonb), true
            ),
            '{cardScope,showRaid}', COALESCE(visible_sections::jsonb->'raid', 'false'::jsonb), true
          ),
          '{cardScope,showGates}', COALESCE(visible_sections::jsonb->'gates', 'false'::jsonb), true
        ),
        '{cardScope,showFinancialAnalysis}', COALESCE(visible_sections::jsonb->'financialAnalysis', 'false'::jsonb), true
      ),
      '{cardScope,showFinancialImpact}', COALESCE(visible_sections::jsonb->'financialImpact', 'false'::jsonb), true
    ),
    '{cardScope,showTeam}', COALESCE(visible_sections::jsonb->'team', 'false'::jsonb), true
  )::text
)
WHERE is_system = 1;

-- Update suggested tasks using template_data for backward compat
UPDATE initiative_templates
SET template_data = jsonb_set(
  jsonb_set(template_data::jsonb, '{suggestedTasks}', '[]'::jsonb, true),
  '{suggestedRoles}', '[]'::jsonb, true
)::text
WHERE is_system = 1 AND level = 'quick_win';

UPDATE initiative_templates
SET template_data = jsonb_set(
  jsonb_set(template_data::jsonb, '{suggestedTasks}', '[
    {"title":"Define problem statement and target state","taskType":"analysis","stepPhase":"design","priority":"high"},
    {"title":"Identify key stakeholders","taskType":"analysis","stepPhase":"design","priority":"medium"},
    {"title":"Define deliverables and success criteria","taskType":"design","stepPhase":"design","priority":"high"},
    {"title":"Create implementation plan","taskType":"design","stepPhase":"design","priority":"high"},
    {"title":"Execute implementation","taskType":"execution","stepPhase":"pilot","priority":"high"},
    {"title":"Validate results against success criteria","taskType":"test","stepPhase":"pilot","priority":"high"}
  ]'::jsonb, true),
  '{suggestedRoles}', '[
    {"role":"Initiative Owner","allocation":30},
    {"role":"Business Owner","allocation":15},
    {"role":"Team Member","allocation":50}
  ]'::jsonb, true)
::text
WHERE is_system = 1 AND level = 'standard';

UPDATE initiative_templates
SET template_data = jsonb_set(
  jsonb_set(template_data::jsonb, '{suggestedTasks}', '[
    {"title":"Develop business case","taskType":"analysis","stepPhase":"design","priority":"critical"},
    {"title":"Stakeholder analysis and RACI mapping","taskType":"analysis","stepPhase":"design","priority":"high"},
    {"title":"Define problem structure (symptom, root cause, cost of inaction)","taskType":"analysis","stepPhase":"design","priority":"high"},
    {"title":"Design solution architecture","taskType":"design","stepPhase":"design","priority":"high"},
    {"title":"Risk assessment and mitigation plan","taskType":"analysis","stepPhase":"design","priority":"high"},
    {"title":"Resource planning and budget estimation","taskType":"analysis","stepPhase":"design","priority":"high"},
    {"title":"Secure Go/No-Go decision","taskType":"decision","stepPhase":"design","priority":"critical"},
    {"title":"Assemble project team","taskType":"execution","stepPhase":"design","priority":"high"},
    {"title":"Define pilot scope and KPIs","taskType":"design","stepPhase":"pilot","priority":"high"},
    {"title":"Execute pilot","taskType":"execution","stepPhase":"pilot","priority":"high"},
    {"title":"Evaluate pilot results","taskType":"test","stepPhase":"pilot","priority":"high"},
    {"title":"Scale decision gate","taskType":"decision","stepPhase":"pilot","priority":"critical"},
    {"title":"Full rollout planning","taskType":"design","stepPhase":"rollout","priority":"high"},
    {"title":"Execute rollout","taskType":"execution","stepPhase":"rollout","priority":"high"},
    {"title":"Post-implementation review","taskType":"test","stepPhase":"rollout","priority":"medium"}
  ]'::jsonb, true),
  '{suggestedRoles}', '[
    {"role":"Initiative Owner","allocation":40},
    {"role":"Business Owner","allocation":20},
    {"role":"Sponsor","allocation":5},
    {"role":"PMO Lead","allocation":15},
    {"role":"Team Lead","allocation":60},
    {"role":"Team Member","allocation":80},
    {"role":"Subject Matter Expert","allocation":10}
  ]'::jsonb, true)
::text
WHERE is_system = 1 AND level = 'enterprise';

UPDATE initiative_templates
SET template_data = jsonb_set(
  jsonb_set(template_data::jsonb, '{suggestedTasks}', '[
    {"title":"Develop comprehensive business case with NPV/IRR analysis","taskType":"analysis","stepPhase":"design","priority":"critical"},
    {"title":"Executive stakeholder mapping and engagement plan","taskType":"analysis","stepPhase":"design","priority":"critical"},
    {"title":"Define structured problem (symptom, root cause, cost of inaction)","taskType":"analysis","stepPhase":"design","priority":"high"},
    {"title":"Solution architecture and technology assessment","taskType":"design","stepPhase":"design","priority":"high"},
    {"title":"Comprehensive risk assessment (RAID)","taskType":"analysis","stepPhase":"design","priority":"high"},
    {"title":"Detailed budget and resource plan (CAPEX/OPEX)","taskType":"analysis","stepPhase":"design","priority":"critical"},
    {"title":"Define KPIs and benefits measurement framework","taskType":"design","stepPhase":"design","priority":"high"},
    {"title":"Steering Committee presentation and Go/No-Go","taskType":"decision","stepPhase":"design","priority":"critical"},
    {"title":"Assemble full project team with RACI","taskType":"execution","stepPhase":"design","priority":"high"},
    {"title":"Define pilot hypotheses and success criteria","taskType":"design","stepPhase":"pilot","priority":"high"},
    {"title":"Execute pilot phase","taskType":"execution","stepPhase":"pilot","priority":"high"},
    {"title":"Measure pilot KPIs","taskType":"test","stepPhase":"pilot","priority":"high"},
    {"title":"Pilot retrospective and lessons learned","taskType":"analysis","stepPhase":"pilot","priority":"medium"},
    {"title":"Scale decision with Steering Committee","taskType":"decision","stepPhase":"pilot","priority":"critical"},
    {"title":"Full rollout planning with dependencies","taskType":"design","stepPhase":"rollout","priority":"high"},
    {"title":"Change management and communication plan","taskType":"design","stepPhase":"rollout","priority":"high"},
    {"title":"Execute phased rollout","taskType":"execution","stepPhase":"rollout","priority":"high"},
    {"title":"Post-implementation review","taskType":"test","stepPhase":"rollout","priority":"medium"},
    {"title":"Establish benefits measurement baseline","taskType":"analysis","stepPhase":"rollout","priority":"high"},
    {"title":"6-month benefits review","taskType":"analysis","stepPhase":"rollout","priority":"high"},
    {"title":"12-month benefits review and case study","taskType":"analysis","stepPhase":"rollout","priority":"medium"}
  ]'::jsonb, true),
  '{suggestedRoles}', '[
    {"role":"Executive Sponsor","allocation":5},
    {"role":"Initiative Owner","allocation":50},
    {"role":"Business Owner","allocation":25},
    {"role":"PMO Lead","allocation":20},
    {"role":"Finance Partner","allocation":10},
    {"role":"Team Lead","allocation":70},
    {"role":"Team Member","allocation":100},
    {"role":"Change Manager","allocation":30},
    {"role":"Subject Matter Expert","allocation":15},
    {"role":"Benefits Analyst","allocation":15}
  ]'::jsonb, true)
::text
WHERE is_system = 1 AND level = 'full_charter';
