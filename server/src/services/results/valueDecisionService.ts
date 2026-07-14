/**
 * valueDecisionService — silnik decyzji portfelowych DOŁÓŻ / INTERWENIUJ / ZABIJ.
 *
 * Doktryna M15 (Rezultaty): system rezultatów ma NAPĘDZAĆ decyzje portfelowe —
 * gdzie DOŁOŻYĆ zasoby (realizuje powyżej planu, wysoka pewność = SCALE),
 * gdzie INTERWENIOWAĆ (zagrożone, ale jeszcze do uratowania = INTERVENE),
 * a co ZABIĆ (nie dowiezie wartości, niska pewność / niska stawka = STOP).
 *
 * Czyste funkcje, ZERO zależności od DB — wejście in, decyzja out.
 */

export type DecisionAction = 'SCALE' | 'INTERVENE' | 'STOP' | 'HOLD';

export type DecisionSeverity = 'info' | 'warning' | 'critical';

export type DecisionTrend = 'improving' | 'flat' | 'declining';

export interface DecisionInput {
  /** Stopień realizacji wartości względem planu: 1.0 = plan, 1.1 = 110% planu. */
  realizationPct?: number;
  /** Pewność prognozy / danych: 0..1. */
  confidence?: number;
  /** Adopcja rozwiązania przez organizację: 0..1. */
  adoptionScore?: number;
  /** Kierunek trendu rezultatu. */
  trend?: DecisionTrend;
  /** Wartość stawki (np. roczna korzyść w PLN) — waży decyzję portfelową. */
  valueAtStake?: number;
}

export interface DecisionResult {
  action: DecisionAction;
  severity: DecisionSeverity;
  rationale: string[];
}

export interface PortfolioItemInput {
  id: string;
  name?: string;
  realizationPct?: number;
  confidence?: number;
  adoptionScore?: number;
  trend?: DecisionTrend | string | null;
  valueAtStake?: number;
}

export interface PortfolioDecision {
  id: string;
  name?: string;
  action: DecisionAction;
  severity: DecisionSeverity;
  rationale: string[];
  valueAtStake: number;
}

export type DecisionSummary = Record<DecisionAction, { count: number; value: number }>;

// ── progi heurystyk (jeden punkt prawdy) ──────────────────────────────────
const SCALE_REALIZATION = 1.1; // ≥110% planu
const SCALE_CONFIDENCE = 0.7;
const DANGER_REALIZATION = 0.6; // <60% planu = zagrożone
const LOW_ADOPTION = 0.4;
const LOW_CONFIDENCE = 0.5;
const LOW_VALUE_AT_STAKE = 50_000;

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function normalizeTrend(trend: unknown): DecisionTrend | undefined {
  if (trend === 'improving' || trend === 'flat' || trend === 'declining') return trend;
  return undefined;
}

function fmtPct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

const TREND_LABEL: Record<DecisionTrend, string> = {
  improving: 'trend rosnący',
  flat: 'trend płaski',
  declining: 'trend spadkowy',
};

/**
 * Rekomenduje decyzję portfelową dla pojedynczej inicjatywy/rezultatu.
 *
 * Heurystyki:
 *  - realizationPct ≥ 1.1 i confidence ≥ 0.7 → SCALE (info) — DOŁÓŻ zasoby.
 *  - realizationPct < 0.6 i (trend ≠ 'improving' lub adoption < 0.4) → strefa zagrożenia:
 *      • STOP (critical) gdy DODATKOWO confidence niska LUB valueAtStake niski — ZABIJ.
 *      • INTERVENE (critical) w przeciwnym razie — INTERWENIUJ (warto ratować).
 *  - 0.6 ≤ realizationPct < 1.1 → HOLD gdy trend nie spada, INTERVENE gdy trend spada.
 */
