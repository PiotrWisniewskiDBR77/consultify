/**
 * M15 Rezultaty — pokrycie wszystkich epików W1–W6 (30 testów).
 *
 * Każda sekcja describe odpowiada jednemu epikowi z STAN-PRACY-ODBIORY.md.
 * Celem jest gwarancja kompletności kontraktu między warstwami serwisów a
 * endpointami — jeden test per kluczowe zachowanie epika.
 *
 * Testy są czyste (zero DB/IO) — uruchamiają się w <1 s.
 */

import { describe, expect, it } from 'vitest';

// ── W1: Benefit Profile & Stage-Gate ─────────────────────────────────────────
import {
  buildBenefitProfile,
  type RawKpiInput,
} from 'server/src/services/results/benefitProfileService.js';
import {
  classifyValue,
  STAGE_DEFAULT_CONFIDENCE,
} from 'server/src/services/results/valueStageGateService.js';

// ── W2: Driver Tree & Value Funnel ────────────────────────────────────────────
import {
  buildTreeFromMappings,
  rollUpTree,
  type BuildTreeInput,
  type DriverNode,
  type DriverEdge,
} from 'server/src/services/results/valueDriverTreeService.js';
import {
  buildFunnel,
  funnelConversion,
  type FunnelItem,
} from 'server/src/services/results/valueFunnelService.js';

// ── W3: Manager Signals & Reallocation ───────────────────────────────────────
import {
  buildBenefitSignals,
} from 'server/src/services/results/benefitToManagerSignalService.js';
import {
  recommendReallocation,
  type ReallocationItem,
} from 'server/src/services/results/valueReallocationService.js';

// ── W4: Run Rate ──────────────────────────────────────────────────────────────
import {
  annualizedRunRate,
  inYearValue,
  runRateBridge,
} from 'server/src/services/results/runRateService.js';

// ── W5: BSC + OKR + DICE + Adoption + Sustainment ────────────────────────────
import {
  bscOverview,
  perspectiveHealth,
  type BscKpi,
} from 'server/src/services/results/balancedScorecardService.js';
import {
  scoreKeyResult,
  scoreObjective,
  type KeyResult,
  type Objective,
} from 'server/src/services/results/okrService.js';
import {
  diceScore,
  adoptionToBenefitRisk,
  type DiceInput,
} from 'server/src/services/results/adoptionBenefitRiskService.js';
import {
  sustainmentStatus,
  nextReviewDate,
  type SustainmentInput,
} from 'server/src/services/results/benefitSustainmentService.js';

// ── W6: Forecast + RCA + Narrative + Scenarios + Finance Link + Counterfactual
import {
  linearTrend,
  projectToTarget,
} from 'server/src/services/results/kpiForecastService.js';
import {
  suggestRca,
} from 'server/src/services/results/deviationRcaSuggestService.js';
import {
  buildNarrative,
  formatValue,
} from 'server/src/services/results/valueNarrativeService.js';
import { npv, irr } from 'server/src/services/results/scenarioSensitivityService.js';
import {
  aggregateKpiFinancialImpact,
  financialImpactByStatement,
  type KpiFinanceMapping,
} from 'server/src/services/results/financeLinkService.js';
import {
  attributableDelta,
  confidenceLabel,
  type TimePoint,
} from 'server/src/services/results/counterfactualBaselineService.js';

