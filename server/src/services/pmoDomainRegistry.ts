/**
 * PMO Domain IDs
 *
 * SCMS Meta-PMO Framework: certifiable, methodology-neutral domain identifiers.
 *
 * NOTE (E-DEAD-01, Fable audit 2026-07): this file used to also export a
 * `PMODomainRegistry` class (seedDomains/getAllDomains/getDomain/getProjectDomains/
 * configureProjectDomains/recordAuditEntry/getProjectAuditTrail) that read/wrote
 * `pmo_domains` and `project_pmo_domains` — tables that are never created by any
 * migration or bootstrap (grep confirmed 0 CREATE TABLE anywhere). That class had
 * 0 live callers (grep confirmed: only its own test file, which doesn't even import
 * it). It has been removed rather than backed by new tables, per CTO decision
 * (dead code removed, no new tables created).
 *
 * `PMO_DOMAIN_IDS` below is a real, live-used constant (TaskController,
 * projectMemberService, taskAssignmentService, pmoStandardsMapping all import it)
 * and has been kept.
 */

/**
 * PMO Domain IDs - Certifiable Core Domains
 */
export const PMO_DOMAIN_IDS = {
  GOVERNANCE_DECISION_MAKING: 'GOVERNANCE_DECISION_MAKING',
  SCOPE_CHANGE_CONTROL: 'SCOPE_CHANGE_CONTROL',
  SCHEDULE_MILESTONES: 'SCHEDULE_MILESTONES',
  RISK_ISSUE_MANAGEMENT: 'RISK_ISSUE_MANAGEMENT',
  RESOURCE_RESPONSIBILITY: 'RESOURCE_RESPONSIBILITY',
  PERFORMANCE_MONITORING: 'PERFORMANCE_MONITORING',
  BENEFITS_REALIZATION: 'BENEFITS_REALIZATION',
} as const;

export type PMODomainId = (typeof PMO_DOMAIN_IDS)[keyof typeof PMO_DOMAIN_IDS];