export function recommendDecision(input: DecisionInput): DecisionResult {
  const rationale: string[] = [];

  const realization = isFiniteNum(input.realizationPct) ? input.realizationPct : undefined;
  const confidence = isFiniteNum(input.confidence) ? input.confidence : undefined;
  const adoption = isFiniteNum(input.adoptionScore) ? input.adoptionScore : undefined;
  const valueAtStake = isFiniteNum(input.valueAtStake) ? input.valueAtStake : undefined;
  const trend = normalizeTrend(input.trend);

  // Cytowanie wejść w uzasadnieniu.
  if (realization != null) rationale.push(`realizacja ${fmtPct(realization)}`);
  if (confidence != null) rationale.push(`pewność ${fmtPct(confidence)}`);
  if (adoption != null) rationale.push(`adopcja ${fmtPct(adoption)}`);
  if (trend != null) rationale.push(TREND_LABEL[trend]);
  if (valueAtStake != null)
    rationale.push(`stawka ${Math.round(valueAtStake).toLocaleString('pl-PL')}`);

  // Brak sygnału realizacji = nie ma na czym oprzeć decyzji → HOLD/observe.
  if (realization == null) {
    rationale.push('brak danych o realizacji — obserwuj');
    return { action: 'HOLD', severity: 'info', rationale };
  }

  // 1) SCALE — realizuje powyżej planu z wysoką pewnością → DOŁÓŻ.
  if (realization >= SCALE_REALIZATION && confidence != null && confidence >= SCALE_CONFIDENCE) {
    rationale.push(
      `realizacja ${fmtPct(realization)} ≥ ${fmtPct(SCALE_REALIZATION)} planu przy pewności ${fmtPct(confidence)} — dołóż zasoby`
    );
    return { action: 'SCALE', severity: 'info', rationale };
  }

  // 2) Strefa zagrożenia — realizacja poniżej progu i (trend nie poprawia się LUB słaba adopcja).
  const lowAdoption = adoption != null && adoption < LOW_ADOPTION;
  const notImproving = trend !== 'improving';
  if (realization < DANGER_REALIZATION && (notImproving || lowAdoption)) {
    const lowConfidence = confidence != null && confidence < LOW_CONFIDENCE;
    const lowValue = valueAtStake != null && valueAtStake < LOW_VALUE_AT_STAKE;

    // STOP — nie dowiezie wartości: niska pewność lub niska stawka → ZABIJ.
    if (lowConfidence || lowValue) {
      const why: string[] = [];
      if (lowConfidence) why.push(`niska pewność ${fmtPct(confidence as number)}`);
      if (lowValue) why.push('niska stawka');
      rationale.push(
        `realizacja ${fmtPct(realization)}${trend ? ` + ${TREND_LABEL[trend]}` : ''}${lowAdoption ? ' + słaba adopcja' : ''}, ${why.join(' i ')} — zabij`
      );
      return { action: 'STOP', severity: 'critical', rationale };
    }

    // INTERVENE — zagrożone, ale stawka/pewność uzasadniają ratunek.
    rationale.push(
      `realizacja ${fmtPct(realization)}${trend ? ` + ${TREND_LABEL[trend]}` : ''}${lowAdoption ? ' + słaba adopcja' : ''} — interweniuj`
    );
    return { action: 'INTERVENE', severity: 'critical', rationale };
  }

  // 3) Strefa środkowa (0.6 ≤ realizacja < 1.1) — decyduje trend.
  if (trend === 'declining') {
    rationale.push(`realizacja ${fmtPct(realization)} w normie, ale trend spadkowy — interweniuj`);
    return { action: 'INTERVENE', severity: 'warning', rationale };
  }

  rationale.push(`realizacja ${fmtPct(realization)} w paśmie planu — utrzymaj kurs`);
  return { action: 'HOLD', severity: 'info', rationale };
}

/**
 * Mapuje portfel pozycji na decyzje, posortowane malejąco po valueAtStake
 * (najwięcej wartości na szali = najpierw na widoku decydenta).
 */
export function portfolioDecisions(items: PortfolioItemInput[]): PortfolioDecision[] {
  const decisions = (items || []).map((item) => {
    const { action, severity, rationale } = recommendDecision({
      realizationPct: item.realizationPct,
      confidence: item.confidence,
      adoptionScore: item.adoptionScore,
      trend: normalizeTrend(item.trend),
      valueAtStake: item.valueAtStake,
    });
    return {
      id: item.id,
      name: item.name,
      action,
      severity,
      rationale,
      valueAtStake: isFiniteNum(item.valueAtStake) ? item.valueAtStake : 0,
    };
  });

  return decisions.sort((a, b) => b.valueAtStake - a.valueAtStake);
}

/**
 * Agreguje decyzje per akcja: ile pozycji i ile łącznej wartości na szali.
 */
export function decisionSummary(
  decisions: Array<Pick<PortfolioDecision, 'action' | 'valueAtStake'>>
): DecisionSummary {
  const summary: DecisionSummary = {
    SCALE: { count: 0, value: 0 },
    INTERVENE: { count: 0, value: 0 },
    STOP: { count: 0, value: 0 },
    HOLD: { count: 0, value: 0 },
  };

  for (const d of decisions || []) {
    const bucket = summary[d.action];
    if (!bucket) continue;
    bucket.count += 1;
    bucket.value += isFiniteNum(d.valueAtStake) ? d.valueAtStake : 0;
  }

  return summary;
}
