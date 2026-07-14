/**
 * ADMA Report — Conclusion Layer (deterministic, no LLM)
 *
 * Turns ADMA engine output (`ADMAAssessmentData` + `admaStructure` /
 * `computeADMATransformationScores`) into the WNIOSKOWA (conclusive) presentation layer
 * required by OXFORD O2.2, per `docs/standards/CONCLUSION_LAYER_STANDARD.md` variant **W1**:
 *   - answer-first executive summary (verdict headline, K1→K2→K3→K4)
 *   - top-3 gap cards ("co jest → co znaczy → co robić → efekt")
 *   - explicit "road to Factory of the Future (FoF≥4)" — which T1–T7 transformations
 *     are below the FoF benchmark and by how much (the audit note: "aby dojść do FoF≥4
 *     musicie najpierw…").
 *
 * HARD RULE ("liczby tylko z silnika"): every number here is read from the ADMA engine
 * (dimension current/target/gap, pillar scores, maturity levels, transformation scores,
 * FoF benchmark). NOTHING is invented, no LLM is called.
 *
 * The old `ADMAReportTemplate` showed pillar/dimension profiles + a T1–T7 table but never
 * told the reader which transformations block FoF and what to do first. This layer does.
 */

import {
  ADMA_DIMENSIONS,
  ADMA_MATURITY_LEVELS,
  ADMA_PILLARS,
  type ADMAAssessmentData,
  type ADMAPillarId,
} from '../admaStructure';
import {
  type ADMATransformationScore,
  computeADMATransformationScores,
} from '../admaTransformations';

// ============================================
// TYPES
// ============================================

export type ADMALanguage = 'pl' | 'en';

export interface ADMAExecutiveSummary {
  /** Verdict headline — a thesis (FoF-oriented), not "wynik wynosi X". */
  headline: string;
  k1_state: string;
  k2_meaning: string;
  k3_threeGaps: string;
  k4_whatFirst: string;
  k5_effect: string;
  facts: {
    overallMaturity: number;
    overallLevelTitle: string;
    strongestPillarName: string;
    strongestPillarScore: number;
    weakestPillarName: string;
    weakestPillarScore: number;
    fofBenchmark: number;
    transformationsBelowFoF: number;
    largestFoFGapName: string;
    largestFoFGap: number;
  };
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
}

export interface ADMAGapCard {
  dimensionId: string;
  dimensionName: string;
  pillarName: string;
  current: number;
  target: number;
  gap: number;
  currentLevelTitle: string;
  targetLevelTitle: string;
  whatIs: string;
  whatItMeans: string;
  whatToDo: string;
  effect: string;
}

/** One row of the explicit "road to FoF≥4" bar. */
export interface FoFRoadItem {
  id: string;
  name: string;
  current: number | null;
  fofBenchmark: number;
  /** Positive = distance to close to reach FoF; ≤0 = at/above FoF. */
  gapToFoF: number | null;
  atOrAboveFoF: boolean;
}

export interface FoFRoad {
  benchmark: number;
  /** Transformations below the FoF benchmark, largest gap first. */
  belowFoF: FoFRoadItem[];
  /** Transformations at or above the FoF benchmark. */
  atOrAboveFoF: FoFRoadItem[];
  /** All T1–T7 rows in canonical order. */
  all: FoFRoadItem[];
  /** Answer-first summary sentence for the bar. */
  summary: string;
}

export interface ADMAConclusionModel {
  language: ADMALanguage;
  executiveSummary: ADMAExecutiveSummary;
  gapCards: ADMAGapCard[];
  fofRoad: FoFRoad;
}

// ============================================
// HELPERS
// ============================================

const round1 = (n: number) => Math.round(n * 10) / 10;

const PILLAR_ORDER: ADMAPillarId[] = [
  'strategy',
  'smart_products',
  'smart_operations',
  'smart_supply',
  'data_driven',
];

function pillarName(id: ADMAPillarId, isPL: boolean): string {
  const cfg = ADMA_PILLARS[id];
  return isPL ? cfg.namePL : cfg.name;
}

function levelTitle(score: number): string {
  const lvl = ADMA_MATURITY_LEVELS.find((l) => l.level === Math.max(1, Math.round(score)));
  return lvl?.title ?? 'N/A';
}

function levelDescription(score: number): string {
  const lvl = ADMA_MATURITY_LEVELS.find((l) => l.level === Math.max(1, Math.round(score)));
  return lvl?.description ?? '';
}

