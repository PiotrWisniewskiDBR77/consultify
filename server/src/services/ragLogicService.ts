/**
 * RAG Logic Service
 *
 * Computes Red-Amber-Green (RAG) status for report sections
 * based on initiative data, benefits tracking, and portfolio health.
 * Each R1-R4 report type has its own computation logic.
 */

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export type RagStatus = 'green' | 'amber' | 'red';

export interface RagResult {
  sectionKey: string;
  status: RagStatus;
  reason: string;
  dataPoints?: Array<{ metric: string; value: number; threshold: number }>;
}

export interface EscalationItem {
  initiativeId: string;
  initiativeName: string;
  reason: string;
  daysBlocked?: number;
  budgetDeviation?: number;
}

// ==========================================
// INTERNAL HELPERS
// ==========================================

interface InitiativeRow {
  id: string;
  name: string;
  status: string;
  current_stage: string | null;
  priority: string;
  planned_start_date: string | null;
  planned_end_date: string | null;
  start_date: string | null;
  end_date: string | null;
  estimated_budget: number | null;
  cost_capex: number | null;
  cost_opex: number | null;
}

function daysBetween(dateA: string | null, dateB: string | null): number {
  if (!dateA || !dateB) return 0;
  const a = new Date(dateA).getTime();
  const b = new Date(dateB).getTime();
  if (isNaN(a) || isNaN(b)) return 0;
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function isBlocked(status: string): boolean {
  const s = (status || '').toLowerCase();
  return s === 'blocked' || s === 'on_hold' || s === 'escalated';
}

function hasCriticalDecisionPending(status: string): boolean {
  const s = (status || '').toLowerCase();
  return s === 'pending_decision' || s === 'decision_required';
}

function computeDelayDays(initiative: InitiativeRow): number {
  if (!initiative.planned_end_date) return 0;
  const now = new Date();
  const planned = new Date(initiative.planned_end_date);
  if (isNaN(planned.getTime())) return 0;

  if (initiative.end_date) {
    return daysBetween(initiative.planned_end_date, initiative.end_date);
  }
  const status = (initiative.status || '').toLowerCase();
  if (status === 'completed' || status === 'done') return 0;
  if (now > planned) {
    return Math.round((now.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24));
  }
  return 0;
}

function computeBudgetDeviation(initiative: InitiativeRow): number {
  const budget = initiative.estimated_budget || 0;
  if (budget <= 0) return 0;
  const actual = (initiative.cost_capex || 0) + (initiative.cost_opex || 0);
  return ((actual - budget) / budget) * 100;
}

// ==========================================
// R1: WEEKLY EXECUTION RAG
// ==========================================

export async function computeR1Rag(
  organizationId: string,
  periodFrom: string,
  periodTo: string
): Promise<RagResult[]> {
  const results: RagResult[] = [];

  const initiatives = await dbAll<InitiativeRow>(
    `SELECT id, name, status, current_stage, priority,
            planned_start_date, planned_end_date, start_date, end_date,
            estimated_budget, cost_capex, cost_opex
     FROM initiatives
     WHERE organization_id = ?`,
    [organizationId]
  );

  // --- initiatives_overview ---
  const blocked = initiatives.filter((i) => isBlocked(i.status));
  const delayed = initiatives.filter((i) => computeDelayDays(i) > 0);
  const criticalPending = initiatives.filter((i) => hasCriticalDecisionPending(i.status));

  if (blocked.length > 0 || criticalPending.length > 0 || delayed.some((i) => computeDelayDays(i) > 7)) {
    results.push({
      sectionKey: 'initiatives_overview',
      status: 'red',
      reason: `${blocked.length} blocked, ${criticalPending.length} pending critical decisions, ${delayed.filter((i) => computeDelayDays(i) > 7).length} delayed >7d`,
      dataPoints: [
        { metric: 'blocked_count', value: blocked.length, threshold: 0 },
        { metric: 'critical_pending', value: criticalPending.length, threshold: 0 },
      ],
    });
  } else if (delayed.length > 0) {
    results.push({
      sectionKey: 'initiatives_overview',
      status: 'amber',
      reason: `${delayed.length} initiatives with minor delays (<=7d)`,
      dataPoints: [{ metric: 'delayed_count', value: delayed.length, threshold: 0 }],
    });
  } else {
    results.push({
      sectionKey: 'initiatives_overview',
      status: 'green',
      reason: 'All initiatives on track, no blockers',
    });
  }

  // --- tasks_progress ---
  const tasks = await dbAll<{ status: string; due_date: string | null }>(
    `SELECT status, due_date FROM tasks
     WHERE organization_id = ?`,
    [organizationId]
  );
  const overdue = tasks.filter(
    (t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done' && t.status !== 'completed'
  );
  const overdueRatio = tasks.length > 0 ? overdue.length / tasks.length : 0;

  if (overdueRatio > 0.2) {
    results.push({
      sectionKey: 'tasks_progress',
      status: 'red',
      reason: `${overdue.length}/${tasks.length} tasks overdue (${Math.round(overdueRatio * 100)}%)`,
      dataPoints: [{ metric: 'overdue_ratio', value: Math.round(overdueRatio * 100), threshold: 20 }],
    });
  } else if (overdueRatio > 0.05) {
    results.push({
      sectionKey: 'tasks_progress',
      status: 'amber',
      reason: `${overdue.length} overdue tasks`,
      dataPoints: [{ metric: 'overdue_ratio', value: Math.round(overdueRatio * 100), threshold: 5 }],
    });
  } else {
    results.push({
      sectionKey: 'tasks_progress',
      status: 'green',
      reason: 'Tasks on track',
    });
  }

  // --- blocked_risks ---
  if (blocked.length > 0) {
    results.push({
      sectionKey: 'blocked_risks',
      status: blocked.length >= 3 ? 'red' : 'amber',
      reason: `${blocked.length} blocked initiative(s)`,
      dataPoints: [{ metric: 'blocked_count', value: blocked.length, threshold: 0 }],
    });
  } else {
    results.push({ sectionKey: 'blocked_risks', status: 'green', reason: 'No blockers' });
  }

  logger.info('[RagLogic] R1 RAG computed', { organizationId, resultCount: results.length });
  return results;
}

// ==========================================
// R2: STEERING COMMITTEE ESCALATION
// ==========================================

export async function computeR2Escalation(organizationId: string): Promise<EscalationItem[]> {
  const escalations: EscalationItem[] = [];

  const initiatives = await dbAll<InitiativeRow>(
    `SELECT id, name, status, current_stage, priority,
            planned_start_date, planned_end_date, start_date, end_date,
            estimated_budget, cost_capex, cost_opex
     FROM initiatives
     WHERE organization_id = ?`,
    [organizationId]
  );

  for (const init of initiatives) {
    if (isBlocked(init.status)) {
      const blockedDays = computeDelayDays(init);
      if (blockedDays > 7) {
        escalations.push({
          initiativeId: init.id,
          initiativeName: init.name,
          reason: `Blocked for ${blockedDays} days`,
          daysBlocked: blockedDays,
        });
      }
    }

    const deviation = computeBudgetDeviation(init);
    if (deviation > 10) {
      escalations.push({
        initiativeId: init.id,
        initiativeName: init.name,
        reason: `Budget deviation ${Math.round(deviation)}% above threshold`,
        budgetDeviation: Math.round(deviation),
      });
    }
  }

  // Overdue decisions (tasks of type 'decision' or similar)
  const overdueDecisions = await dbAll<{ id: string; title: string; due_date: string }>(
    `SELECT id, title, due_date FROM tasks
     WHERE organization_id = ?
       AND task_type IN ('decision', 'change_request')
       AND status NOT IN ('done', 'completed', 'cancelled')
       AND due_date < datetime('now')`,
    [organizationId]
  );

  for (const d of overdueDecisions) {
    escalations.push({
      initiativeId: d.id,
      initiativeName: d.title,
      reason: 'Overdue decision/change request',
      daysBlocked: daysBetween(d.due_date, new Date().toISOString()),
    });
  }

  logger.info('[RagLogic] R2 escalation computed', {
    organizationId,
    escalationCount: escalations.length,
  });
  return escalations;
}

/**
 * Compute R2 RAG results for steering committee sections.
 */
export async function computeR2Rag(
  organizationId: string,
  _periodFrom: string,
  _periodTo: string
): Promise<RagResult[]> {
  const results: RagResult[] = [];
  const escalations = await computeR2Escalation(organizationId);

  const initiatives = await dbAll<InitiativeRow>(
    `SELECT id, name, status, current_stage, priority,
            planned_start_date, planned_end_date, start_date, end_date,
            estimated_budget, cost_capex, cost_opex
     FROM initiatives
     WHERE organization_id = ?`,
    [organizationId]
  );

  // --- executive_summary ---
  const blocked = initiatives.filter((i) => isBlocked(i.status));
  if (escalations.length > 3 || blocked.length > 2) {
    results.push({
      sectionKey: 'executive_summary',
      status: 'red',
      reason: `${escalations.length} escalations, ${blocked.length} blocked`,
    });
  } else if (escalations.length > 0) {
    results.push({
      sectionKey: 'executive_summary',
      status: 'amber',
      reason: `${escalations.length} escalation(s) requiring attention`,
    });
  } else {
    results.push({
      sectionKey: 'executive_summary',
      status: 'green',
      reason: 'No escalations',
    });
  }

  // --- initiatives_requiring_decision ---
  const pendingDecisions = initiatives.filter((i) => hasCriticalDecisionPending(i.status));
  if (pendingDecisions.length > 0) {
    results.push({
      sectionKey: 'initiatives_requiring_decision',
      status: pendingDecisions.length > 2 ? 'red' : 'amber',
      reason: `${pendingDecisions.length} initiative(s) requiring decision`,
    });
  } else {
    results.push({
      sectionKey: 'initiatives_requiring_decision',
      status: 'green',
      reason: 'No pending decisions',
    });
  }

  // --- budget_capacity_overview ---
  const overBudget = initiatives.filter((i) => computeBudgetDeviation(i) > 10);
  if (overBudget.length > 0) {
    const maxDev = Math.max(...overBudget.map((i) => computeBudgetDeviation(i)));
    results.push({
      sectionKey: 'budget_capacity_overview',
      status: maxDev > 25 ? 'red' : 'amber',
      reason: `${overBudget.length} initiative(s) over budget (max ${Math.round(maxDev)}%)`,
      dataPoints: [{ metric: 'max_budget_deviation', value: Math.round(maxDev), threshold: 10 }],
    });
  } else {
    results.push({
      sectionKey: 'budget_capacity_overview',
      status: 'green',
      reason: 'All within budget',
    });
  }

  // --- escalated_risks ---
  const escalatedRisks = escalations.filter((e) => e.daysBlocked && e.daysBlocked > 7);
  if (escalatedRisks.length > 0) {
    results.push({
      sectionKey: 'escalated_risks',
      status: escalatedRisks.length > 2 ? 'red' : 'amber',
      reason: `${escalatedRisks.length} risk(s) escalated`,
    });
  } else {
    results.push({
      sectionKey: 'escalated_risks',
      status: 'green',
      reason: 'No escalated risks',
    });
  }

  logger.info('[RagLogic] R2 RAG computed', { organizationId, resultCount: results.length });
  return results;
}

// ==========================================
// R3: BENEFITS TRACKING RAG
// ==========================================

export async function computeR3Rag(
  organizationId: string,
  _periodFrom: string,
  _periodTo: string
): Promise<RagResult[]> {
  const results: RagResult[] = [];

  const initiatives = await dbAll<InitiativeRow>(
    `SELECT id, name, status, current_stage, priority,
            planned_start_date, planned_end_date, start_date, end_date,
            estimated_budget, cost_capex, cost_opex, expected_roi
     FROM initiatives
     WHERE organization_id = ?`,
    [organizationId]
  );

  // --- delivered_initiatives ---
  const completed = initiatives.filter(
    (i) => (i.status || '').toLowerCase() === 'completed' || (i.status || '').toLowerCase() === 'done'
  );
  const totalCount = initiatives.length || 1;
  const completionRate = (completed.length / totalCount) * 100;

  if (completionRate >= 100) {
    results.push({
      sectionKey: 'delivered_initiatives',
      status: 'green',
      reason: `All ${completed.length} initiatives delivered`,
    });
  } else if (completionRate >= 80) {
    results.push({
      sectionKey: 'delivered_initiatives',
      status: 'amber',
      reason: `${Math.round(completionRate)}% completion rate (${completed.length}/${initiatives.length})`,
      dataPoints: [{ metric: 'completion_rate', value: Math.round(completionRate), threshold: 100 }],
    });
  } else {
    results.push({
      sectionKey: 'delivered_initiatives',
      status: 'red',
      reason: `Only ${Math.round(completionRate)}% completion rate`,
      dataPoints: [{ metric: 'completion_rate', value: Math.round(completionRate), threshold: 80 }],
    });
  }

  // --- planned_vs_realized_benefits ---
  // Approximate: compare expected_roi vs budget utilisation
  const withRoi = initiatives.filter((i: any) => i.expected_roi != null && i.expected_roi > 0);
  const avgRoiAchievement = withRoi.length > 0
    ? withRoi.reduce((sum: number, i: any) => {
        const actual = (i.cost_capex || 0) + (i.cost_opex || 0);
        const target = i.estimated_budget || actual || 1;
        const efficiency = target > 0 ? ((i.expected_roi || 0) / target) * 100 : 100;
        return sum + Math.min(efficiency, 200);
      }, 0) / withRoi.length
    : 100;

  if (avgRoiAchievement >= 100) {
    results.push({
      sectionKey: 'planned_vs_realized_benefits',
      status: 'green',
      reason: 'Benefits on or above target',
    });
  } else if (avgRoiAchievement >= 80) {
    results.push({
      sectionKey: 'planned_vs_realized_benefits',
      status: 'amber',
      reason: `Benefits at ${Math.round(avgRoiAchievement)}% of target`,
      dataPoints: [{ metric: 'roi_achievement', value: Math.round(avgRoiAchievement), threshold: 100 }],
    });
  } else {
    results.push({
      sectionKey: 'planned_vs_realized_benefits',
      status: 'red',
      reason: `Benefits below target at ${Math.round(avgRoiAchievement)}%`,
      dataPoints: [{ metric: 'roi_achievement', value: Math.round(avgRoiAchievement), threshold: 80 }],
    });
  }

  // --- kpi_trends ---
  // Without a dedicated KPI table, derive from initiative health
  const healthyRatio = initiatives.length > 0
    ? initiatives.filter((i) => !isBlocked(i.status) && computeDelayDays(i) <= 0).length / initiatives.length
    : 1;

  if (healthyRatio >= 0.9) {
    results.push({ sectionKey: 'kpi_trends', status: 'green', reason: 'KPI trends healthy' });
  } else if (healthyRatio >= 0.7) {
    results.push({
      sectionKey: 'kpi_trends',
      status: 'amber',
      reason: `${Math.round(healthyRatio * 100)}% of initiatives healthy`,
    });
  } else {
    results.push({
      sectionKey: 'kpi_trends',
      status: 'red',
      reason: `Only ${Math.round(healthyRatio * 100)}% of initiatives healthy`,
    });
  }

  // --- financial_impact ---
  const overBudget = initiatives.filter((i) => computeBudgetDeviation(i) > 10);
  if (overBudget.length === 0) {
    results.push({ sectionKey: 'financial_impact', status: 'green', reason: 'Financial impact within bounds' });
  } else if (overBudget.length <= 2) {
    results.push({
      sectionKey: 'financial_impact',
      status: 'amber',
      reason: `${overBudget.length} initiative(s) over budget`,
    });
  } else {
    results.push({
      sectionKey: 'financial_impact',
      status: 'red',
      reason: `${overBudget.length} initiatives over budget`,
    });
  }

  logger.info('[RagLogic] R3 RAG computed', { organizationId, resultCount: results.length });
  return results;
}

// ==========================================
// R4: PORTFOLIO OVERVIEW RAG
// ==========================================

export async function computeR4Rag(organizationId: string): Promise<RagResult[]> {
  const results: RagResult[] = [];

  const initiatives = await dbAll<InitiativeRow>(
    `SELECT id, name, status, current_stage, priority,
            planned_start_date, planned_end_date, start_date, end_date,
            estimated_budget, cost_capex, cost_opex
     FROM initiatives
     WHERE organization_id = ?`,
    [organizationId]
  );

  const total = initiatives.length || 1;
  const blocked = initiatives.filter((i) => isBlocked(i.status));
  const onTrack = initiatives.filter(
    (i) => !isBlocked(i.status) && computeDelayDays(i) <= 0
  );
  const delayed = initiatives.filter(
    (i) => !isBlocked(i.status) && computeDelayDays(i) > 0
  );

  // --- status_distribution ---
  const blockedRatio = blocked.length / total;
  if (blockedRatio > 0.15) {
    results.push({
      sectionKey: 'status_distribution',
      status: 'red',
      reason: `${Math.round(blockedRatio * 100)}% of portfolio blocked`,
      dataPoints: [{ metric: 'blocked_ratio', value: Math.round(blockedRatio * 100), threshold: 15 }],
    });
  } else if (blockedRatio > 0.05) {
    results.push({
      sectionKey: 'status_distribution',
      status: 'amber',
      reason: `${blocked.length} blocked (${Math.round(blockedRatio * 100)}%)`,
    });
  } else {
    results.push({
      sectionKey: 'status_distribution',
      status: 'green',
      reason: `${onTrack.length}/${total} on track`,
    });
  }

  // --- budget_allocation ---
  const totalBudget = initiatives.reduce((s, i) => s + (i.estimated_budget || 0), 0);
  const totalActual = initiatives.reduce((s, i) => s + (i.cost_capex || 0) + (i.cost_opex || 0), 0);
  const portfolioDeviation = totalBudget > 0 ? ((totalActual - totalBudget) / totalBudget) * 100 : 0;

  if (portfolioDeviation > 15) {
    results.push({
      sectionKey: 'budget_allocation',
      status: 'red',
      reason: `Portfolio ${Math.round(portfolioDeviation)}% over budget`,
      dataPoints: [{ metric: 'portfolio_budget_deviation', value: Math.round(portfolioDeviation), threshold: 15 }],
    });
  } else if (portfolioDeviation > 5) {
    results.push({
      sectionKey: 'budget_allocation',
      status: 'amber',
      reason: `Portfolio ${Math.round(portfolioDeviation)}% over budget`,
    });
  } else {
    results.push({
      sectionKey: 'budget_allocation',
      status: 'green',
      reason: 'Budget allocation within bounds',
    });
  }

  // --- value_realized_vs_planned ---
  const completedCount = initiatives.filter(
    (i) => (i.status || '').toLowerCase() === 'completed' || (i.status || '').toLowerCase() === 'done'
  ).length;
  const valueRatio = (completedCount / total) * 100;

  if (valueRatio >= 80) {
    results.push({ sectionKey: 'value_realized_vs_planned', status: 'green', reason: 'Value delivery on track' });
  } else if (valueRatio >= 50) {
    results.push({
      sectionKey: 'value_realized_vs_planned',
      status: 'amber',
      reason: `${Math.round(valueRatio)}% value realized`,
    });
  } else {
    results.push({
      sectionKey: 'value_realized_vs_planned',
      status: 'red',
      reason: `Only ${Math.round(valueRatio)}% value realized`,
    });
  }

  // --- risk_exposure ---
  const highPriority = initiatives.filter(
    (i) => i.priority === 'high' || i.priority === 'critical'
  );
  const riskyHigh = highPriority.filter(
    (i) => isBlocked(i.status) || computeDelayDays(i) > 7
  );

  if (riskyHigh.length > 2) {
    results.push({
      sectionKey: 'risk_exposure',
      status: 'red',
      reason: `${riskyHigh.length} high-priority initiatives at risk`,
    });
  } else if (riskyHigh.length > 0) {
    results.push({
      sectionKey: 'risk_exposure',
      status: 'amber',
      reason: `${riskyHigh.length} high-priority initiative(s) at risk`,
    });
  } else {
    results.push({ sectionKey: 'risk_exposure', status: 'green', reason: 'Risk exposure manageable' });
  }

  // --- timeline_heatmap ---
  const delayedRatio = delayed.length / total;
  if (delayedRatio > 0.3) {
    results.push({
      sectionKey: 'timeline_heatmap',
      status: 'red',
      reason: `${Math.round(delayedRatio * 100)}% of portfolio delayed`,
    });
  } else if (delayedRatio > 0.1) {
    results.push({
      sectionKey: 'timeline_heatmap',
      status: 'amber',
      reason: `${delayed.length} initiative(s) delayed`,
    });
  } else {
    results.push({ sectionKey: 'timeline_heatmap', status: 'green', reason: 'Timeline on track' });
  }

  logger.info('[RagLogic] R4 RAG computed', { organizationId, resultCount: results.length });
  return results;
}

// ==========================================
// R1 → R2 AUTO-ESCALATION TRIGGER (G7)
// ==========================================

export interface EscalationTrigger {
  shouldEscalate: boolean;
  severity: 'critical' | 'warning' | 'none';
  reasons: string[];
  suggestedReportType: 'R2' | null;
  blockedInitiatives: number;
  overdueDecisions: number;
  budgetDeviations: number;
}

/**
 * Evaluate whether an R1 report's data warrants automatic escalation to R2.
 * Called after R1 RAG computation to check escalation thresholds.
 */
export async function evaluateR1EscalationTrigger(
  organizationId: string,
  periodFrom: string,
  periodTo: string
): Promise<EscalationTrigger> {
  const result: EscalationTrigger = {
    shouldEscalate: false,
    severity: 'none',
    reasons: [],
    suggestedReportType: null,
    blockedInitiatives: 0,
    overdueDecisions: 0,
    budgetDeviations: 0,
  };

  const initiatives = await dbAll<InitiativeRow>(
    `SELECT id, name, status, current_stage, priority,
            planned_start_date, planned_end_date, start_date, end_date,
            estimated_budget, cost_capex, cost_opex
     FROM initiatives
     WHERE organization_id = ?`,
    [organizationId]
  );

  const blocked = initiatives.filter((i) => isBlocked(i.status));
  result.blockedInitiatives = blocked.length;

  const overBudget = initiatives.filter((i) => computeBudgetDeviation(i) > 10);
  result.budgetDeviations = overBudget.length;

  const overdueDecisions = await dbAll<{ id: string }>(
    `SELECT id FROM tasks
     WHERE organization_id = ?
       AND task_type IN ('decision', 'change_request')
       AND status NOT IN ('done', 'completed', 'cancelled')
       AND due_date < datetime('now')`,
    [organizationId]
  );
  result.overdueDecisions = overdueDecisions.length;

  // Critical escalation: any blocked >7 days or budget deviation >25%
  const longBlocked = blocked.filter((i) => computeDelayDays(i) > 7);
  const severeOverBudget = initiatives.filter((i) => computeBudgetDeviation(i) > 25);

  if (longBlocked.length > 0) {
    result.reasons.push(`${longBlocked.length} initiative(s) blocked for >7 days`);
  }
  if (severeOverBudget.length > 0) {
    result.reasons.push(`${severeOverBudget.length} initiative(s) with >25% budget deviation`);
  }
  if (overdueDecisions.length >= 3) {
    result.reasons.push(`${overdueDecisions.length} overdue decisions requiring steering committee attention`);
  }

  // Warning escalation: multiple amber signals
  if (blocked.length >= 2) {
    result.reasons.push(`${blocked.length} blocked initiatives`);
  }
  if (overBudget.length >= 3) {
    result.reasons.push(`${overBudget.length} initiatives over budget`);
  }

  // Determine severity
  if (longBlocked.length > 0 || severeOverBudget.length > 0 || overdueDecisions.length >= 3) {
    result.shouldEscalate = true;
    result.severity = 'critical';
    result.suggestedReportType = 'R2';
  } else if (blocked.length >= 2 || overBudget.length >= 3 || overdueDecisions.length >= 2) {
    result.shouldEscalate = true;
    result.severity = 'warning';
    result.suggestedReportType = 'R2';
  }

  logger.info('[RagLogic] R1→R2 escalation evaluated', {
    organizationId,
    shouldEscalate: result.shouldEscalate,
    severity: result.severity,
    reasons: result.reasons.length,
  });

  return result;
}

// ==========================================
// MAIN DISPATCHER
// ==========================================

/**
 * Compute RAG for all sections of a given report.
 * Reads report_type_v3 from the report record and dispatches to the correct compute function.
 * Updates section RAG status in database.
 */
export async function computeRagForReport(
  reportId: string,
  organizationId: string
): Promise<RagResult[]> {
  const report = await dbGet<{
    report_type_v3: string | null;
    period_from: string | null;
    period_to: string | null;
  }>(
    `SELECT report_type_v3, period_from, period_to
     FROM report_builder_reports
     WHERE id = ? AND organization_id = ?`,
    [reportId, organizationId]
  );

  if (!report) {
    logger.warn('[RagLogic] Report not found', { reportId, organizationId });
    return [];
  }

  const reportType = (report.report_type_v3 || '').toUpperCase();
  const periodFrom = report.period_from || new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const periodTo = report.period_to || new Date().toISOString();

  let results: RagResult[] = [];

  switch (reportType) {
    case 'R1':
      results = await computeR1Rag(organizationId, periodFrom, periodTo);
      break;
    case 'R2':
      results = await computeR2Rag(organizationId, periodFrom, periodTo);
      break;
    case 'R3':
      results = await computeR3Rag(organizationId, periodFrom, periodTo);
      break;
    case 'R4':
      results = await computeR4Rag(organizationId);
      break;
    default:
      logger.info('[RagLogic] No RAG logic for report type, skipping', { reportId, reportType });
      return [];
  }

  // Persist RAG status on each section
  for (const rag of results) {
    await dbRun(
      `UPDATE report_builder_sections
       SET rag = ?
       WHERE report_id = ? AND section_key = ?`,
      [rag.status, reportId, rag.sectionKey]
    );
  }

  logger.info('[RagLogic] RAG persisted', { reportId, reportType, count: results.length });
  return results;
}
