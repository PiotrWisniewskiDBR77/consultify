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
 * COORD-08 — jawna wersja obliczenia Impact Value.
 *
 *   'legacy_v1'  — DOKŁADNIE obecne (przed COORD-08) zachowanie silnika,
 *                  bit w bit. Wagi mnożą surowe termy, ujemny proximity
 *                  NIE jest obcinany, domyślne wagi nie są żadnym z
 *                  oficjalnych presetów. Służy wyłącznie do odtworzenia
 *                  istniejących wyników — NIE poprawiaj tej ścieżki.
 *   'siri_pm_v2' — poprawiona logika wg whitepapera (str. 35-37):
 *                  Step 6 normalizuje trzy czynniki przez ich Total PRZED
 *                  wagami, Step 4 obcina ujemny proximity do 0, wagi
 *                  pochodzą wyłącznie z oficjalnych presetów wg horyzontu
 *                  planowania (str. 29, Figure 12).
 */
export type SiriPmCalculationVersion = 'legacy_v1' | 'siri_pm_v2';

/** Horyzont planowania — jedyna oś, po której whitepaper różnicuje wagi. */
export type SiriPmPlanningHorizon = 'strategic' | 'tactical' | 'operational';

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
  /** Traceability (COORD-08): która formuła wyprodukowała ten wynik. */
  calculationVersion: SiriPmCalculationVersion;
  /**
   * Horyzont planowania użyty do doboru presetu wag. `null` dla
   * `legacy_v1`, gdy wywołujący nie przekazał wag pochodzących z presetu
   * (legacy przyjmuje dowolne `SIRIPrioritisationWeights`, nie tylko
   * presety horyzontu).
   */
  planningHorizon: SiriPmPlanningHorizon | null;
}

// ============================================
// DEFAULTS
// ============================================

/**
 * Domyślne wagi formuły Impact Value (ścieżka `legacy_v1`).
 * cost=0.3, kpi=0.3, proximity=0.4 — suma = 1.
 *
 * ★ ZAKAZ CICHEJ ZMIANY (COORD-08): to NIE jest żaden z oficjalnych
 * presetów horyzontu planowania (Figure 12: strategic 30/40/30,
 * tactical 45/30/25, operational 60/20/20) — patrz
 * `SIRI_PM_ENGINE_VERIFICATION.defaultWeightsMatchAnyPlanningHorizonPreset`
 * w `siriAdapter.ts`. Zostaje jako domyślna ścieżka legacy_v1 świadomie —
 * poprawa wchodzi wyłącznie przez `siri_pm_v2` za jawnym parametrem/flagą.
 */
export const DEFAULT_SIRI_PM_WEIGHTS: SIRIPrioritisationWeights = {
  cost: 0.3,
  kpi: 0.3,
  proximity: 0.4,
};

/**
 * Oficjalne presety wag wg horyzontu planowania.
 * Źródło: `knowledge/SIRI/SIRI-PM Whitepaper.pdf`, str. 29, Figure 12
 * "Weightage Distribution according to Planning Horizon" — wartości
 * przepisane wprost z tabeli, nie wymyślone. Dane, nie magiczne liczby:
 * używane wyłącznie przez ścieżkę `siri_pm_v2`.
 */
export const SIRI_PM_WEIGHT_PRESETS: Record<SiriPmPlanningHorizon, SIRIPrioritisationWeights> = {
  strategic: { cost: 0.3, kpi: 0.4, proximity: 0.3 },
  tactical: { cost: 0.45, kpi: 0.3, proximity: 0.25 },
  operational: { cost: 0.6, kpi: 0.2, proximity: 0.2 },
} as const;

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
 * Ranking obszarów wg Impact Value (malejąco) — ścieżka `legacy_v1`.
 *
 * ★ BIT W BIT: numeryka tej funkcji (impactValue/rank/gapToBIC) jest
 * DOKŁADNIE tym, co silnik liczył przed COORD-08 — nie została zmieniona.
 * Jedyny dodatek to pola traceability (`calculationVersion`,
 * `planningHorizon: null`), które nie wpływają na wynik liczbowy.
 * Nie "poprawiaj" tej funkcji — poprawiona logika żyje w
 * `rankByImpactValueV2()`.
 *
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
    calculationVersion: 'legacy_v1',
    planningHorizon: null,
  }));
}