/** Owner role for a pillar (deterministic — R6 "adresat"). */
function ownerForPillar(id: ADMAPillarId, isPL: boolean): string {
  const map: Record<ADMAPillarId, [string, string]> = {
    strategy: [isPL ? 'Zarząd / Lider Cyfrowy' : 'Board / Digital Lead', 'Board'],
    smart_products: [isPL ? 'Dyrektor Produktu' : 'Head of Product', 'Head of Product'],
    smart_operations: ['Operations Lead', 'Operations Lead'],
    smart_supply: [isPL ? 'Dyrektor Łańcucha Dostaw' : 'Supply Chain Lead', 'Supply Chain Lead'],
    data_driven: [isPL ? 'Lider Danych / CDO' : 'Data Lead / CDO', 'Data Lead'],
  };
  return isPL ? map[id][0] : map[id][1];
}

interface DimRow {
  id: string;
  name: string;
  pillar: ADMAPillarId;
  current: number;
  target: number;
  gap: number;
}

function buildDimRows(data: ADMAAssessmentData): DimRow[] {
  return ADMA_DIMENSIONS.map((dim) => {
    const s = data.dimensions?.[dim.id];
    const current = round1(Number(s?.current ?? 0));
    const target = round1(Number(s?.target ?? 0));
    const gap = round1(Math.max(0, target - current));
    return { id: dim.id, name: dim.namePL || dim.name, pillar: dim.pillar, current, target, gap };
  });
}

interface PillarRow {
  id: ADMAPillarId;
  name: string;
  current: number;
  target: number;
  gap: number;
}

function buildPillarRows(data: ADMAAssessmentData, isPL: boolean): PillarRow[] {
  return PILLAR_ORDER.map((id) => {
    const p = data.pillars?.[id];
    const current = round1(Number(p?.current ?? 0));
    const target = round1(Number(p?.target ?? 0));
    const gap = round1(Math.max(0, target - current));
    return { id, name: pillarName(id, isPL), current, target, gap };
  });
}

// ============================================
// ROAD TO FACTORY OF THE FUTURE (FoF≥4)
// ============================================

/**
 * Build the explicit "road to FoF≥4" bar from engine transformation scores.
 * Answers the audit gap: "aby dojść do FoF≥4 musicie najpierw…".
 */
export function buildFoFRoad(
  data: ADMAAssessmentData,
  language: ADMALanguage,
  fofBenchmark = 4.0
): FoFRoad {
  const isPL = language === 'pl';
  const scores: ADMATransformationScore[] = computeADMATransformationScores({
    dimensions: Object.fromEntries(
      ADMA_DIMENSIONS.map((d) => [
        d.id,
        {
          current: data.dimensions?.[d.id]?.current ?? null,
          target: data.dimensions?.[d.id]?.target ?? null,
        },
      ])
    ),
    fofBenchmark,
  });

  const all: FoFRoadItem[] = scores.map((t) => ({
    id: t.id,
    name: `${t.id} ${t.name}`,
    current: t.current,
    fofBenchmark: t.fofBenchmark,
    gapToFoF: t.gapToFoF,
    atOrAboveFoF: t.gapToFoF !== null && t.gapToFoF <= 0,
  }));

  const belowFoF = all
    .filter((t) => t.gapToFoF !== null && t.gapToFoF > 0)
    .sort((a, b) => (b.gapToFoF ?? 0) - (a.gapToFoF ?? 0));
  const atOrAboveFoF = all.filter((t) => t.gapToFoF !== null && t.gapToFoF <= 0);

  let summary: string;
  if (belowFoF.length === 0 && atOrAboveFoF.length > 0) {
    summary = isPL
      ? `Wszystkie oceniane transformacje osiągają próg Factory of the Future (FoF ≥ ${fofBenchmark}). Utrzymać poziom i celować wyżej.`
      : `All assessed transformations reach the Factory of the Future threshold (FoF ≥ ${fofBenchmark}). Sustain the level and aim higher.`;
  } else if (belowFoF.length > 0) {
    const top = belowFoF[0];
    summary = isPL
      ? `Aby dojść do Factory of the Future (FoF ≥ ${fofBenchmark}), ${belowFoF.length} z ${all.length} transformacji jest poniżej progu — najdalej „${top.name}” (brakuje ${round1(top.gapToFoF ?? 0)} punktu). Kolejność zamykania: od największej luki do FoF.`
      : `To reach the Factory of the Future (FoF ≥ ${fofBenchmark}), ${belowFoF.length} of ${all.length} transformations are below the threshold — furthest is "${top.name}" (short by ${round1(top.gapToFoF ?? 0)} points). Close in order: largest FoF gap first.`;
  } else {
    summary = isPL
      ? `Brak danych do wyznaczenia drogi do FoF — uzupełnić oceny wymiarów zasilających transformacje T1–T7.`
      : `Insufficient data to chart the road to FoF — complete the dimension scores feeding transformations T1–T7.`;
  }

  return { benchmark: fofBenchmark, belowFoF, atOrAboveFoF, all, summary };
}

