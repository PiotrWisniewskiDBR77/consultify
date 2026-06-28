/**
 * SIRI Prioritisation Matrix — Impact Value Engine
 *
 * Implementacja kanonu z SIRI Prioritisation Matrix Whitepaper (Singapore EDB / TÜV SÜD).
 * Wykorzystanie w Consultify ma wyłącznie cel edukacyjny.
 *
 * KANON — formuła Impact Value dla wymiaru i:
 *
 *   Impact Value(dim_i) = Wc·[DOR_c · Cost_i]
 *                       + Wk·[DOR_k · KPI_i]
 *                       + Wp·[BIC_i − AMS_i]
 *
 *   gdzie:
 *     AMS_i      = Achieved Maturity State — obecny band wymiaru (0–5)
 *     BIC_i      = Best-In-Class — benchmark referencyjny (0–5)
 *     DOR_c      = Degree Of Relevance dla kosztu (0–1)
 *     DOR_k      = Degree Of Relevance dla KPI (0–1)
 *     Cost_i     = profil kosztu wymiaru (np. % udziału w kosztach)
 *     KPI_i      = istotność KPI dla wymiaru
 *     Wc+Wk+Wp   = 1 (wagi: cost / kpi / proximity)
 *
 * Trzy człony odpowiadają frameworkowi TIER:
 *   - Today's state        → AMS (obecny band)
 *   - Impact to bottom line → Cost (człon kosztowy)
 *   - Essential objectives  → KPI (człon KPI)
 *   - References            → BIC (benchmark best-in-class)
 *
 * Wynik: ranking 16 obszarów priorytetyzacji SIRI → top 4 do działania.
 */

import { SIRI_PRIORITISATION_AREAS } from './siriStructure';

// ============================================
// TYPES
// ============================================

/**
 * Wagi trzech członów formuły Impact Value.
 * MUSZĄ sumować się do 1 (cost + kpi + proximity = 1).
 */
export interface SIRIPrioritisationWeights {
  /** Wc — waga członu kosztowego */
  cost: number;
  /** Wk — waga członu KPI */
  kpi: number;
  /** Wp — waga członu bliskości do benchmarku (BIC − AMS) */
  proximity: number;
}

/**
 * Pełne wejście biznesowe dla pojedynczego obszaru priorytetyzacji.
 */
export interface SIRIPrioritisationInput {
  /** ID obszaru — musi odpowiadać SIRI_PRIORITISATION_AREAS[].id */
  areaId: string;
  /** AMS — obecny band dojrzałości (0–5) */
  ams: number;
  /** BIC — benchmark best-in-class (0–5) */
  bic: number;
  /** DOR_c — degree of relevance dla kosztu (0–1) */
  costRelevance: number;
  /** Cost_i — profil kosztu (np. % udziału, dowolna nieujemna skala) */
  costProfile: number;
  /** DOR_k — degree of relevance dla KPI (0–1) */
  kpiRelevance: number;
  /** KPI_i — istotność KPI dla wymiaru (dowolna nieujemna skala) */
  kpiImportance: number;
}

/**
 * Wynik rankingu dla pojedynczego obszaru.
 */
export interface SIRIPrioritisationResult {
  areaId: string;
  /** Nazwa obszaru dołączona z SIRI_PRIORITISATION_AREAS */
  name: string;
  /** Impact Value zaokrąglony do 2 miejsc */
  impactValue: number;
  /** Pozycja w rankingu, 1 = najwyższy priorytet */
  rank: number;
  /** Luka do benchmarku = BIC − AMS */
  gapToBIC: number;
}

// ============================================
// DEFAULTS
// ============================================

/**
 * Domyślne wagi formuły Impact Value.
 * cost=0.3, kpi=0.3, proximity=0.4 — suma = 1.
 */
export const DEFAULT_SIRI_PM_WEIGHTS: SIRIPrioritisationWeights = {
  cost: 0.3,
  kpi: 0.3,
  proximity: 0.4,
};

const EPSILON = 1e-9;

// ============================================
// CORE FORMULA
// ============================================

/**
 * Liczy Impact Value dla pojedynczego obszaru wg wiernego kanonu SIRI PM.
 *
 *   IV = Wc·(DOR_c · Cost) + Wk·(DOR_k · KPI) + Wp·(BIC − AMS)
 *
 * Wynik zaokrąglony do 2 miejsc po przecinku.
 * Rzuca błędem, gdy wagi nie sumują się do 1.
 */