// ============================================
// SIRI_PM_V2 — poprawiona logika (COORD-08)
// ============================================

/**
 * Ranking obszarów wg Impact Value (malejąco) — ścieżka `siri_pm_v2`.
 *
 * Whitepaper str. 35-37:
 *   Step 4 — "If the difference has a negative value, indicate »0« into
 *            the Proximity Factor row." → proximity surowy = max(BIC−AMS, 0).
 *   Step 6 — "Normalise the values for all 3 factors [...]" → każdy z
 *            trzech surowych termów (cost/kpi/proximity) dzielony przez
 *            sumę (`Total`) tego termu po WSZYSTKICH przekazanych
 *            obszarach, PRZED przyłożeniem wag.
 *   Step 7 — IV = Wcost·CostFactorN + Wkpi·KpiFactorN + Wproximity·ProximityFactorN
 *            na znormalizowanych czynnikach.
 *
 * Wagi pochodzą WYŁĄCZNIE z `SIRI_PM_WEIGHT_PRESETS[planningHorizon]`
 * (str. 29, Figure 12) — ta ścieżka nie przyjmuje dowolnych wag.
 *
 * Nie mutuje `inputs`. Deterministyczna: ten sam input → ten sam wynik.
 * Gdy `Total` danego czynnika wynosi 0 (wszystkie surowe termy zerowe),
 * znormalizowany czynnik dla każdego obszaru w tej kolumnie wynosi 0
 * (whitepaper nie definiuje dzielenia przez zero — 0/0 traktowane jako
 * brak wkładu tego czynnika, nie NaN).
 */
export function rankByImpactValueV2(
  inputs: SIRIPrioritisationInput[],
  planningHorizon: SiriPmPlanningHorizon
): SIRIPrioritisationResult[] {
  const weights = SIRI_PM_WEIGHT_PRESETS[planningHorizon];
  assertWeightsSumToOne(weights);

  const rawCost = inputs.map((input) => input.costRelevance * input.costProfile);
  const rawKpi = inputs.map((input) => input.kpiRelevance * input.kpiImportance);
  const rawProximity = inputs.map((input) => Math.max(input.bic - input.ams, 0));

  const totalCost = rawCost.reduce((sum, v) => sum + v, 0);
  const totalKpi = rawKpi.reduce((sum, v) => sum + v, 0);
  const totalProximity = rawProximity.reduce((sum, v) => sum + v, 0);

  const scored = inputs.map((input, originalIndex) => {
    const area = SIRI_PRIORITISATION_AREAS.find((a) => a.id === input.areaId);

    const costFactorN = totalCost > EPSILON ? rawCost[originalIndex] / totalCost : 0;
    const kpiFactorN = totalKpi > EPSILON ? rawKpi[originalIndex] / totalKpi : 0;
    const proximityFactorN =
      totalProximity > EPSILON ? rawProximity[originalIndex] / totalProximity : 0;

    const impactValue =
      weights.cost * costFactorN + weights.kpi * kpiFactorN + weights.proximity * proximityFactorN;

    return {
      areaId: input.areaId,
      name: area?.name ?? input.areaId,
      impactValue: Math.round(impactValue * 100) / 100,
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
    calculationVersion: 'siri_pm_v2',
    planningHorizon,
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
  SIRI_PM_WEIGHT_PRESETS,
  calculateImpactValue,
  rankByImpactValue,
  rankByImpactValueV2,
  buildDefaultInputs,
};
