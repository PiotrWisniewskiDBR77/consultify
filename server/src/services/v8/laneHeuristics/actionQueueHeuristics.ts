import type { HeuristicInput, HeuristicOutput } from './types.js';

let seqId = 0;
const uid = (prefix: string) => `${prefix}-${Date.now()}-${++seqId}`;

export function analyzeActionQueue(input: HeuristicInput): HeuristicOutput {
  const observations: HeuristicOutput['observations'] = [];
  const insights: HeuristicOutput['insights'] = [];
  const effects: HeuristicOutput['effects'] = [];
  const suggestions: HeuristicOutput['suggestions'] = [];

  const { controlTowerQueues, controlTowerCounts, tasks, initiatives, decisions } = input;

  const lateCount = controlTowerCounts['late'] || 0;
  const blockedCount = controlTowerCounts['blocked'] || 0;
  const staleCount = controlTowerCounts['stale'] || 0;

  const overdueTasks = tasks.filter((t: any) => {
    if (!t.due_date) return false;
    return new Date(t.due_date).getTime() < Date.now() && !['DONE', 'CANCELLED', 'COMPLETED'].includes(String(t.status).toUpperCase());
  });

  const noDateTasks = tasks.filter((t: any) => !t.due_date && !['DONE', 'CANCELLED', 'COMPLETED'].includes(String(t.status).toUpperCase()));
  const unownedTasks = tasks.filter((t: any) => !t.assignee_id && !['DONE', 'CANCELLED', 'COMPLETED'].includes(String(t.status).toUpperCase()));

  const pendingDecisions = decisions.filter((d: any) => String(d.status).toUpperCase() === 'PENDING');
  const overdueDecisions = decisions.filter((d: any) => {
    if (!d.dueDate) return false;
    return new Date(d.dueDate).getTime() < Date.now() && String(d.status).toUpperCase() === 'PENDING';
  });

  // Observations
  if (overdueTasks.length > 0) {
    observations.push({
      id: uid('obs-aq'),
      metric: `${overdueTasks.length} overdue tasks`,
      scope: 'portfolio',
      trend: overdueTasks.length > 5 ? 'rising' : 'stable',
      severity: overdueTasks.length > 10 ? 'critical' : 'warning',
    });
  }

  if (noDateTasks.length > 0) {
    observations.push({
      id: uid('obs-aq'),
      metric: `${noDateTasks.length} tasks without due date`,
      scope: 'portfolio',
      trend: 'stable',
      severity: noDateTasks.length > 10 ? 'warning' : 'info',
    });
  }

  if (unownedTasks.length > 0) {
    observations.push({
      id: uid('obs-aq'),
      metric: `${unownedTasks.length} unassigned tasks`,
      scope: 'portfolio',
      trend: 'stable',
      severity: unownedTasks.length > 5 ? 'warning' : 'info',
    });
  }

  if (overdueDecisions.length > 0) {
    observations.push({
      id: uid('obs-aq'),
      metric: `${overdueDecisions.length} overdue decisions`,
      scope: 'decision',
      trend: 'rising',
      severity: 'critical',
    });
  }

  if (blockedCount > 0) {
    observations.push({
      id: uid('obs-aq'),
      metric: `${blockedCount} blocked items`,
      scope: 'portfolio',
      trend: 'stable',
      severity: blockedCount > 5 ? 'critical' : 'warning',
    });
  }

  if (staleCount > 0) {
    observations.push({
      id: uid('obs-aq'),
      metric: `${staleCount} stale items (no update ≥14d)`,
      scope: 'portfolio',
      trend: 'stable',
      severity: staleCount > 10 ? 'warning' : 'info',
    });
  }

  if (lateCount > 0) {
    observations.push({
      id: uid('obs-aq'),
      metric: `${lateCount} items in late queue`,
      scope: 'portfolio',
      trend: 'rising',
      severity: lateCount > 5 ? 'critical' : 'warning',
    });
  }

  // Insights
  if (overdueTasks.length > 5) {
    const byOwner: Record<string, number> = {};
    overdueTasks.forEach((t: any) => {
      const owner = t.assigneeName || t.assignee_id || 'Unassigned';
      byOwner[owner] = (byOwner[owner] || 0) + 1;
    });
    const topOwner = Object.entries(byOwner).sort(([,a],[,b]) => b - a)[0];
    if (topOwner && topOwner[1] > 2) {
      const insId = uid('ins-aq');
      insights.push({
        id: insId,
        observationIds: observations.filter((o) => o.metric.includes('overdue')).map((o) => o.id),
        interpretation: `Overdue pattern concentrates on ${topOwner[0]} (${topOwner[1]} tasks) — likely overload-driven`,
        isSystemic: true,
        requiresAction: true,
        confidence: 'high',
      });

      effects.push({
        id: uid('eff-aq'),
        insightId: insId,
        consequence: `Downstream tasks blocked by ${topOwner[0]}'s overdue work`,
        blastRadius: topOwner[1] * 2,
        timelineImpact: `≥1 week slip on dependent milestones`,
      });
    }
  }

  if (overdueDecisions.length > 0) {
    const insId = uid('ins-aq');
    insights.push({
      id: insId,
      observationIds: observations.filter((o) => o.metric.includes('decision')).map((o) => o.id),
      interpretation: `${overdueDecisions.length} decision(s) overdue — blocking downstream work`,
      isSystemic: overdueDecisions.length > 3,
      requiresAction: true,
      confidence: 'high',
    });

    effects.push({
      id: uid('eff-aq'),
      insightId: insId,
      consequence: `Initiatives stalled waiting for ${overdueDecisions.length} decision(s)`,
      blastRadius: overdueDecisions.length * 3,
    });
  }

  if (noDateTasks.length > 5) {
    insights.push({
      id: uid('ins-aq'),
      observationIds: observations.filter((o) => o.metric.includes('without due date')).map((o) => o.id),
      interpretation: 'Many tasks lack due dates — delivery forecasting is unreliable',
      isSystemic: true,
      requiresAction: true,
      confidence: 'medium',
    });
  }

  // Suggestions
  if (unownedTasks.length > 0) {
    suggestions.push({
      id: uid('sug-aq'),
      action: `Assign owners to ${unownedTasks.length} unassigned tasks`,
      reason: 'Unassigned tasks have no one responsible for completion',
      expectedOutcome: 'Clear ownership reduces dropped-ball risk',
      cost: 'Low',
      feasibility: 'immediate',
      requiresApproval: false,
      category: 'operational',
    });
  }

  if (noDateTasks.length > 0) {
    suggestions.push({
      id: uid('sug-aq'),
      action: `Set due dates for ${noDateTasks.length} tasks`,
      reason: 'Missing dates prevent accurate delivery forecasting',
      expectedOutcome: 'Enables delay detection and workload leveling',
      cost: 'Low',
      feasibility: 'immediate',
      requiresApproval: false,
      category: 'operational',
    });
  }

  if (overdueDecisions.length > 0) {
    suggestions.push({
      id: uid('sug-aq'),
      action: `Escalate ${overdueDecisions.length} overdue decisions`,
      reason: 'Decision latency is blocking execution progress',
      expectedOutcome: 'Unblocks downstream initiatives and tasks',
      cost: 'Low',
      feasibility: 'manager_decision',
      requiresApproval: true,
      category: 'governance',
    });
  }

  if (overdueTasks.length > 10) {
    suggestions.push({
      id: uid('sug-aq'),
      action: 'Review and replan severely overdue work items',
      reason: `${overdueTasks.length} tasks are overdue — systemic replanning needed`,
      expectedOutcome: 'Realistic delivery dates and reduced hidden backlog',
      cost: 'Medium',
      feasibility: 'manager_decision',
      requiresApproval: true,
      category: 'operational',
    });
  }

  return { observations, insights, effects, suggestions };
}