export function calculateImpactValue(
  input: SIRIPrioritisationInput,
  weights: SIRIPrioritisationWeights = DEFAULT_SIRI_PM_WEIGHTS
): number {
  assertWeightsSumToOne(weights);

  const costTerm = weights.cost * (input.costRelevance * input.costProfile);
  const kpiTerm = weights.kpi * (input.kpiRelevance * input.kpiImportance);
  const proximityTerm = weights.proximity * (input.bic - input.ams);

  const impactValue = costTerm + kpiTerm + proximityTerm;
  return Math.round(impactValue * 100) / 100;
}

/**
 * Ranking obszarów wg Impact Value (malejąco).
 * Nadaje rank 1..n oraz dołącza name z SIRI_PRIORITISATION_AREAS.
 * Dla obszarów o równym Impact Value zachowuje stabilną kolejność wejścia.
 */
export function rankByImpactValue(
  inputs: SIRIPrioritisationInput[],
  weights: SIRIPrioritisationWeights = DEFAULT_SIRI_PM_WEIGHTS
): SIRIPrioritisationResult[] {
  assertWeightsSumToOne(weights);

  const scored = inputs.map((input, originalIndex) => {
    const area = SIRI_PRIORITISATION_AREAS.find((a) => a.id === input.areaId);
    return {
      areaId: input.areaId,
      name: area?.name ?? input.areaId,
      impactValue: calculateImpactValue(input, weights),
      gapToBIC: Math.round((input.bic - input.ams) * 100) / 100,
      originalIndex,
    };
  });

  scored.sort((a, b) => {
    if (b.impactValue !== a.impactValue) return b.impactValue - a.impactValue;
    return a.originalIndex - b.originalIndex; // stabilny tie-break
  });

  return scored.map((s, idx) => ({
    areaId: s.areaId,
    name: s.name,
    impactValue: s.impactValue,
    rank: idx + 1,
    gapToBIC: s.gapToBIC,
  }));
}

// ============================================
// HELPERS
// ============================================

/**
 * Buduje rozsądne domyślne wejścia z mapy ocen AMS (areaId → band 0–5).
 *
 * UWAGA / PRZYBLIŻENIE: gdy brak pełnych danych biznesowych firmy (profile
 * kosztów, istotność KPI, degrees of relevance), ranking opiera się głównie na
 * członie proximity (BIC − AMS). Domyślne wejścia:
 *   - bic            = opts.defaultBIC ?? 4
 *   - costRelevance  = 1   (pełna istotność — do doprecyzowania)
 *   - kpiRelevance   = 1   (pełna istotność — do doprecyzowania)
 *   - costProfile    = równo rozłożony (1 / liczba_obszarów)
 *   - kpiImportance  = równo rozłożony (1 / liczba_obszarów)
 *
 * Te domyślne wagi/wejścia są PRZYBLIŻENIEM przeznaczonym do doprecyzowania
 * realnymi danymi firmy (profil kosztów, KPI, benchmarki branżowe). Bez tych
 * danych ranking należy traktować jako wskazówkę kierunkową, nie ostateczną.
 */
export function buildDefaultInputs(
  scores: Record<string, number>,
  opts?: { defaultBIC?: number }
): SIRIPrioritisationInput[] {
  const defaultBIC = opts?.defaultBIC ?? 4;
  const entries = Object.entries(scores);
  const count = entries.length;
  // Równy rozkład profilu kosztu i istotności KPI, gdy brak danych biznesowych.
  const evenShare = count > 0 ? 1 / count : 0;

  return entries.map(([areaId, ams]) => ({
    areaId,
    ams,
    bic: defaultBIC,
    costRelevance: 1,
    costProfile: evenShare,
    kpiRelevance: 1,
    kpiImportance: evenShare,
  }));
}

// ============================================
// INTERNAL
// ============================================

function assertWeightsSumToOne(weights: SIRIPrioritisationWeights): void {
  const sum = weights.cost + weights.kpi + weights.proximity;
  if (Math.abs(sum - 1) > EPSILON) {
    throw new Error(
      `SIRIPrioritisationWeights muszą sumować się do 1 (cost+kpi+proximity), otrzymano ${sum}`
    );
  }
}

export default {
  DEFAULT_SIRI_PM_WEIGHTS,
  calculateImpactValue,
  rankByImpactValue,
  buildDefaultInputs,
};