// ============================================
// EXECUTIVE SUMMARY
// ============================================

function confidenceFor(assessed: number, total: number): ADMAExecutiveSummary['confidence'] {
  if (total === 0) return 'insufficient';
  const pct = assessed / total;
  if (pct >= 0.9) return 'high';
  if (pct >= 0.6) return 'medium';
  if (pct >= 0.3) return 'low';
  return 'insufficient';
}

function buildExecutiveSummary(
  data: ADMAAssessmentData,
  language: ADMALanguage,
  fofRoad: FoFRoad
): ADMAExecutiveSummary {
  const isPL = language === 'pl';
  const dimRows = buildDimRows(data);
  const pillarRows = buildPillarRows(data, isPL);

  const overallMaturity = round1(Number(data.overallMaturity ?? 0));
  const overallLevelTitle = levelTitle(overallMaturity);

  const assessedDims = dimRows.filter((r) => r.current > 0);
  const assessedCount = assessedDims.length;

  const assessedPillars = pillarRows.filter((p) => p.current > 0);
  const strongestPillar = [...assessedPillars].sort((a, b) => b.current - a.current)[0];
  const weakestPillar = [...assessedPillars].sort((a, b) => a.current - b.current)[0];

  const topGaps = dimRows
    .filter((r) => r.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 3);

  const strongPName = strongestPillar?.name ?? (isPL ? 'brak' : 'none');
  const weakPName = weakestPillar?.name ?? (isPL ? 'brak' : 'none');
  const weakPId = weakestPillar?.id;
  const weakOwner = weakPId ? ownerForPillar(weakPId, isPL) : '';

  const belowCount = fofRoad.belowFoF.length;
  const topFoF = fofRoad.belowFoF[0];
  const fof = fofRoad.benchmark;

  // ---- HEADLINE (FoF-oriented verdict) ----
  let headline: string;
  if (assessedCount === 0) {
    headline = isPL
      ? 'Assessment ADMA niekompletny — brak danych do werdyktu o gotowości do Factory of the Future.'
      : 'ADMA assessment incomplete — insufficient data to judge Factory of the Future readiness.';
  } else if (belowCount > 0 && topFoF) {
    headline = isPL
      ? `Dojrzałość „${overallLevelTitle}” (${overallMaturity}/5): do Factory of the Future (FoF ≥ ${fof}) brakuje domknięcia ${belowCount} transformacji — najpierw „${topFoF.name}”.`
      : `Maturity "${overallLevelTitle}" (${overallMaturity}/5): reaching the Factory of the Future (FoF ≥ ${fof}) requires closing ${belowCount} transformations — starting with "${topFoF.name}".`;
  } else {
    headline = isPL
      ? `Dojrzałość „${overallLevelTitle}” (${overallMaturity}/5) — próg Factory of the Future (FoF ≥ ${fof}) osiągnięty; utrzymać i skalować.`
      : `Maturity "${overallLevelTitle}" (${overallMaturity}/5) — Factory of the Future threshold (FoF ≥ ${fof}) reached; sustain and scale.`;
  }

  // ---- K1: STAN ----
  const k1 = isPL
    ? `Ogólna dojrzałość ADMA wynosi ${overallMaturity}/5 (poziom „${overallLevelTitle}”). Najsilniejszy filar to „${strongPName}” (${round1(strongestPillar?.current ?? 0)}/5), najsłabszy „${weakPName}” (${round1(weakestPillar?.current ?? 0)}/5). Poniżej progu Factory of the Future (FoF ≥ ${fof}) znajduje się ${belowCount} z ${fofRoad.all.length} transformacji. Oceniono ${assessedCount} z ${ADMA_DIMENSIONS.length} wymiarów.`
    : `Overall ADMA maturity is ${overallMaturity}/5 (level "${overallLevelTitle}"). The strongest pillar is "${strongPName}" (${round1(strongestPillar?.current ?? 0)}/5), the weakest "${weakPName}" (${round1(weakestPillar?.current ?? 0)}/5). ${belowCount} of ${fofRoad.all.length} transformations sit below the Factory of the Future threshold (FoF ≥ ${fof}). ${assessedCount} of ${ADMA_DIMENSIONS.length} dimensions assessed.`;

  // ---- K2: CO TO ZNACZY ----
  const k2 = topFoF
    ? isPL
      ? `To oznacza, że firma nie jest jeszcze Fabryką Przyszłości: transformacja „${topFoF.name}” jest o ${round1(topFoF.gapToFoF ?? 0)} punktu poniżej progu FoF, a filar „${weakPName}” ciągnie profil w dół. Dopóki te obszary pozostają poniżej progu, przewaga z mocniejszych filarów nie przekłada się na status FoF.`
      : `This means the company is not yet a Factory of the Future: the "${topFoF.name}" transformation is ${round1(topFoF.gapToFoF ?? 0)} points below the FoF threshold, and the "${weakPName}" pillar drags the profile down. While these areas stay below the threshold, the edge from stronger pillars does not translate into FoF status.`
    : isPL
      ? `Wszystkie transformacje osiągnęły próg FoF — organizacja spełnia kryterium Factory of the Future; priorytetem jest utrzymanie i skalowanie zdobytej pozycji.`
      : `All transformations reached the FoF threshold — the organization meets the Factory of the Future criterion; the priority is to sustain and scale.`;

  // ---- K3: three gaps ----
  const gapsList = topGaps
    .map((g) => `${g.name} (${round1(g.current)}→${round1(g.target)})`)
    .join('; ');
  const k3gaps = topGaps.length
    ? isPL
      ? `Trzy największe luki wymiarów, w kolejności pilności: ${gapsList}. Te luki są korzeniami transformacji poniżej progu FoF — ich zaniechanie utrwala dystans do Fabryki Przyszłości.`
      : `The three largest dimension gaps, in order of urgency: ${gapsList}. These gaps are the roots of the sub-FoF transformations — leaving them open entrenches the distance to the Factory of the Future.`
    : isPL
      ? `Brak istotnych luk wymiarów względem celów.`
      : `No material dimension gaps versus targets.`;

  // ---- K3 lead recommendation ----
  const k4 = topFoF
    ? isPL
      ? `Najpierw: ${weakOwner} — domknąć transformację „${topFoF.name}” do progu FoF (${fof}), bo ma największy dystans (${round1(topFoF.gapToFoF ?? 0)}) i wyznacza sufit gotowości do Fabryki Przyszłości. Kolejność wynika z dystansu do FoF, nie z równoległego frontu.`
      : `First: ${weakOwner} — close the "${topFoF.name}" transformation to the FoF threshold (${fof}), because it has the largest distance (${round1(topFoF.gapToFoF ?? 0)}) and caps Factory of the Future readiness. The order follows FoF distance, not a parallel front.`
    : isPL
      ? `Najpierw: zespół transformacji — utrzymać poziom FoF i wyznaczyć wyższe cele w warsztacie; nie ma transformacji poniżej progu wymuszającej pojedynczy priorytet.`
      : `First: the transformation team — sustain FoF and set higher targets in a workshop; no sub-FoF transformation forces a single priority.`;

  // ---- K4: effect ----
  const k5 = topFoF
    ? isPL
      ? `Efekt: w horyzoncie 12–18 miesięcy domknięcie „${topFoF.name}” do ${fof} przenosi ${belowCount === 1 ? 'ostatnią transformację' : 'pierwszą z ' + belowCount + ' transformacji'} nad próg FoF — mierzalnie zbliża firmę do statusu Factory of the Future i odblokowuje pozostałe obszary poniżej progu.`
      : `Effect: within 12–18 months, closing "${topFoF.name}" to ${fof} moves ${belowCount === 1 ? 'the last transformation' : 'the first of ' + belowCount + ' transformations'} above the FoF threshold — measurably closing the distance to Factory of the Future status and unblocking the remaining sub-FoF areas.`
    : isPL
      ? `Efekt: utrzymanie statusu Factory of the Future i gotowość do podniesienia celów w kolejnym cyklu.`
      : `Effect: sustaining Factory of the Future status and readiness to raise targets next cycle.`;

  return {
    headline,
    k1_state: k1,
    k2_meaning: k2,
    k3_threeGaps: k3gaps,
    k4_whatFirst: k4,
    k5_effect: k5,
    facts: {
      overallMaturity,
      overallLevelTitle,
      strongestPillarName: strongPName,
      strongestPillarScore: round1(strongestPillar?.current ?? 0),
      weakestPillarName: weakPName,
      weakestPillarScore: round1(weakestPillar?.current ?? 0),
      fofBenchmark: fof,
      transformationsBelowFoF: belowCount,
      largestFoFGapName: topFoF?.name ?? (isPL ? 'brak' : 'none'),
      largestFoFGap: round1(topFoF?.gapToFoF ?? 0),
    },
    confidence: confidenceFor(assessedCount, ADMA_DIMENSIONS.length),
  };
}

