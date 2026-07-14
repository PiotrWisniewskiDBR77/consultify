/**
 * M15/W2-W4 keystone — value intelligence composition.
 *
 * Composes the pure value-assurance services (stage-gates, funnel, decisions,
 * scorecard) over an org's initiatives + ROI data into the cockpit payload:
 * banked vs forecast vs at-risk, the value funnel, and SCALE/INTERVENE/STOP
 * decisions. Pure — the route gathers the rows and calls this.
 */
import { buildScorecard, topBenefits, topRisks } from './transformationScorecardService.js';
import { portfolioDecisions } from './valueDecisionService.js';
import { buildFunnel, mapInitiativeToFunnel, valueAtRisk } from './valueFunnelService.js';
import {
  classifyValue,
  portfolioValueSplit,
  riskAdjustedValue,
  STAGE_DEFAULT_CONFIDENCE,
  stageFromInitiative,
  type ValueStage,
} from './valueStageGateService.js';

export interface VIInitiative {
  id: string;
  name?: string | null;
  status?: string | null;
}
export interface VIRoiAssumption {
  initiative_id: string;
  expected_npv?: number | null;
  expected_revenue_delta?: number | null;
  expected_cost_delta?: number | null;
}
export interface VIRoiRealized {
  initiative_id: string;
  realized_revenue_delta?: number | null;
  realized_cost_delta?: number | null;
  realized_savings?: number | null;
}
export interface ValueIntelligenceInput {
  initiatives: VIInitiative[];
  roiAssumptions: VIRoiAssumption[];
  roiRealized: VIRoiRealized[];
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const ADVANCED: ValueStage[] = ['L4_inflight', 'L5_realized'];

export interface ValueIntelligence {
  scorecard: ReturnType<typeof buildScorecard>;
  funnel: ReturnType<typeof buildFunnel>;
  valueAtRisk: ReturnType<typeof valueAtRisk>;
  valueSplit: ReturnType<typeof portfolioValueSplit>;
  decisions: ReturnType<typeof portfolioDecisions>;
  topBenefits: ReturnType<typeof topBenefits>;
  topRisks: ReturnType<typeof topRisks>;
  items: Array<{
    id: string;
    name?: string | null;
    stage: ValueStage;
    valueAtStake: number;
    realizedValue: number;
    forecastValue: number;
    confidence: number;
    realizationPct: number;
    atRisk: boolean;
    hasRealized: boolean;
  }>;
}

export function buildValueIntelligence(input: ValueIntelligenceInput): ValueIntelligence {
  const assumptionByInit = new Map<string, VIRoiAssumption>();
  for (const a of input.roiAssumptions || []) {
    if (a.initiative_id) assumptionByInit.set(String(a.initiative_id), a);
  }
  const realizedByInit = new Map<string, number>();
  for (const r of input.roiRealized || []) {
    if (!r.initiative_id) continue;
    const v = num(r.realized_revenue_delta) - num(r.realized_cost_delta) + num(r.realized_savings);
    realizedByInit.set(
      String(r.initiative_id),
      (realizedByInit.get(String(r.initiative_id)) || 0) + v
    );
  }

  const items = (input.initiatives || []).map((i) => {
    const a = assumptionByInit.get(String(i.id));
    const valueAtStake =
      a?.expected_npv != null
        ? num(a.expected_npv)
        : num(a?.expected_revenue_delta) - num(a?.expected_cost_delta);
    const realizedValue = realizedByInit.get(String(i.id)) || 0;
    const hasRoiBaseline = !!a;
    const hasRealized = realizedValue !== 0;
    const stage = stageFromInitiative({
      status: i.status ?? undefined,
      hasRoiBaseline,
      hasRealized,
    });
    const confidence = STAGE_DEFAULT_CONFIDENCE[stage];
    const realizationPct = valueAtStake > 0 ? realizedValue / valueAtStake : 0;
    const atRisk = realizationPct < 0.6 && ADVANCED.includes(stage);
    const { forecast } = classifyValue({ stage, value: valueAtStake, confidence });
    const forecastValue =
      stage === 'L5_realized' ? 0 : forecast || riskAdjustedValue(valueAtStake, confidence);
    return {
      id: String(i.id),
      name: i.name ?? null,
      stage,
      valueAtStake,
      realizedValue,
      forecastValue,
      confidence,
      realizationPct,
      atRisk,
      hasRealized,
      funnelStage: mapInitiativeToFunnel(i.status ?? undefined),
    };
  });

  const scorecardItems = items.map((it) => ({
    id: it.id,
    name: it.name ?? undefined,
    targetValue: it.valueAtStake,
    realizedValue: it.realizedValue,
    forecastValue: it.forecastValue,
    confidence: it.confidence,
    atRisk: it.atRisk,
  }));

  return {
    scorecard: buildScorecard({ items: scorecardItems }),
    funnel: buildFunnel(
      items.map((it) => ({
        funnelStage: it.funnelStage,
        value: it.valueAtStake,
        confidence: it.confidence,
      }))
    ),
    valueAtRisk: valueAtRisk(
      items.map((it) => ({
        value: it.valueAtStake,
        confidence: it.confidence,
        behindPlan: it.realizationPct < 0.6,
      }))
    ),
    valueSplit: portfolioValueSplit(
      items.map((it) => ({ stage: it.stage, value: it.valueAtStake, confidence: it.confidence }))
    ),
    decisions: portfolioDecisions(
      items.map((it) => ({
        id: it.id,
        name: it.name ?? undefined,
        realizationPct: it.realizationPct,
        confidence: it.confidence,
        valueAtStake: it.valueAtStake,
      }))
    ),
    topBenefits: topBenefits(scorecardItems),
    topRisks: topRisks(scorecardItems),
    items: items.map(({ funnelStage: _f, ...rest }) => rest),
  };
}
