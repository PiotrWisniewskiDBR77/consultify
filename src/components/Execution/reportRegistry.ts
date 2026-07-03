/**
 * reportRegistry.ts — SSOT (single source of truth) for the Execution report catalog.
 *
 * M14 / F6 (6.4): the report catalog used to live hardcoded inside ExecutionHub.tsx
 * (4000+ lines, `reportCatalog` useMemo). This module extracts the *metadata* of
 * every report into one shared, pure-TS registry with no React dependency, so it
 * can be consumed by the hub, the report wizard, tests, server-side generators,
 * and any future surface without re-declaring the catalog.
 *
 * This file intentionally contains only static metadata. Live, data-dependent
 * concerns (icons, highlight values, RAG evaluation, AI readouts) stay in the UI
 * layer — the registry just declares *what* each report is, for *whom*, *how
 * often*, over *what scope*, from *which data sources*, and *which sections* it
 * must contain.
 */

/** Canonical cadence values for a report. */
export type ReportCadence = 'weekly' | 'monthly' | 'biweekly' | 'on-demand' | 'sponsor';

/**
 * A single report definition — pure metadata, no React, no runtime data.
 */
export interface ReportDefinition {
  /** Stable identifier (matches the legacy ExecutionHub catalog id). */
  id: string;
  /** i18n key for the report title. */
  titleKey: string;
  /** Human-readable fallback title (used when no translation is available). */
  defaultTitle: string;
  /** Target audiences for this report. */
  audience: string[];
  /** How often the report is normally produced. */
  cadence: ReportCadence;
  /** One-line description of what the report covers. */
  scope: string;
  /** Upstream data domains the report is built from. */
  dataSources: string[];
  /** Mandatory sections the report must contain. */
  sections: string[];
}

/**
 * REPORT_REGISTRY — the canonical catalog of Execution reports.
 *
 * Order is meaningful (drives default display order). Ids are stable and align
 * with the legacy `reportCatalog` entries in ExecutionHub.tsx.
 */