// ─────────────────────────────────────────────────────────────────────────────
// EPIC W1 — Benefit Profile + Stage-Gate (4 testy)
// ─────────────────────────────────────────────────────────────────────────────
describe('Epic W1 — Benefit Profile & Stage-Gate', () => {
  it('W1-T01: finansowy KPI (revenue) → typ financial, kategoria revenue', () => {
    const kpi: RawKpiInput = { id: 'k1', name: 'Przychód ze sprzedaży' };
    const profile = buildBenefitProfile(kpi);
    expect(profile.type).toBe('financial');
    expect(profile.category).toBe('revenue');
  });

  it('W1-T02: nazwa zawierająca "redukcja" → isDisBenefit = true', () => {
    const kpi: RawKpiInput = { id: 'k2', name: 'Redukcja przychodów segmentu' };
    const profile = buildBenefitProfile(kpi);
    expect(profile.isDisBenefit).toBe(true);
  });

  it('W1-T03: inicjatywa L5_realized → cała wartość banked, forecast = 0', () => {
    const result = classifyValue({ stage: 'L5_realized', value: 100_000 });
    expect(result.banked).toBe(100_000);
    expect(result.forecast).toBe(0);
    expect(result.riskAdjusted).toBe(100_000);
  });

  it('W1-T04: inicjatywa L4_inflight → forecast = value × 0.85 (domyślna pewność)', () => {
    const value = 200_000;
    const result = classifyValue({ stage: 'L4_inflight', value });
    const expectedConf = STAGE_DEFAULT_CONFIDENCE['L4_inflight']; // 0.85
    expect(result.banked).toBe(0);
    expect(result.forecast).toBeCloseTo(value * expectedConf, 4);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EPIC W2 — Value Driver Tree & Value Funnel (4 testy)
// ─────────────────────────────────────────────────────────────────────────────
describe('Epic W2 — Value Driver Tree & Value Funnel', () => {
  it('W2-T05: buildTreeFromMappings tworzy węzły dla inicjatywy i KPI', () => {
    const input: BuildTreeInput = {
      objectives: [],
      financialLines: [],
      kpiToFinancial: [],
      initiatives: [{ id: 'i1', name: 'Inicjatywa A' }],
      kpis: [{ id: 'k1', name: 'Przychód', baseline: 0, target: 1000, current: 600 }],
      initiativeToKpi: [{ initiativeId: 'i1', kpiId: 'k1' }],
    };
    const { nodes } = buildTreeFromMappings(input);
    const types = nodes.map((n) => n.type);
    expect(types).toContain('initiative');
    expect(types).toContain('kpi');
    expect(nodes.length).toBeGreaterThanOrEqual(2);
  });

  it('W2-T06: rollUpTree propaguje wartości KPI do węzła-rodzica przez krawędź', () => {
    const nodes: DriverNode[] = [
      { id: 'parent', type: 'objective', label: 'Cel', value: null },
      { id: 'kpi1', type: 'kpi', label: 'KPI 1', value: 400 },
      { id: 'kpi2', type: 'kpi', label: 'KPI 2', value: 100 },
    ];
    const edges: DriverEdge[] = [
      { fromId: 'kpi1', toId: 'parent', weight: 1 },
      { fromId: 'kpi2', toId: 'parent', weight: 2 },
    ];
    const rolled = rollUpTree(nodes, edges);
    const parent = rolled.find((n) => n.id === 'parent')!;
    // 400×1 + 100×2 = 600
    expect(parent.rolledUpValue).toBe(600);
  });

  it('W2-T07: buildFunnel zwraca wszystkie 4 etapy nawet przy pustym wejściu', () => {
    const funnel = buildFunnel([]);
    const stages = funnel.map((s) => s.stage);
    expect(stages).toEqual(['ideas', 'validated', 'inflight', 'realized']);
    funnel.forEach((s) => expect(s.count).toBe(0));
  });

  it('W2-T08: funnelConversion — leakage = max(0, valueFrom − valueTo)', () => {
    const items: FunnelItem[] = [
      { funnelStage: 'ideas', value: 1000 },
      { funnelStage: 'validated', value: 700 },
      { funnelStage: 'inflight', value: 500 },
      { funnelStage: 'realized', value: 300 },
    ];
    const funnel = buildFunnel(items);
    const steps = funnelConversion(funnel);
    const ideasToValidated = steps.find((s) => s.from === 'ideas' && s.to === 'validated')!;
    expect(ideasToValidated.leakageValue).toBe(300); // 1000 - 700
    expect(ideasToValidated.conversionPct).toBeCloseTo(70, 4); // 700/1000 × 100
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EPIC W3 — Manager Signals & Reallocation (4 testy)
// ─────────────────────────────────────────────────────────────────────────────
describe('Epic W3 — Manager Signals & Reallocation', () => {
  it('W3-T09: realizationPct < 0.6 → sygnał BENEFIT_AT_RISK o wadze warning', () => {
    const signals = buildBenefitSignals([{ name: 'Oszczędności', realizationPct: 0.45 }]);
    expect(signals).toHaveLength(1);
    expect(signals[0].type).toBe('BENEFIT_AT_RISK');
    expect(signals[0].severity).toBe('warning');
  });

  it('W3-T10: realizationPct < 0.4 → severity escaluje do critical', () => {
    const signals = buildBenefitSignals([{ name: 'NPS', realizationPct: 0.25 }]);
    expect(signals[0].severity).toBe('critical');
  });

  it('W3-T11: niska realizacja (<50%) + niskie confidence (≤0.5) → fromCandidates', () => {
    // Warunek: realization < 50 AND confidence <= 0.5 (obie spełnione jednocześnie)
    const items: ReallocationItem[] = [
      { id: 'low', name: 'Słaba inicjatywa', realizationPct: 30, confidence: 0.4 },
      { id: 'high', name: 'Dobra inicjatywa', realizationPct: 80, confidence: 0.9 },
    ];
    const rec = recommendReallocation(items);
    const fromIds = rec.fromCandidates.map((c) => c.id);
    expect(fromIds).toContain('low');
    expect(fromIds).not.toContain('high');
  });

  it('W3-T12: inicjatywy z realizacją >= 70% trafiają do toCandidates', () => {
    const items: ReallocationItem[] = [
      { id: 'low', realizationPct: 20, confidence: 0.8 },
      { id: 'high', realizationPct: 85, confidence: 0.9 },
    ];
    const rec = recommendReallocation(items);
    const toIds = rec.toCandidates.map((c) => c.id);
    expect(toIds).toContain('high');
    expect(toIds).not.toContain('low');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EPIC W4 — Run Rate (3 testy)
// ─────────────────────────────────────────────────────────────────────────────
describe('Epic W4 — Run Rate vs In-Year', () => {
  it('W4-T13: annualizedRunRate = realized / periodMonths × 12', () => {
    // 450 w 3 miesiącach → 1800/rok
    expect(annualizedRunRate(450, 3)).toBe(1800);
  });

  it('W4-T14: inYearValue sumuje tylko pomiary z żądanego roku', () => {
    const points = [
      { month: '2025-11', value: 100 },
      { month: '2026-02', value: 200 },
      { month: '2026-08', value: 300 },
      { month: '2027-01', value: 999 },
    ];
    expect(inYearValue(points, 2026)).toBe(500); // 200 + 300
  });

  it('W4-T15: runRateBridge.runRate = realizedToDate / periodMonths × 12', () => {
    const bridge = runRateBridge({ realizedToDate: 300, periodMonths: 3, remainingMonthsInYear: 9 });
    // 300/3 × 12 = 1200
    expect(bridge.runRate).toBe(1200);
    // alreadyRealized jest pass-through
    expect(bridge.alreadyRealized).toBe(300);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EPIC W5.1–W5.4 — BSC + OKR (4 testy)
// ─────────────────────────────────────────────────────────────────────────────
describe('Epic W5.1-W5.4 — Balanced Scorecard & OKR', () => {
  it('W5-T16: bscOverview zwraca wszystkie 4 perspektywy nawet bez KPI', () => {
    const overview = bscOverview([]);
    expect(Object.keys(overview.perspectives)).toEqual(
      expect.arrayContaining(['financial', 'customer', 'process', 'learning']),
    );
  });

  it('W5-T17: perspectiveHealth — healthPct = onTarget / measured (0..1)', () => {
    const kpis: BscKpi[] = [
      { id: 'k1', name: 'Margin', perspective: 'financial', status: 'on-target' },
      { id: 'k2', name: 'NPS', perspective: 'customer', status: 'on-target' },
      { id: 'k3', name: 'Process', perspective: 'process', status: 'below' },
    ];
    const health = perspectiveHealth(kpis);
    expect(health.financial.healthPct).toBeCloseTo(1, 5);   // 1/1 = 1.0
    expect(health.process.healthPct).toBeCloseTo(0, 5);     // 0/1 = 0.0
    expect(health.learning.count).toBe(0);
  });

  it('W5-T18: scoreKeyResult = (current − baseline) / (target − baseline), clamp 0..1', () => {
    const kr: KeyResult = { id: 'kr1', label: 'Przychód', baseline: 0, target: 100, current: 75 };
    expect(scoreKeyResult(kr)).toBeCloseTo(0.75, 5);
  });

  it('W5-T19: OKR objective on-track gdy średni score ≥ 0.7', () => {
    const obj: Objective = {
      id: 'o1',
      label: 'Wzrost',
      keyResults: [
        { id: 'kr1', label: 'A', baseline: 0, target: 100, current: 80 },
        { id: 'kr2', label: 'B', baseline: 0, target: 100, current: 75 },
      ],
    };
    const scored = scoreObjective(obj);
    expect(scored.score).toBeGreaterThanOrEqual(0.7);
    expect(scored.status).toBe('on-track');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EPIC W5.5–W5.8 — Adoption + DICE + Sustainment + Governance Calendar (4 testy)
// ─────────────────────────────────────────────────────────────────────────────
describe('Epic W5.5-W5.8 — Adoption, DICE, Sustainment & Governance', () => {
  it('W5-T20: DICE "win" zone gdy score ≤ 14 (krótki czas, silne zaangażowanie)', () => {
    const input: DiceInput = {
      durationWeeks: 4,
      teamIntegrity: 1,
      seniorCommitment: 1,
      localCommitment: 2,
      extraEffortPct: 5,
    };
    const result = diceScore(input);
    expect(result.zone).toBe('win');
    expect(result.score).toBeLessThanOrEqual(14);
  });

  it('W5-T21: adoptionScore < 0.3 + declining trend → benefit risk = high', () => {
    const result = adoptionToBenefitRisk({ adoptionScore: 0.2, sentimentTrend: 'declining' });
    expect(result.risk).toBe('high');
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  it('W5-T22: brak właściciela (ownershipTransferred = false) → status unowned', () => {
    const input: SustainmentInput = {
      ownershipTransferred: false,
      cadence: 'monthly',
      realizationPct: 0.9,
    };
    const nowMs = new Date('2026-06-01').getTime();
    const result = sustainmentStatus(input, nowMs);
    expect(result.status).toBe('unowned');
  });

  it('W5-T23: nextReviewDate dla kadencji monthly = lastReview + ~30 dni', () => {
    const lastReview = '2026-06-01T00:00:00.000Z';
    const nowMs = new Date('2026-06-24').getTime();
    const next = nextReviewDate('monthly', lastReview, nowMs);
    const diff = new Date(next).getTime() - new Date(lastReview).getTime();
    const days = diff / (24 * 60 * 60 * 1000);
    expect(days).toBeCloseTo(30, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EPIC W6.1–W6.2 — KPI Forecast + RCA (4 testy)
// ─────────────────────────────────────────────────────────────────────────────
describe('Epic W6.1-W6.2 — KPI Forecast & Root Cause Analysis', () => {
  it('W6-T24: linearTrend — czysta linia y=2t+1 daje slope=2, intercept=1', () => {
    const points = [
      { t: 0, value: 1 },
      { t: 1, value: 3 },
      { t: 2, value: 5 },
      { t: 3, value: 7 },
    ];
    const trend = linearTrend(points);
    expect(trend.slope).toBeCloseTo(2, 5);
    expect(trend.intercept).toBeCloseTo(1, 5);
  });

  it('W6-T25: projectToTarget willHitTarget = true gdy rosnący trend osiągnie cel', () => {
    const points = [
      { t: 0, value: 50 },
      { t: 1, value: 60 },
      { t: 2, value: 70 },
      { t: 3, value: 80 },
    ];
    const result = projectToTarget({
      points,
      target: 120,
      direction: 'HIGHER_IS_BETTER',
    });
    expect(result.willHitTarget).toBe(true);
    expect(result.etaT).not.toBeNull();
  });

  it('W6-T26: staleData=true → hipoteza data-quality z confidence 0.8', () => {
    const hypotheses = suggestRca({ staleData: true });
    const dq = hypotheses.find((h) => h.category === 'data-quality');
    expect(dq).toBeDefined();
    expect(dq!.confidence).toBeCloseTo(0.8, 3);
  });

  it('W6-T27: declining trend + niska adopcja → co najmniej 2 hipotezy (m.in. adoption)', () => {
    const hypotheses = suggestRca({
      trend: 'declining',
      adoptionScore: 0.2,
      deviationPct: 0.3,
    });
    expect(hypotheses.length).toBeGreaterThanOrEqual(2);
    const categories = hypotheses.map((h) => h.category);
    expect(categories).toContain('adoption');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EPIC W6.3–W6.8 — Narrative + Scenarios + Finance Link + Counterfactual (6 testów)
// ─────────────────────────────────────────────────────────────────────────────
describe('Epic W6.3-W6.8 — Narrative, Scenarios, Finance Link & Counterfactual', () => {
  it('W6-T28: buildNarrative — headline zawiera procent realizacji (80%)', () => {
    const narrative = buildNarrative({
      banked: 800_000,
      inFlight: 200_000,
      atRisk: 50_000,
      totalTarget: 1_000_000,
      pctOfTarget: 0.8,
    });
    expect(narrative.headline).toMatch(/80/);
    expect(narrative.paragraphs.length).toBeGreaterThan(0);
  });

  it('W6-T29: formatValue — 1.5M → "1,5 M", 1k → "1 k", 500 → "500"', () => {
    expect(formatValue(1_500_000)).toBe('1,5 M');
    expect(formatValue(1_000)).toBe('1 k');
    expect(formatValue(500)).toBe('500');
  });

  it('W6-T30: npv przy stopie 0% = prosta suma przepływów', () => {
    expect(npv(0, [-100, 60, 60])).toBeCloseTo(20, 6);
  });

  it('W6-T31: irr — NPV obliczone przy IRR ≈ 0 (definicja)', () => {
    const flows = [-1000, 400, 400, 400, 400];
    const r = irr(flows);
    expect(r).not.toBeNull();
    expect(npv(r!, flows)).toBeCloseTo(0, 4);
  });

  it('W6-T32: aggregateKpiFinancialImpact — dwa KPI do tej samej linii są sumowane', () => {
    const mappings: KpiFinanceMapping[] = [
      { kpiId: 'k1', statementLineId: 'revenue', statementType: 'P&L', kpiDelta: 100, multiplier: 1 },
      { kpiId: 'k2', statementLineId: 'revenue', statementType: 'P&L', kpiDelta: 50, multiplier: 2 },
    ];
    const impacts = aggregateKpiFinancialImpact(mappings);
    const revenue = impacts.find((i) => i.statementLineId === 'revenue');
    expect(revenue).toBeDefined();
    // 100×1 + 50×2 = 200
    expect(revenue!.totalImpact).toBeCloseTo(200, 5);
  });

  it('W6-T33: financialImpactByStatement — sumuje wpływ per typ sprawozdania (P&L vs CF)', () => {
    const mappings: KpiFinanceMapping[] = [
      { kpiId: 'k1', statementLineId: 'l1', statementType: 'P&L', kpiDelta: 100 },
      { kpiId: 'k2', statementLineId: 'l2', statementType: 'CF', kpiDelta: 200 },
    ];
    const impacts = aggregateKpiFinancialImpact(mappings);
    const byStatement = financialImpactByStatement(impacts);
    // returns Record<StatementType, number>
    expect(byStatement['P&L']).toBeCloseTo(100, 5);
    expect(byStatement['CF']).toBeCloseTo(200, 5);
  });

  it('W6-T34: attributableDelta ≈ 0 gdy flat trend i obserwacja równa projekcji', () => {
    const prePoints: TimePoint[] = [
      { t: 0, value: 10 },
      { t: 1, value: 10 },
      { t: 2, value: 10 },
    ];
    const result = attributableDelta({
      observedValue: 10,
      prePoints,
      atT: 5,
    });
    expect(result.attributable).toBeCloseTo(0, 2);
  });

  it('W6-T35: confidenceLabel — high przy ≥5 punktów z czystym trendem, low przy <3', () => {
    // 7 punktów na idealnej linii → r2=1, n=7 → high
    const highPts: TimePoint[] = [0, 1, 2, 3, 4, 5, 6].map((t) => ({ t, value: t * 10 }));
    expect(confidenceLabel(highPts)).toBe('high');
    // 2 punkty → n<3 → low
    const lowPts: TimePoint[] = [{ t: 0, value: 0 }, { t: 1, value: 1 }];
    expect(confidenceLabel(lowPts)).toBe('low');
  });
});
