/**
 * AI Plan Generator
 *
 * Generates action plans based on lane analysis data.
 * In production this will call the AI backend; for now uses deterministic
 * heuristics from the analysis data itself.
 */

import type {
  AiActionPlan,
  AiActionStep,
  EffectItem,
  InsightItem,
  LaneAnalysis,
  ManagerLaneId,
  ObservationItem,
  SuggestionItem,
} from './types';

let planCounter = 0;

function nextPlanId(): string {
  planCounter++;
  return `ai-plan-${Date.now()}-${planCounter}`;
}

function buildStepsFromSuggestions(suggestions: SuggestionItem[]): AiActionStep[] {
  return suggestions.map((sug) => {
    const type: AiActionStep['type'] =
      sug.feasibility === 'immediate' ? 'immediate'
        : sug.feasibility === 'leadership_decision' ? 'strategic'
          : 'short_term';
    const priority: AiActionStep['priority'] =
      sug.feasibility === 'immediate' ? 'high'
        : sug.feasibility === 'not_feasible_now' ? 'low'
          : 'medium';
    const daysOffset = type === 'immediate' ? 3 : type === 'short_term' ? 14 : 30;
    const deadline = new Date(Date.now() + daysOffset * 86400000).toISOString().slice(0, 10);

    return {
      title: sug.action,
      description: `${sug.reason} → ${sug.expectedOutcome}`,
      owner: sug.recommendedOwner || (sug.feasibility === 'leadership_decision' ? 'Leadership' : 'Manager'),
      deadline,
      priority,
      type,
    };
  });
}

function buildDiagnosis(
  observations: ObservationItem[],
  insights: InsightItem[],
  isPolish: boolean
): string {
  const critical = observations.filter((o) => o.severity === 'critical').length;
  const warning = observations.filter((o) => o.severity === 'warning').length;
  const systemic = insights.filter((i) => i.isSystemic).length;
  const actionReq = insights.filter((i) => i.requiresAction).length;

  if (isPolish) {
    return `Zidentyfikowano ${observations.length} obserwacji (${critical} krytycznych, ${warning} ostrzegawczych) i ${insights.length} wniosków (${systemic} systemowych, ${actionReq} wymagających działania). Sytuacja wymaga ${critical > 2 ? 'natychmiastowej interwencji' : critical > 0 ? 'szybkiego działania' : 'monitorowania i prewencji'}.`;
  }
  return `Identified ${observations.length} observations (${critical} critical, ${warning} warnings) and ${insights.length} insights (${systemic} systemic, ${actionReq} requiring action). Situation requires ${critical > 2 ? 'immediate intervention' : critical > 0 ? 'prompt action' : 'monitoring and prevention'}.`;
}

function buildRiskAssessment(
  effects: EffectItem[],
  isPolish: boolean
): string {
  const maxBlast = Math.max(...effects.map((e) => e.blastRadius), 0);
  const hasCost = effects.some((e) => e.costImpact);
  const hasTimeline = effects.some((e) => e.timelineImpact);

  if (isPolish) {
    const parts: string[] = [`Maksymalny zasięg wpływu: ${maxBlast} elementów`];
    if (hasCost) parts.push('zidentyfikowano wpływ kosztowy');
    if (hasTimeline) parts.push('zidentyfikowano wpływ na harmonogram');
    return parts.join('. ') + '. Brak działania zwiększy zakres problemów.';
  }
  const parts: string[] = [`Maximum blast radius: ${maxBlast} items`];
  if (hasCost) parts.push('cost impact identified');
  if (hasTimeline) parts.push('timeline impact identified');
  return parts.join('. ') + '. Inaction will increase problem scope.';
}