export const REPORT_REGISTRY: ReportDefinition[] = [
  {
    id: 'weekly-exec',
    titleKey: 'execution.reports.weeklyExec.title',
    defaultTitle: 'Weekly Execution Pack',
    audience: ['PMO', 'Team Leads'],
    cadence: 'weekly',
    scope: 'All active initiatives in current execution cycle',
    dataSources: ['Initiatives', 'Tasks', 'Decisions', 'Risk signals', 'Milestones'],
    sections: [
      'Progress summary',
      'Blockers & escalations',
      'Overdue items',
      'Next milestones',
      'Key decisions needed',
    ],
  },
  {
    id: 'monthly-pmo',
    titleKey: 'execution.reports.monthlyPmo.title',
    defaultTitle: 'Monthly PMO Review',
    audience: ['PMO Director', 'Sponsors'],
    cadence: 'monthly',
    scope: 'Full portfolio month-over-month trends',
    dataSources: ['Initiatives', 'Budget', 'Milestones', 'Baseline/forecast', 'Capacity'],
    sections: [
      'Portfolio trend (MoM)',
      'Milestone slippage summary',
      'Budget variance',
      'Delivery confidence',
      'Capacity utilization overview',
    ],
  },
  {
    id: 'monthly-executive',
    titleKey: 'execution.reports.monthlyExecutive.title',
    defaultTitle: 'Monthly Executive Summary',
    audience: ['Executive Leadership', 'Steering Committee'],
    cadence: 'monthly',
    scope: 'Board-level summary of portfolio outcomes, value delivered and strategic risks',
    dataSources: ['Exec snapshot', 'Initiatives', 'Benefits', 'Budget', 'Risk signals'],
    sections: [
      'Executive headline',
      'Strategic objectives status',
      'Value & benefits realized',
      'Top portfolio risks',
      'Decisions for the board',
    ],
  },
  {
    id: 'program-health',
    titleKey: 'execution.reports.programHealth.title',
    defaultTitle: 'Program Health Summary',
    audience: ['Steering Committee'],
    cadence: 'biweekly',
    scope: 'Per-initiative RAG and aggregate program health',
    dataSources: ['Initiatives', 'Risk signals', 'Delay signals', 'Priority alerts', 'Exec snapshot'],
    sections: [
      'RAG per initiative',
      'Priority alerts',
      'Confidence score & trend',
      'Executive narrative',
      'Required governance decisions',
    ],
  },
  {
    id: 'steering-pack',
    titleKey: 'execution.reports.steeringPack.title',
    defaultTitle: 'Steering Committee Pack',
    audience: ['Steering Committee', 'Sponsors', 'PMO Director'],
    cadence: 'biweekly',
    scope: 'Governance pack: decisions, escalations and portfolio status for the steering forum',
    dataSources: ['Initiatives', 'Decisions', 'Risk signals', 'Milestones', 'Budget'],
    sections: [
      'Agenda & prior actions',
      'Portfolio RAG overview',
      'Escalations & blockers',
      'Decisions required',
      'Budget & schedule outlook',
    ],
  },
  {
    id: 'blockers-recovery',
    titleKey: 'execution.reports.blockersRecovery.title',
    defaultTitle: 'Blockers & Recovery Report',
    audience: ['PMO', 'Delivery Managers'],
    cadence: 'on-demand',
    scope: 'All blocked initiatives and downstream blast radius',
    dataSources: ['Blocked initiatives', 'Dependencies', 'Tasks', 'Risk register'],
    sections: [
      'Active blockers list',
      'Blast radius per blocker',
      'Owner accountability',
      'Recovery actions proposed',
      'Dependency chain impact',
    ],
  },
  {
    id: 'milestone-slippage',
    titleKey: 'execution.reports.milestoneSlippage.title',
    defaultTitle: 'Milestone Slippage Report',
    audience: ['PMO', 'Sponsors'],
    cadence: 'weekly',
    scope: 'All milestones with baseline vs forecast drift',
    dataSources: ['Milestones', 'Baseline', 'Forecast', 'Delay signals'],
    sections: [
      'Slipped milestones',
      'Drift by initiative',
      'Root cause analysis',
      'Forecast accuracy trend',
      'Recovery timeline',
    ],
  },
  {
    id: 'capacity-utilization',
    titleKey: 'execution.reports.capacityUtilization.title',
    defaultTitle: 'Capacity Utilization Report',
    audience: ['Resource Managers', 'PMO'],
    cadence: 'monthly',
    scope: 'Per-person and per-team workload vs capacity',
    dataSources: ['Tasks', 'Assignments', 'Capacity', 'Workload view'],
    sections: [
      'Utilization by person',
      'Team averages',
      'Overload alerts',
      'Underutilized resources',
      'Capacity horizon (4-week lookahead)',
    ],
  },
  {
    id: 'workload-report',
    titleKey: 'execution.reports.workload.title',
    defaultTitle: 'Workload & Assignment Report',
    audience: ['Team Leads', 'Resource Managers', 'PMO'],
    cadence: 'weekly',
    scope: 'Open work, assignments and effort distribution across the team',
    dataSources: ['Tasks', 'Assignments', 'Capacity', 'Initiatives'],
    sections: [
      'Open work by owner',
      'Effort vs availability',
      'Stale & unassigned tasks',
      'Bottleneck owners',
      'Rebalancing recommendations',
    ],
  },
  {
    id: 'budget-variance',
    titleKey: 'execution.reports.budgetVariance.title',
    defaultTitle: 'Budget Variance Report',
    audience: ['Finance', 'Sponsors'],
    cadence: 'monthly',
    scope: 'Planned vs actual budget per initiative',
    dataSources: ['Budget', 'Initiatives', 'Overspend signals'],
    sections: [
      'Aggregate budget status',
      'Per-initiative variance',
      'Forecast overshoot alerts',
      'Burn rate trend',
      'Cost category breakdown',
    ],
  },
  {
    id: 'risk-report',
    titleKey: 'execution.reports.risk.title',
    defaultTitle: 'Risk Register Report',
    audience: ['PMO', 'Risk Owners', 'Steering Committee'],
    cadence: 'biweekly',
    scope: 'Active risks, exposure trend and mitigation status across the portfolio',
    dataSources: ['Risk register', 'Risk signals', 'Initiatives', 'Mitigation actions'],
    sections: [
      'Top risks by exposure',
      'New & escalated risks',
      'Mitigation status',
      'Risk trend over time',
      'Risks requiring decisions',
    ],
  },
  {
    id: 'decision-backlog',
    titleKey: 'execution.reports.decisionBacklog.title',
    defaultTitle: 'Decision Backlog & Approval Aging',
    audience: ['PMO', 'Decision Owners'],
    cadence: 'weekly',
    scope: 'All pending decisions and approval age',
    dataSources: ['Decisions', 'Action queue', 'Initiative dependencies'],
    sections: [
      'Pending decisions list',
      'Aging histogram',
      'Decision-latency risk',
      'Accountability gaps',
      'Downstream blocked work',
    ],
  },
  {
    id: 'cross-dependency',
    titleKey: 'execution.reports.crossDependency.title',
    defaultTitle: 'Cross-Initiative Dependency Report',
    audience: ['PMO', 'Architects'],
    cadence: 'biweekly',
    scope: 'Inter-initiative dependency graph and cascade risk',
    dataSources: ['Dependencies', 'Initiatives', 'Risk signals'],
    sections: [
      'Dependency map',
      'Critical path',
      'Cascade impact analysis',
      'Dependency health',
      'External dependency risks',
    ],
  },
  {
    id: 'delivery-confidence',
    titleKey: 'execution.reports.deliveryConfidence.title',
    defaultTitle: 'Delivery Confidence Report',
    audience: ['Steering Committee', 'Sponsors'],
    cadence: 'monthly',
    scope: 'Risk-adjusted delivery forecast with confidence scoring',
    dataSources: ['Initiatives', 'Risk signals', 'Delay signals', 'Budget', 'Exec snapshot'],
    sections: [
      'Confidence per initiative',
      'Trend direction',
      'Risk-adjusted forecast',
      'Sponsor-ready narrative',
      'Recommended governance actions',
    ],
  },
  {
    id: 'sponsor-onepager',
    titleKey: 'execution.reports.sponsorOnePager.title',
    defaultTitle: 'Sponsor-Ready One-Pager',
    audience: ['Executive Sponsors'],
    cadence: 'sponsor',
    scope: 'Concise executive summary of portfolio state',
    dataSources: ['Exec snapshot', 'Initiatives', 'Risk signals', 'Milestones'],
    sections: [
      'Overall progress',
      'Top 3 risks',
      'Next milestones',
      'Decisions required from sponsor',
      'Key achievements this period',
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers — small, pure lookups over the registry.
// ---------------------------------------------------------------------------

/** Return all reports for a given cadence. */
export function getReportsByCadence(cadence: ReportCadence): ReportDefinition[] {
  return REPORT_REGISTRY.filter((report) => report.cadence === cadence);
}

/** Return a single report by id, or `undefined` if no such report exists. */
export function getReportById(id: string): ReportDefinition | undefined {
  return REPORT_REGISTRY.find((report) => report.id === id);
}

/**
 * Return all reports whose audience list includes the given audience.
 * Matching is case-insensitive and substring-based, so `getReportsForAudience('sponsor')`
 * matches both `'Sponsors'` and `'Executive Sponsors'`.
 */
export function getReportsForAudience(audience: string): ReportDefinition[] {
  const needle = audience.trim().toLowerCase();
  if (!needle) return [];
  return REPORT_REGISTRY.filter((report) =>
    report.audience.some((a) => a.toLowerCase().includes(needle))
  );
}