// ============================================
// TOP-3 GAP CARDS
// ============================================

function buildGapCards(data: ADMAAssessmentData, language: ADMALanguage): ADMAGapCard[] {
  const isPL = language === 'pl';
  const rows = buildDimRows(data);
  const topGaps = rows
    .filter((r) => r.gap > 0)
    .sort(
      (a, b) => b.gap - a.gap || PILLAR_ORDER.indexOf(a.pillar) - PILLAR_ORDER.indexOf(b.pillar)
    )
    .slice(0, 3);

  return topGaps.map((g) => {
    const pName = pillarName(g.pillar, isPL);
    const owner = ownerForPillar(g.pillar, isPL);
    const curTitle = levelTitle(g.current);
    const tgtTitle = levelTitle(g.target);
    const tgtDesc = levelDescription(g.target);

    const whatIs = isPL
      ? `Wymiar „${g.name}” (filar ${pName}) jest na poziomie ${round1(g.current)}/5 — „${curTitle}”. Cel: ${round1(g.target)}/5 — „${tgtTitle}”. Luka: ${round1(g.gap)} poziomu.`
      : `The "${g.name}" dimension (${pName} pillar) sits at ${round1(g.current)}/5 — "${curTitle}". Target: ${round1(g.target)}/5 — "${tgtTitle}". Gap: ${round1(g.gap)} levels.`;

    const whatItMeans = isPL
      ? `Na poziomie „${curTitle}” organizacja nie korzysta ze zdolności poziomu „${tgtTitle}” (${tgtDesc}). Ten wymiar zasila transformacje ADMA — jego niedobór podnosi dystans firmy do progu Factory of the Future.`
      : `At "${curTitle}", the organization does not use the "${tgtTitle}" capabilities (${tgtDesc}). This dimension feeds the ADMA transformations — its shortfall widens the distance to the Factory of the Future threshold.`;

    const whatToDo = isPL
      ? `${owner} — zaplanować przejście „${g.name}” na poziom „${tgtTitle}”, uruchamiając zdolności opisane dla tego poziomu; zacząć od jednego pilotażu, nie od całego filaru naraz.`
      : `${owner} — plan the move of "${g.name}" to "${tgtTitle}", enabling the capabilities described for that level; start with one pilot, not the whole pillar at once.`;

    const effect = isPL
      ? `Domknięcie luki ${round1(g.gap)} poziomu podnosi „${g.name}” do ${round1(g.target)}/5 i wzmacnia filar ${pName}; w horyzoncie 6–12 miesięcy zbliża powiązane transformacje do progu FoF.`
      : `Closing the ${round1(g.gap)}-level gap raises "${g.name}" to ${round1(g.target)}/5 and strengthens the ${pName} pillar; within 6–12 months it moves the linked transformations toward the FoF threshold.`;

    return {
      dimensionId: g.id,
      dimensionName: g.name,
      pillarName: pName,
      current: g.current,
      target: g.target,
      gap: g.gap,
      currentLevelTitle: curTitle,
      targetLevelTitle: tgtTitle,
      whatIs,
      whatItMeans,
      whatToDo,
      effect,
    };
  });
}

// ============================================
// PUBLIC ENTRY
// ============================================

/**
 * Build the complete ADMA conclusion model from engine output.
 * Deterministic, no LLM, no invented numbers.
 */
export function buildADMAConclusionModel(
  data: ADMAAssessmentData,
  language: ADMALanguage = 'pl',
  fofBenchmark = 4.0
): ADMAConclusionModel {
  const fofRoad = buildFoFRoad(data, language, fofBenchmark);
  return {
    language,
    executiveSummary: buildExecutiveSummary(data, language, fofRoad),
    gapCards: buildGapCards(data, language),
    fofRoad,
  };
}
