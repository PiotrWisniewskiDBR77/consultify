-- Migration: 531_initiative_template_full_config.sql
-- Extend initiative_templates with comprehensive project management configuration
-- Date: 2026-02-08
--
-- Adds columns for: suggested tasks, team config, escalation rules,
-- gate readiness rules, RAID templates, financial requirements,
-- benefits config, status report config, and validation rules per gate.

-- ==========================================
-- SUGGESTED TASKS (task blueprints)
-- ==========================================
ALTER TABLE initiative_templates ADD COLUMN suggested_tasks TEXT DEFAULT '[]';
-- JSON array: [{ title, description, taskType, stepPhase, priority, estimatedHours }]

-- ==========================================
-- TEAM & RESOURCE CONFIGURATION
-- ==========================================
ALTER TABLE initiative_templates ADD COLUMN team_config TEXT DEFAULT '{}';
-- JSON: {
--   requiredRoles: [{ role, label, required, minCount }],
--   requireOwnerBusiness: true/false,
--   requireOwnerExecution: true/false,
--   requireSponsor: true/false,
--   minFte: number,
--   suggestedRaci: [{ role, raciType }]
-- }

-- ==========================================
-- ESCALATION CONFIGURATION
-- ==========================================
ALTER TABLE initiative_templates ADD COLUMN escalation_config TEXT DEFAULT '{}';
-- JSON: {
--   amberThresholdDays: number,
--   redThresholdDays: number,
--   autoEscalateToSteeringCommittee: true/false,
--   decisionEscalationTypes: string[],
--   reminderBeforeDays: number[]
-- }

-- ==========================================
-- GATE READINESS RULES
-- ==========================================
ALTER TABLE initiative_templates ADD COLUMN gate_config TEXT DEFAULT '{}';
-- JSON: {
--   gates: {
--     SUBMIT_FOR_REVIEW: { requiredFields: [], requiredSections: [], conditions: [] },
--     APPROVE: { requiredFields: [], requiredSections: [], conditions: [] },
--     ...
--   },
--   skipGates: string[],
--   allowedRolesPerGate: { gateName: string[] }
-- }

-- ==========================================
-- RAID TEMPLATES (suggested risks, assumptions)
-- ==========================================
ALTER TABLE initiative_templates ADD COLUMN raid_templates TEXT DEFAULT '[]';
-- JSON array: [{ type: 'RISK'|'ASSUMPTION'|'ISSUE'|'DEPENDENCY', title, description, probability, impact, mitigation }]

-- ==========================================
-- FINANCIAL REQUIREMENTS
-- ==========================================
ALTER TABLE initiative_templates ADD COLUMN financial_config TEXT DEFAULT '{}';
-- JSON: {
--   requireFinancialAnalysis: true/false,
--   requireBusinessCase: true/false,
--   requiredFields: ['capex','opex','roi'],
--   minRoiPercent: number | null,
--   budgetApprovalLimit: number | null,
--   requireCostBenefitAnalysis: true/false
-- }

-- ==========================================
-- BENEFITS TRACKING CONFIGURATION
-- ==========================================
ALTER TABLE initiative_templates ADD COLUMN benefits_config TEXT DEFAULT '{}';
-- JSON: {
--   enableBenefitsTracking: true/false,
--   measurementFrequency: 'monthly'|'quarterly',
--   trackingDurationMonths: number,
--   requiredBenefitTypes: string[],
--   requireQuantitativeBenefits: true/false
-- }

-- ==========================================
-- STATUS REPORT CONFIGURATION
-- ==========================================
ALTER TABLE initiative_templates ADD COLUMN status_report_config TEXT DEFAULT '{}';
-- JSON: {
--   reportingFrequency: 'weekly'|'biweekly'|'monthly',
--   requiredSections: string[],
--   autoGenerate: true/false,
--   recipients: string[],  // role names
--   enableAiSummary: true/false
-- }

-- ==========================================
-- VALIDATION RULES (per-status required fields)
-- ==========================================
ALTER TABLE initiative_templates ADD COLUMN validation_rules TEXT DEFAULT '{}';
-- JSON: {
--   beforeSubmit: { requiredFields: [], requiredSections: [] },
--   beforeApprove: { requiredFields: [], requiredSections: [] },
--   beforeStart: { requiredFields: [], requiredSections: [] },
--   beforeComplete: { requiredFields: [], requiredSections: [] }
-- }
