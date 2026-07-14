/**
 * valueFunnelService — portfel wartości jako lejek (ideas → validated → in-flight → realized).
 *
 * Doktryna: wartość portfela inicjatyw nie materializuje się w całości. Na każdym
 * przejściu między etapami lejka część "sized" wartości ginie (leakage), zanim
 * dotrze do realizacji. Ten serwis liczy agregaty per etap, konwersję wartości
 * między sąsiednimi etapami, wyciek oraz wartość zagrożoną (value-at-risk).
 *
 * Czyste funkcje, zero DB — łatwe do testowania i reużycia w warstwie route/AI.
 */

export type FunnelStage = 'ideas' | 'validated' | 'inflight' | 'realized';

/** Kanoniczna kolejność etapów lejka (od najszerszego do najwęższego). */
export const FUNNEL_ORDER: readonly FunnelStage[] = [
  'ideas',
  'validated',
  'inflight',
  'realized',
] as const;

export interface FunnelItem {
  funnelStage: FunnelStage;
  value: number;
  /** 0..1; brak = traktujemy jako pełne zaufanie (1). */
  confidence?: number;
}

export interface FunnelStageAggregate {
  stage: FunnelStage;
  count: number;
  value: number;
  /** Suma value × confidence (confidence brak → 1). */
  riskAdjustedValue: number;
}

export interface FunnelConversionStep {
  from: FunnelStage;
  to: FunnelStage;
  /** Procent wartości "from" który przeszedł dalej (0..100). 0 gdy from=0. */
  conversionPct: number;
  /** Wartość, która wyciekła między etapami (max(0, from − to)). */
  leakageValue: number;
}

export interface ValueAtRiskItem {
  value: number;
  /** 0..1; brak = pełne zaufanie. */
  confidence?: number;
  behindPlan?: boolean;
}

export interface ValueAtRiskResult {
  atRiskValue: number;
  atRiskCount: number;
}

const CONFIDENCE_AT_RISK_THRESHOLD = 0.5;

function safeNumber(n: number | undefined | null): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

/** confidence brak/niepoprawne → 1 (pełne zaufanie), w przeciwnym razie clamp 0..1. */
function normalizeConfidence(c: number | undefined): number {
  if (typeof c !== 'number' || !Number.isFinite(c)) return 1;
  if (c < 0) return 0;
  if (c > 1) return 1;
  return c;
}

/**
 * Agregat wartości per etap lejka. Każdy etap z FUNNEL_ORDER jest obecny
 * w wyniku, nawet gdy nie ma dla niego itemów (count/value/riskAdjusted = 0).
 */
export function buildFunnel(items: FunnelItem[]): FunnelStageAggregate[] {
  const acc = new Map<FunnelStage, FunnelStageAggregate>();
  for (const stage of FUNNEL_ORDER) {
    acc.set(stage, { stage, count: 0, value: 0, riskAdjustedValue: 0 });
  }

  for (const item of items ?? []) {
    const bucket = acc.get(item?.funnelStage);
    if (!bucket) continue; // nieznany etap — pomijamy
    const value = safeNumber(item.value);
    const confidence = normalizeConfidence(item.confidence);
    bucket.count += 1;
    bucket.value += value;
    bucket.riskAdjustedValue += value * confidence;
  }

  return FUNNEL_ORDER.map((stage) => acc.get(stage)!);
}

/**
 * Konwersja wartości między sąsiednimi etapami lejka + leakage (spadek wartości).
 * Zakłada wejście z buildFunnel (uporządkowane wg FUNNEL_ORDER).
 */
export function funnelConversion(funnel: FunnelStageAggregate[]): FunnelConversionStep[] {
  // Indeksujemy po etapie, żeby być odpornym na kolejność/brakujące etapy.
  const byStage = new Map<FunnelStage, FunnelStageAggregate>();
  for (const agg of funnel ?? []) {
    if (agg) byStage.set(agg.stage, agg);
  }

  const steps: FunnelConversionStep[] = [];
  for (let i = 0; i < FUNNEL_ORDER.length - 1; i++) {
    const from = FUNNEL_ORDER[i];
    const to = FUNNEL_ORDER[i + 1];
    const fromValue = safeNumber(byStage.get(from)?.value);
    const toValue = safeNumber(byStage.get(to)?.value);

    const conversionPct = fromValue > 0 ? (toValue / fromValue) * 100 : 0;
    const leakageValue = Math.max(0, fromValue - toValue);

    steps.push({ from, to, conversionPct, leakageValue });
  }
  return steps;
}

/**
 * Wartość zagrożona: item jest "at risk" gdy confidence < 0.5 LUB behindPlan.
 * (brak confidence = 1 → nie jest at-risk z tego tytułu).
 */
export function valueAtRisk(items: ValueAtRiskItem[]): ValueAtRiskResult {
  let atRiskValue = 0;
  let atRiskCount = 0;

  for (const item of items ?? []) {
    if (!item) continue;
    const confidence = normalizeConfidence(item.confidence);
    const isAtRisk = confidence < CONFIDENCE_AT_RISK_THRESHOLD || item.behindPlan === true;
    if (isAtRisk) {
      atRiskValue += safeNumber(item.value);
      atRiskCount += 1;
    }
  }

  return { atRiskValue, atRiskCount };
}

/**
 * Mapuje status inicjatywy na etap lejka wartości.
 * DRAFT/REVIEWING → ideas; APPROVED/SCHEDULED → validated;
 * EXECUTING/BLOCKED → inflight; DONE/TRACKING → realized.
 * Nieznany/brak → ideas (najszerszy etap, brak nadinterpretacji).
 */
export function mapInitiativeToFunnel(status?: string): FunnelStage {
  switch ((status ?? '').toUpperCase()) {
    case 'DRAFT':
    case 'REVIEWING':
      return 'ideas';
    case 'APPROVED':
    case 'SCHEDULED':
      return 'validated';
    case 'EXECUTING':
    case 'BLOCKED':
      return 'inflight';
    case 'DONE':
    case 'TRACKING':
      return 'realized';
    default:
      return 'ideas';
  }
}
