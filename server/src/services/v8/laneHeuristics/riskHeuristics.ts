import type { HeuristicInput, HeuristicOutput } from './types.js';

let seqId = 0;
const uid = (prefix: string) => `${prefix}-${Date.now()}-${++seqId}`;

export function analyzeRisk(input: HeuristicInput): HeuristicOutput {
  const observations: HeuristicOutput['observations'] = [];
  const insights: HeuristicOutput['insights'] = [];
  const effects: HeuristicOutput['effects'] = [];
  const suggestions: HeuristicOutput['suggestions'] = [];

  const { riskSignals, delaySignals, controlTowerCounts, tasks, initiatives } = input;

  const criticalRisks = riskSignals.filter((r: any) => r.severity === 'CRITICAL');
  const highRisks = riskSignals.filter((r: any) => r.severity === 'HIGH');
  const criticalDelays = delaySignals.filter((d: any) => d.severity === 'CRITICAL');
  const lateCount = controlTowerCounts['late'] || 0;
  const blockedCount = controlTowerCounts['blocked'] || 0;
  const staleCount = controlTowerCounts['stale'] || 0;

  const noBaseline = initiatives.filter((i: any) =>
    !i.planned_end_date && !i.sla_deadline && !['DONE', 'CANCELLED', 'ARCHIVED', 'DRAFT'].includes(String(i.status).toUpperCase())
  );
  const noEstimate = tasks.filter((t: any) =>
    !t.estimated_hours && !['DONE', 'CANCELLED', 'COMPLETED'].includes(String(t.status).toUpperCase())
  );

  // Delivery confidence score (0-100)
  const totalItems = initiatives.length + tasks.length;
  const problemItems = lateCount + blockedCount + staleCount;
  const dataQualityPenalty = (noBaseline.length + noEstimate.length) * 2;
  const rawConfidence = totalItems > 0 ? Math.max(0, 100 - (problemItems / totalItems) * 100 - dataQualityPenalty) : 50;
  const confidence = Math.round(rawConfidence);

  // Observations
  if (riskSignals.length > 0) {
    observations.push({
      id: uid('obs-rsk'),
      metric: `${riskSignals.length} risk signals (${criticalRisks.length} critical, ${highRisks.length} high)`,
      scope: 'portfolio',
      trend: criticalRisks.length > 2 ? 'rising' : 'stable',
      severity: criticalRisks.length > 0 ? 'critical' : 'warning',
    });
  }

  if (delaySignals.length > 0) {
    observations.push({
      id: uid('obs-rsk'),
      metric: `${delaySignals.length} delay signals (${criticalDelays.length} critical)`,
      scope: 'portfolio',
      trend: criticalDelays.length > 2 ? 'rising' : 'stable',
      severity: criticalDelays.length > 0 ? 'critical' : 'warning',
    });
  }

  if (noBaseline.length > 0) {
    observations.push({
      id: uid('obs-rsk'),
      metric: `${noBaseline.length} initiatives without baseline dates`,
      scope: 'initiative',
      trend: 'stable',
      severity: noBaseline.length > 5 ? 'critical' : 'warning',
    });
  }

  if (staleCount > 0) {
    observations.push({
      id: uid('obs-rsk'),
      metric: `${staleCount} stale items (no update ≥14d)`,
      scope: 'portfolio',
      trend: 'stable',
      severity: staleCount > 10 ? 'warning' : 'info',
    });
  }

  observations.push({
    id: uid('obs-rsk'),
    metric: `Delivery confidence score: ${confidence}%`,
    scope: 'portfolio',
    trend: confidence < 50 ? 'rising' : confidence > 70 ? 'improving' : 'stable',
    severity: confidence < 40 ? 'critical' : confidence < 60 ? 'warning' : 'info',
  });

  // Insights
  const dataQualityIssues = noBaseline.length + noEstimate.length;
  const executionIssues = lateCount + blockedCount;

  if (dataQualityIssues > executionIssues && dataQualityIssues > 5) {
    const insId = uid('ins-rsk');
    insights.push({
      id: insId,
      observationIds: observations.map((o) => o.id),
      interpretation: 'Primary risk factor is data quality — missing baselines and estimates undermine all analytics',
      isSystemic: true,
      requiresAction: true,
      confidence: 'high',
    });

    effects.push({
      id: uid('eff-rsk'),
      insightId: insId,
      consequence: 'Risk signals may be understated; true delivery probability unknown',
      blastRadius: dataQualityIssues,
    });
  } else if (executionIssues > 5) {
    const insId = uid('ins-rsk');
    insights.push({
      id: insId,
      observationIds: observations.map((o) => o.id),
      interpretation: `Execution health degraded: ${lateCount} late + ${blockedCount} blocked items indicate systemic delivery risk`,
      isSystemic: true,
      requiresAction: true,
      confidence: 'high',
    });

    effects.push({
      id: uid('eff-rsk'),
      insightId: insId,
      consequence: `Probable delivery delay: ${Math.round(lateCount * 0.5)} days average slip across portfolio`,
      blastRadius: executionIssues,
      timelineImpact: `${lateCount} items already past deadline`,
    });
  }

  if (criticalRisks.length > 0) {
    const insId = uid('ins-rsk');
    insights.push({
      id: insId,
      observationIds: observations.filter((o) => o.metric.includes('risk signal')).map((o) => o.id),
      interpretation: `${criticalRisks.length} critical risk(s) require immediate attention — potential for scope/timeline impact`,
      isSystemic: false,
      requiresAction: true,
      confidence: 'high',
    });

    effects.push({
      id: uid('eff-rsk'),
      insightId: insId,
      consequence: 'Critical risks left unmitigated may cause milestone failure',
      blastRadius: criticalRisks.length * 5,
      costImpact: 'Budget overrun likely if risks materialize',
    });
  }

  // Suggestions
  if (noBaseline.length > 0) {
    suggestions.push({
      id: uid('sug-rsk'),
      action: `Set baseline dates for ${noBaseline.length} initiatives`,
      reason: 'Variance analysis impossible without baseline',
      expectedOutcome: 'Enables delivery confidence tracking',
      cost: 'Low',
      feasibility: 'immediate',
      requiresApproval: false,
      category: 'quality',
    });
  }

  if (criticalRisks.length > 0) {
    suggestions.push({
      id: uid('sug-rsk'),
      action: `Assign mitigation owners to ${criticalRisks.length} critical risks`,
      reason: 'Unowned risks have no one driving resolution',
      expectedOutcome: 'Active risk management for each critical item',
      cost: 'Low',
      feasibility: 'immediate',
      requiresApproval: false,
      category: 'governance',
    });
  }

  if (confidence < 50) {
    suggestions.push({
      id: uid('sug-rsk'),
      action: 'Create comprehensive risk management plan',
      reason: `Delivery confidence at ${confidence}% — structured risk response needed`,
      expectedOutcome: 'Systematic risk reduction with measurable targets',
      cost: 'Medium',
      feasibility: 'manager_decision',
      requiresApproval: true,
      category: 'governance',
    });
  }

  if (confidence < 30) {
    suggestions.push({
      id: uid('sug-rsk'),
      action: 'Escalation review with leadership — consider stop/slow/continue for at-risk initiatives',
      reason: `Delivery confidence critically low (${confidence}%) — strategic intervention needed`,
      expectedOutcome: 'Clear go/no-go decisions for high-risk initiatives',
      cost: 'High',
      feasibility: 'leadership_decision',
      requiresApproval: true,
      category: 'governance',
    });
  }

  if (staleCount > 10) {
    suggestions.push({
      id: uid('sug-rsk'),
      action: 'Update stale items or close obsolete ones',
      reason: `${staleCount} items with no activity erode data quality`,
      expectedOutcome: 'Accurate portfolio view and risk assessment',
      cost: 'Low',
      feasibility: 'immediate',
      requiresApproval: false,
      category: 'quality',
    });
  }

  return { observations, insights, effects, suggestions };
}
