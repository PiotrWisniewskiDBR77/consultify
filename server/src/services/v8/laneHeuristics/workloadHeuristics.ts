import { stableHeuristicId } from './idFactory.js';
import type { HeuristicInput, HeuristicOutput } from './types.js';

let seqId = 0;
const uid = (prefix: string) => `${prefix}-${Date.now()}-${++seqId}`;

export function analyzeWorkload(input: HeuristicInput): HeuristicOutput {
  const observations: HeuristicOutput['observations'] = [];
  const insights: HeuristicOutput['insights'] = [];
  const effects: HeuristicOutput['effects'] = [];
  const suggestions: HeuristicOutput['suggestions'] = [];

  const { tasks, capacityAlerts, controlTowerCounts } = input;

  // Build per-person workload
  const assignees: Record<
    string,
    { total: number; done: number; blocked: number; inProgress: number; noEstimate: number }
  > = {};
  tasks.forEach((t: any) => {
    const a = t.assigneeName || t.assignee_id || 'Unassigned';
    if (!assignees[a])
      assignees[a] = { total: 0, done: 0, blocked: 0, inProgress: 0, noEstimate: 0 };
    assignees[a].total++;
    const s = String(t.status).toUpperCase();
    if (s === 'DONE' || s === 'COMPLETED') assignees[a].done++;
    if (s === 'BLOCKED') assignees[a].blocked++;
    if (s === 'IN_PROGRESS') assignees[a].inProgress++;
    if (!t.estimated_hours) assignees[a].noEstimate++;
  });

  const sorted = Object.entries(assignees).sort(([, a], [, b]) => b.total - a.total);
  const overloaded = sorted.filter(([, s]) => s.total > 10);
  const underloaded = sorted.filter(([n, s]) => n !== 'Unassigned' && s.total < 3 && s.total > 0);
  const unassignedCount = assignees['Unassigned']?.total || 0;
  const noEstimateTasks = tasks.filter(
    (t: any) =>
      !t.estimated_hours &&
      !['DONE', 'CANCELLED', 'COMPLETED'].includes(String(t.status).toUpperCase())
  );
  const overloadedCount = controlTowerCounts['overloaded'] || 0;

  // Observations
  if (overloaded.length > 0) {
    overloaded.slice(0, 3).forEach(([name, stats]) => {
      observations.push({
        id: uid('obs-wl'),
        metric: `${name}: ${stats.total} tasks (${stats.inProgress} in progress)`,
        scope: 'owner',
        trend: stats.total > 15 ? 'rising' : 'stable',
        severity: stats.total > 15 ? 'critical' : 'warning',
        entityName: name,
      });
    });
  }

  if (capacityAlerts.length > 0) {
    observations.push({
      id: uid('obs-wl'),
      metric: `${capacityAlerts.length} capacity leveling alerts`,
      scope: 'team',
      trend: 'rising',
      severity: capacityAlerts.some((a: any) => a.severity === 'critical') ? 'critical' : 'warning',
    });
  }

  if (unassignedCount > 5) {
    observations.push({
      id: uid('obs-wl'),
      metric: `${unassignedCount} unassigned tasks`,
      scope: 'portfolio',
      trend: 'stable',
      severity: 'warning',
    });
  }

  if (noEstimateTasks.length > 10) {
    observations.push({
      id: uid('obs-wl'),
      metric: `${noEstimateTasks.length} tasks without time estimates`,
      scope: 'portfolio',
      trend: 'stable',
      severity: 'warning',
    });
  }

  // Insights
  if (overloaded.length > 0 && underloaded.length > 0) {
    const insId = uid('ins-wl');
    insights.push({
      id: insId,
      observationIds: observations.map((o) => o.id),
      interpretation: `Workload imbalance: ${overloaded.length} overloaded + ${underloaded.length} underloaded people — reallocation potential exists`,
      isSystemic: true,
      requiresAction: true,
      confidence: 'high',
    });

    effects.push({
      id: uid('eff-wl'),
      insightId: insId,
      consequence: `Overloaded team members risk slippage on ${overloaded.reduce((s, [, v]) => s + v.inProgress, 0)} in-progress tasks`,
      blastRadius: overloaded.reduce((s, [, v]) => s + v.total, 0),
      timelineImpact: 'Expected 1-2 week delay on overloaded work',
    });
  } else if (overloaded.length > 0) {
    const insId = uid('ins-wl');
    insights.push({
      id: insId,
      observationIds: observations.map((o) => o.id),
      interpretation: `Structural overload: ${overloaded.length} people with 10+ tasks — no internal rebalancing possible`,
      isSystemic: true,
      requiresAction: true,
      confidence: 'high',
    });

    effects.push({
      id: uid('eff-wl'),
      insightId: insId,
      consequence: 'Burnout risk and quality degradation on overloaded work',
      blastRadius: overloaded.reduce((s, [, v]) => s + v.total, 0),
      timelineImpact: 'Ongoing slippage without intervention',
    });
  }

  if (noEstimateTasks.length > tasks.length * 0.3) {
    insights.push({
      id: uid('ins-wl'),
      observationIds: observations.filter((o) => o.metric.includes('estimate')).map((o) => o.id),
      interpretation:
        'Over 30% of tasks lack estimates — overload analysis may be significantly understated',
      isSystemic: true,
      requiresAction: true,
      confidence: 'low',
    });
  }

  // Suggestions
  if (overloaded.length > 0 && underloaded.length > 0) {
    const topOver = overloaded[0];
    const topUnder = underloaded[0];
    suggestions.push({
      id: stableHeuristicId('sug-wl', 'rebalance-top-overload'),
      action: `Reassign ${Math.min(3, topOver[1].total - 8)} tasks from ${topOver[0]} to ${topUnder[0]}`,
      reason: `${topOver[0]} is overloaded (${topOver[1].total} tasks); ${topUnder[0]} has capacity (${topUnder[1].total} tasks)`,
      expectedOutcome: 'Balanced workload, reduced slippage risk',
      cost: 'Low',
      feasibility: 'immediate',
      requiresApproval: false,
      category: 'operational',
    });
  }

  if (noEstimateTasks.length > 5) {
    suggestions.push({
      id: stableHeuristicId('sug-wl', 'add-estimates'),
      action: `Add time estimates to ${noEstimateTasks.length} tasks`,
      reason: 'Without estimates, capacity planning is unreliable',
      expectedOutcome: 'Accurate workload visibility and leveling',
      cost: 'Low',
      feasibility: 'immediate',
      requiresApproval: false,
      category: 'operational',
    });
  }

  if (overloaded.length > 2) {
    suggestions.push({
      id: stableHeuristicId('sug-wl', 'reduce-wip-limit'),
      action: 'Reduce WIP limit to 5 tasks per person',
      reason: 'Multiple people are overloaded — systemic WIP control needed',
      expectedOutcome: 'Focus on completion over starting new work',
      cost: 'Medium',
      feasibility: 'manager_decision',
      requiresApproval: true,
      category: 'operational',
    });

    suggestions.push({
      id: stableHeuristicId('sug-wl', 'smooth-delivery-schedule'),
      action: 'Smooth delivery schedule to spread work over longer horizon',
      reason: 'Current sprint/period has demand spike beyond capacity',
      expectedOutcome: 'Reduced overload without losing total throughput',
      cost: 'Medium',
      feasibility: 'manager_decision',
      requiresApproval: true,
      category: 'operational',
    });
  }

  if (overloaded.length > 3 && underloaded.length === 0) {
    suggestions.push({
      id: stableHeuristicId('sug-wl', 'hire-contractor'),
      action: 'Hire contractor or temporary resource',
      reason: 'No internal reallocation possible — all team members overloaded',
      expectedOutcome: 'Additional capacity to absorb workload peak',
      cost: 'High',
      feasibility: 'leadership_decision',
      requiresApproval: true,
      category: 'organizational',
    });
  }

  return { observations, insights, effects, suggestions };
}