function buildExpectedOutcome(suggestions: SuggestionItem[], isPolish: boolean): string {
  const immediateCount = suggestions.filter((s) => s.feasibility === 'immediate').length;
  const totalCount = suggestions.length;

  if (isPolish) {
    return `Wdrożenie planu: ${immediateCount} działań natychmiastowych + ${totalCount - immediateCount} planowanych. Oczekiwana redukcja ryzyka o 60-80% i przywrócenie kontroli nad sytuacją w ciągu 2-4 tygodni.`;
  }
  return `Plan implementation: ${immediateCount} immediate actions + ${totalCount - immediateCount} planned. Expected 60-80% risk reduction and situation control restoration within 2-4 weeks.`;
}

export function generateSingleSignalPlan(
  signalId: string,
  signalType: 'observation' | 'insight' | 'effect',
  analysis: LaneAnalysis,
  laneId: ManagerLaneId,
  isPolish: boolean
): AiActionPlan {
  let relevantInsights: InsightItem[] = [];
  let relevantEffects: EffectItem[] = [];
  let relevantSuggestions: SuggestionItem[] = [];

  if (signalType === 'observation') {
    relevantInsights = analysis.insights.filter((i) => i.observationIds.includes(signalId));
    const insightIds = new Set(relevantInsights.map((i) => i.id));
    relevantEffects = analysis.effects.filter((e) => insightIds.has(e.insightId));
    relevantSuggestions = analysis.suggestions.slice(0, 3);
  } else if (signalType === 'insight') {
    relevantInsights = analysis.insights.filter((i) => i.id === signalId);
    relevantEffects = analysis.effects.filter((e) => e.insightId === signalId);
    relevantSuggestions = analysis.suggestions.slice(0, 3);
  } else {
    const eff = analysis.effects.find((e) => e.id === signalId);
    if (eff) {
      relevantInsights = analysis.insights.filter((i) => i.id === eff.insightId);
      relevantEffects = [eff];
    }
    relevantSuggestions = analysis.suggestions.slice(0, 3);
  }

  const steps = buildStepsFromSuggestions(
    relevantSuggestions.length > 0 ? relevantSuggestions : analysis.suggestions.slice(0, 3)
  );
  const obs = analysis.observations.filter((o) =>
    relevantInsights.some((i) => i.observationIds.includes(o.id))
  );

  return {
    id: nextPlanId(),
    scope: 'single',
    targetIds: [signalId],
    laneId,
    diagnosis: buildDiagnosis(
      obs.length > 0 ? obs : analysis.observations.slice(0, 2),
      relevantInsights.length > 0 ? relevantInsights : analysis.insights.slice(0, 1),
      isPolish
    ),
    riskAssessment: buildRiskAssessment(
      relevantEffects.length > 0 ? relevantEffects : analysis.effects.slice(0, 2),
      isPolish
    ),
    steps,
    expectedOutcome: buildExpectedOutcome(relevantSuggestions, isPolish),
    estimatedTimeline: isPolish ? '2-4 tygodnie' : '2-4 weeks',
    generatedAt: new Date().toISOString(),
  };
}

export function generateComprehensivePlan(
  analysis: LaneAnalysis,
  laneId: ManagerLaneId,
  isPolish: boolean
): AiActionPlan {
  const allTargets = [
    ...analysis.observations.map((o) => o.id),
    ...analysis.insights.map((i) => i.id),
    ...analysis.effects.map((e) => e.id),
  ];

  const steps = buildStepsFromSuggestions(analysis.suggestions);

  return {
    id: nextPlanId(),
    scope: 'comprehensive',
    targetIds: allTargets,
    laneId,
    diagnosis: buildDiagnosis(analysis.observations, analysis.insights, isPolish),
    riskAssessment: buildRiskAssessment(analysis.effects, isPolish),
    steps,
    expectedOutcome: buildExpectedOutcome(analysis.suggestions, isPolish),
    estimatedTimeline: isPolish
      ? (analysis.suggestions.some((s) => s.feasibility === 'leadership_decision') ? '4-8 tygodni' : '2-4 tygodnie')
      : (analysis.suggestions.some((s) => s.feasibility === 'leadership_decision') ? '4-8 weeks' : '2-4 weeks'),
    generatedAt: new Date().toISOString(),
  };
}
