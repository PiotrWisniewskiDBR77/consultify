import { stableHeuristicId } from './idFactory.js';
import type { HeuristicInput, HeuristicOutput } from './types.js';

let seqId = 0;
const uid = (prefix: string) => `${prefix}-${Date.now()}-${++seqId}`;

export function analyzeBlockers(input: HeuristicInput): HeuristicOutput {
  const observations: HeuristicOutput['observations'] = [];
  const insights: HeuristicOutput['insights'] = [];
  const effects: HeuristicOutput['effects'] = [];
  const suggestions: HeuristicOutput['suggestions'] = [];

  const { controlTowerQueues, controlTowerCounts, riskSignals } = input;

  const blockedItems = controlTowerQueues['blocked'] || [];
  const blockedCount = controlTowerCounts['blocked'] || 0;
  const highRisks = riskSignals.filter(
    (r: any) => r.severity === 'CRITICAL' || r.severity === 'HIGH'
  );

  // Classify blocker types
  const byType: Record<string, any[]> = {
    dependency: [],
    decision: [],
    owner_gap: [],
    status: [],
    external: [],
  };
  for (const item of blockedItems) {
    for (const w of item.why || []) {
      if (w.kind === 'dependency') {
        byType.dependency.push(item);
      } else if (w.detail?.toLowerCase().includes('decision')) {
        byType.decision.push(item);
      } else if (w.kind === 'status') {
        byType.status.push(item);
      } else {
        byType.external.push(item);
      }
    }
  }

  // Observations
  if (blockedCount > 0) {
    observations.push({
      id: uid('obs-blk'),
      metric: `${blockedCount} blocked items total`,
      scope: 'portfolio',
      trend: blockedCount > 5 ? 'rising' : 'stable',
      severity: blockedCount > 5 ? 'critical' : 'warning',
    });
  }

  if (byType.dependency.length > 0) {
    observations.push({
      id: uid('obs-blk'),
      metric: `${byType.dependency.length} dependency-blocked items`,
      scope: 'initiative',
      trend: 'stable',
      severity: 'warning',
    });
  }

  if (byType.decision.length > 0) {
    observations.push({
      id: uid('obs-blk'),
      metric: `${byType.decision.length} decision-blocked items`,
      scope: 'decision',
      trend: 'rising',
      severity: 'critical',
    });
  }

  if (highRisks.length > 0) {
    observations.push({
      id: uid('obs-blk'),
      metric: `${highRisks.length} critical/high risk signals`,
      scope: 'portfolio',
      trend: highRisks.length > 3 ? 'rising' : 'stable',
      severity: 'critical',
    });
  }

  // Compute blocked age for items in late queue
  const lateBlocked = blockedItems.filter((i: any) =>
    i.why?.some((w: any) => w.kind === 'delay' || w.detail?.includes('przeszłości'))
  );
  if (lateBlocked.length > 0) {
    observations.push({
      id: uid('obs-blk'),
      metric: `${lateBlocked.length} blocked items also overdue`,
      scope: 'portfolio',
      trend: 'rising',
      severity: 'critical',
    });
  }

  // Insights
  if (byType.dependency.length > 0 && byType.decision.length > 0) {
    const insId = uid('ins-blk');
    insights.push({
      id: insId,
      observationIds: observations.map((o) => o.id),
      interpretation: `Blockers are mixed: ${byType.dependency.length} dependency + ${byType.decision.length} decision — both operational and governance root causes`,
      isSystemic: true,
      requiresAction: true,
      confidence: 'high',
    });

    const totalAffected = blockedItems.reduce(
      (sum: number, i: any) => sum + (i.affectsNext?.length || 0),
      0
    );
    effects.push({
      id: uid('eff-blk'),
      insightId: insId,
      consequence: `${totalAffected} downstream items at risk from blocked work`,
      blastRadius: totalAffected,
      timelineImpact: 'Milestones depending on blocked items will slip',
    });
  } else if (blockedCount > 3) {
    const insId = uid('ins-blk');
    const primaryType = Object.entries(byType).sort(([, a], [, b]) => b.length - a.length)[0];
    insights.push({
      id: insId,
      observationIds: observations.map((o) => o.id),
      interpretation: `Primary blocker root cause: ${primaryType?.[0] || 'unknown'} (${primaryType?.[1]?.length || 0} items)`,
      isSystemic: blockedCount > 5,
      requiresAction: true,
      confidence: 'medium',
    });

    effects.push({
      id: uid('eff-blk'),
      insightId: insId,
      consequence: `Blocked work creates cascading delays across ${blockedCount} items`,
      blastRadius: blockedCount * 2,
    });
  }

  // Suggestions
  if (byType.dependency.length > 0) {
    suggestions.push({
      id: stableHeuristicId('sug-blk', 'dependency-unblock'),
      action: `Unblock ${byType.dependency.length} dependency-blocked items`,
      reason: 'Predecessors need to be completed or dependencies need to be restructured',
      expectedOutcome: 'Blocked items can resume progress',
      cost: 'Medium',
      feasibility: 'immediate',
      requiresApproval: false,
      category: 'operational',
    });

    suggestions.push({
      id: stableHeuristicId('sug-blk', 'create-workarounds'),
      action: 'Create workarounds for high-priority blocked items',
      reason: 'Some blockers can be circumvented with alternative approaches',
      expectedOutcome: 'Reduces blocked queue without waiting for full unblock',
      cost: 'Medium',
      feasibility: 'manager_decision',
      requiresApproval: true,
      category: 'operational',
    });
  }

  if (byType.decision.length > 0) {
    suggestions.push({
      id: stableHeuristicId('sug-blk', 'decision-escalation'),
      action: `Escalate ${byType.decision.length} decision-blocked items`,
      reason: 'Governance decisions are holding up execution',
      expectedOutcome: 'Decision-blocked items unblocked within 48h',
      cost: 'Low',
      feasibility: 'manager_decision',
      requiresApproval: true,
      category: 'governance',
    });
  }

  if (blockedCount > 5) {
    suggestions.push({
      id: stableHeuristicId('sug-blk', 'formal-risk-response-plan'),
      action: 'Create formal risk response plan for blocked portfolio segment',
      reason: `${blockedCount} blocked items is systemic — needs structured resolution`,
      expectedOutcome: 'Coordinated unblock across multiple root causes',
      cost: 'High',
      feasibility: 'manager_decision',
      requiresApproval: true,
      category: 'governance',
    });
  }

  if (highRisks.length > 3) {
    suggestions.push({
      id: stableHeuristicId('sug-blk', 'scope-reduction'),
      action: 'Accept scope reduction for lowest-priority blocked initiatives',
      reason: 'Unblocking everything may exceed capacity — prioritize critical path',
      expectedOutcome: 'Focus recovery on highest-value items',
      cost: 'High',
      feasibility: 'leadership_decision',
      requiresApproval: true,
      category: 'governance',
    });
  }

  return { observations, insights, effects, suggestions };
}
