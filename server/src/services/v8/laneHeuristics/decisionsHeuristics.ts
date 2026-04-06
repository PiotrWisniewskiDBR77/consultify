import { stableHeuristicId } from './idFactory.js';
import type { HeuristicInput, HeuristicOutput } from './types.js';

let seqId = 0;
const uid = (prefix: string) => `${prefix}-${Date.now()}-${++seqId}`;

export function analyzeDecisions(input: HeuristicInput): HeuristicOutput {
  const observations: HeuristicOutput['observations'] = [];
  const insights: HeuristicOutput['insights'] = [];
  const effects: HeuristicOutput['effects'] = [];
  const suggestions: HeuristicOutput['suggestions'] = [];

  const { decisions, controlTowerCounts } = input;

  const pending = decisions.filter((d: any) => String(d.status).toUpperCase() === 'PENDING');
  const overdue = decisions.filter((d: any) => {
    if (!d.dueDate) return false;
    return new Date(d.dueDate).getTime() < Date.now() && String(d.status).toUpperCase() === 'PENDING';
  });
  const noOwner = pending.filter((d: any) => !d.ownerName && !d.ownerId);
  const noDate = pending.filter((d: any) => !d.dueDate);

  // Compute avg latency (days pending)
  const now = Date.now();
  const latencies = pending
    .filter((d: any) => d.createdAt)
    .map((d: any) => Math.floor((now - new Date(d.createdAt).getTime()) / 86400000));
  const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length) : 0;

  // Observations
  if (pending.length > 0) {
    observations.push({
      id: uid('obs-dec'),
      metric: `${pending.length} pending decisions`,
      scope: 'decision',
      trend: pending.length > 10 ? 'rising' : 'stable',
      severity: pending.length > 10 ? 'warning' : 'info',
    });
  }

  if (overdue.length > 0) {
    observations.push({
      id: uid('obs-dec'),
      metric: `${overdue.length} overdue decisions`,
      scope: 'decision',
      trend: 'rising',
      severity: 'critical',
    });
  }

  if (avgLatency > 7) {
    observations.push({
      id: uid('obs-dec'),
      metric: `Average decision latency: ${avgLatency} days`,
      scope: 'portfolio',
      trend: avgLatency > 14 ? 'rising' : 'stable',
      severity: avgLatency > 14 ? 'critical' : 'warning',
    });
  }

  if (noOwner.length > 0) {
    observations.push({
      id: uid('obs-dec'),
      metric: `${noOwner.length} decisions without approver`,
      scope: 'decision',
      trend: 'stable',
      severity: 'warning',
    });
  }

  if (noDate.length > 0) {
    observations.push({
      id: uid('obs-dec'),
      metric: `${noDate.length} decisions without due date`,
      scope: 'decision',
      trend: 'stable',
      severity: noDate.length > 5 ? 'warning' : 'info',
    });
  }

  // Insights
  if (overdue.length > 0) {
    // Bottleneck analysis
    const byOwner: Record<string, number> = {};
    overdue.forEach((d: any) => {
      const owner = d.ownerName || 'Unassigned';
      byOwner[owner] = (byOwner[owner] || 0) + 1;
    });
    const topApprover = Object.entries(byOwner).sort(([,a],[,b]) => b - a)[0];

    const insId = uid('ins-dec');
    insights.push({
      id: insId,
      observationIds: observations.filter((o) => o.metric.includes('overdue')).map((o) => o.id),
      interpretation: topApprover && topApprover[1] > 1
        ? `Decision bottleneck: ${topApprover[0]} has ${topApprover[1]} overdue decisions — governance process may need parallel paths`
        : `${overdue.length} decision(s) overdue — blocking downstream execution`,
      isSystemic: overdue.length > 3,
      requiresAction: true,
      confidence: 'high',
    });

    const blocked = controlTowerCounts['blocked'] || 0;
    effects.push({
      id: uid('eff-dec'),
      insightId: insId,
      consequence: `${blocked} items potentially blocked by pending decisions`,
      blastRadius: overdue.length * 3,
      timelineImpact: `~${avgLatency} days added to blocked work`,
    });
  }

  if (avgLatency > 14) {
    const insId = uid('ins-dec');
    insights.push({
      id: insId,
      observationIds: observations.filter((o) => o.metric.includes('latency')).map((o) => o.id),
      interpretation: 'Decision governance cadence is too slow for execution pace — structural review needed',
      isSystemic: true,
      requiresAction: true,
      confidence: 'medium',
    });

    effects.push({
      id: uid('eff-dec'),
      insightId: insId,
      consequence: 'Chronic decision latency erodes sponsor trust and delivery predictability',
      blastRadius: pending.length,
    });
  }

  // Suggestions
  if (overdue.length > 0) {
    suggestions.push({
      id: stableHeuristicId('sug-dec', 'request-missing-info'),
      action: `Request missing info for ${overdue.length} overdue decisions`,
      reason: 'Decisions may be stalled due to insufficient preparation materials',
      expectedOutcome: 'Approvers can make informed decisions faster',
      cost: 'Low',
      feasibility: 'immediate',
      requiresApproval: false,
      category: 'governance',
    });
  }

  if (noOwner.length > 0) {
    suggestions.push({
      id: stableHeuristicId('sug-dec', 'assign-approvers'),
      action: `Assign approvers to ${noOwner.length} decisions`,
      reason: 'Orphaned decisions have no one to approve them',
      expectedOutcome: 'Clear decision routing',
      cost: 'Low',
      feasibility: 'immediate',
      requiresApproval: false,
      category: 'governance',
    });
  }

  if (overdue.length > 3) {
    suggestions.push({
      id: stableHeuristicId('sug-dec', 'assign-substitute-approvers'),
      action: 'Assign substitute approvers for overdue decisions',
      reason: 'Current approvers are a bottleneck — delegate to available decision-makers',
      expectedOutcome: 'Reduces decision queue by 50%+',
      cost: 'Low',
      feasibility: 'manager_decision',
      requiresApproval: true,
      category: 'governance',
    });
  }

  if (avgLatency > 14) {
    suggestions.push({
      id: stableHeuristicId('sug-dec', 'weekly-governance-cadence'),
      action: 'Change governance cadence to weekly decision reviews',
      reason: 'Bi-weekly or ad-hoc cadence causes structural latency',
      expectedOutcome: 'Decision latency drops below 7 days',
      cost: 'Medium',
      feasibility: 'leadership_decision',
      requiresApproval: true,
      category: 'governance',
    });
  }

  return { observations, insights, effects, suggestions };
}
