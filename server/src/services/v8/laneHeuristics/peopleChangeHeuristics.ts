import { stableHeuristicId } from './idFactory.js';
import type { HeuristicInput, HeuristicOutput } from './types.js';

let seqId = 0;
const uid = (prefix: string) => `${prefix}-${Date.now()}-${++seqId}`;

export function analyzePeopleChange(input: HeuristicInput): HeuristicOutput {
  const observations: HeuristicOutput['observations'] = [];
  const insights: HeuristicOutput['insights'] = [];
  const effects: HeuristicOutput['effects'] = [];
  const suggestions: HeuristicOutput['suggestions'] = [];

  const { initiatives, tasks, decisions } = input;

  const active = initiatives.filter(
    (i: any) => !['DONE', 'CANCELLED', 'ARCHIVED', 'DRAFT'].includes(String(i.status).toUpperCase())
  );

  const noOwner = active.filter((i: any) => !i.owner_execution_id && !i.ownerId && !i.assigneeId);
  const noDate = active.filter((i: any) => !i.planned_end_date && !i.sla_deadline);
  const noStart = active.filter((i: any) => !i.planned_start_date && !i.start_date);

  // Ownership diversity: how many unique owners across active initiatives?
  const owners = new Set(active.map((i: any) => i.owner_execution_id || i.ownerId).filter(Boolean));
  const ownerCount = owners.size;
  const ownerClarityPct =
    active.length > 0 ? Math.round(((active.length - noOwner.length) / active.length) * 100) : 100;

  // Tasks without assignees
  const activeTasks = tasks.filter(
    (t: any) => !['DONE', 'CANCELLED', 'COMPLETED'].includes(String(t.status).toUpperCase())
  );
  const unownedTasks = activeTasks.filter((t: any) => !t.assignee_id);

  // Observations
  if (noOwner.length > 0) {
    observations.push({
      id: uid('obs-pc'),
      metric: `${noOwner.length} initiatives without owner`,
      scope: 'initiative',
      trend: noOwner.length > 3 ? 'rising' : 'stable',
      severity: noOwner.length > 5 ? 'critical' : 'warning',
    });
  }

  if (noDate.length > 0) {
    observations.push({
      id: uid('obs-pc'),
      metric: `${noDate.length} initiatives without target date`,
      scope: 'initiative',
      trend: 'stable',
      severity: noDate.length > 5 ? 'warning' : 'info',
    });
  }

  if (unownedTasks.length > 5) {
    observations.push({
      id: uid('obs-pc'),
      metric: `${unownedTasks.length} tasks without assignee`,
      scope: 'task',
      trend: 'stable',
      severity: unownedTasks.length > 15 ? 'critical' : 'warning',
    });
  }

  observations.push({
    id: uid('obs-pc'),
    metric: `Ownership clarity: ${ownerClarityPct}% (${ownerCount} unique owners)`,
    scope: 'portfolio',
    trend: ownerClarityPct < 70 ? 'rising' : 'improving',
    severity: ownerClarityPct < 50 ? 'critical' : ownerClarityPct < 80 ? 'warning' : 'info',
  });

  // Look for steerco/communication gaps
  const pendingDecisions = decisions.filter(
    (d: any) => String(d.status).toUpperCase() === 'PENDING'
  );

  // Insights
  if (noOwner.length > 3) {
    const insId = uid('ins-pc');
    insights.push({
      id: insId,
      observationIds: observations.filter((o) => o.metric.includes('owner')).map((o) => o.id),
      interpretation:
        'Significant ownership gap — initiatives without owners create decision vacuum and accountability void',
      isSystemic: true,
      requiresAction: true,
      confidence: 'high',
    });

    effects.push({
      id: uid('eff-pc'),
      insightId: insId,
      consequence: `${noOwner.length} initiatives drift without accountability — risk of scope creep and delayed decisions`,
      blastRadius: noOwner.length * 3,
      timelineImpact: 'Unowned initiatives average 2x longer to deliver',
    });
  }

  if (ownerClarityPct < 60) {
    const insId = uid('ins-pc');
    insights.push({
      id: insId,
      observationIds: observations.filter((o) => o.metric.includes('clarity')).map((o) => o.id),
      interpretation:
        'Low ownership clarity across portfolio — governance and communication structures need reinforcement',
      isSystemic: true,
      requiresAction: true,
      confidence: 'medium',
    });

    effects.push({
      id: uid('eff-pc'),
      insightId: insId,
      consequence: 'Adoption risk increases — stakeholders lack clear accountability chain',
      blastRadius: Math.round(active.length * 0.4),
    });
  }

  if (ownerCount === 1 && active.length > 5) {
    insights.push({
      id: uid('ins-pc'),
      observationIds: observations.map((o) => o.id),
      interpretation:
        'Single point of failure: all initiatives owned by one person — bottleneck and bus-factor risk',
      isSystemic: true,
      requiresAction: true,
      confidence: 'high',
    });
  }

  // Suggestions
  if (noOwner.length > 0) {
    suggestions.push({
      id: stableHeuristicId('sug-pc', 'assign-initiative-owners'),
      action: `Assign owners to ${noOwner.length} initiatives`,
      reason: 'Unowned initiatives lack accountability',
      expectedOutcome: 'Clear responsibility for delivery and decision-making',
      cost: 'Low',
      feasibility: 'immediate',
      requiresApproval: false,
      category: 'governance',
    });
  }

  if (unownedTasks.length > 5) {
    suggestions.push({
      id: stableHeuristicId('sug-pc', 'assign-task-owners'),
      action: `Assign ${unownedTasks.length} tasks to team members`,
      reason: 'Unassigned tasks are invisible to workload and progress tracking',
      expectedOutcome: 'Full workload visibility and progress accountability',
      cost: 'Low',
      feasibility: 'immediate',
      requiresApproval: false,
      category: 'operational',
    });
  }

  if (ownerClarityPct < 60) {
    suggestions.push({
      id: stableHeuristicId('sug-pc', 'update-raci'),
      action: 'Update stakeholder map and RACI matrix',
      reason: 'Low ownership clarity indicates incomplete governance mapping',
      expectedOutcome: 'Clear roles and responsibilities for all active work',
      cost: 'Medium',
      feasibility: 'manager_decision',
      requiresApproval: true,
      category: 'governance',
    });
  }

  if (active.length > 10 && pendingDecisions.length > 5) {
    suggestions.push({
      id: stableHeuristicId('sug-pc', 'launch-steerco-cadence'),
      action: 'Launch regular communication/steerco cadence',
      reason: 'Large portfolio with many pending decisions needs structured alignment',
      expectedOutcome: 'Stakeholder alignment, faster decisions, reduced governance gaps',
      cost: 'Medium',
      feasibility: 'manager_decision',
      requiresApproval: true,
      category: 'governance',
    });
  }

  if (ownerCount === 1 && active.length > 5) {
    suggestions.push({
      id: stableHeuristicId('sug-pc', 'distribute-ownership'),
      action: 'Add change manager or distribute ownership',
      reason: 'Single owner for 5+ initiatives is unsustainable',
      expectedOutcome: 'Reduced bus-factor risk and better attention per initiative',
      cost: 'High',
      feasibility: 'leadership_decision',
      requiresApproval: true,
      category: 'organizational',
    });
  }

  return { observations, insights, effects, suggestions };
}
