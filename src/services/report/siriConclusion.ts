/**
 * SIRI Report — Conclusion Layer (deterministic, no LLM)
 *
 * Turns SIRI engine output (`SIRIAssessmentData` + `siriStructure` helpers) into the
 * WNIOSKOWA (conclusive) presentation layer required by OXFORD O2.2, per
 * `docs/standards/CONCLUSION_LAYER_STANDARD.md` variant **W1**:
 *   - answer-first executive summary (verdict headline, K1→K2→K3→K4)
 *   - top-3 gap cards ("co jest → co znaczy → co robić → efekt")
 *
 * HARD RULE ("liczby tylko z silnika" / numbers only from the engine): every number
 * here is read from the SIRI engine (dimension current/target/gap, maturity levels,
 * building-block scores). NOTHING is invented, no LLM is called. This module only
 * INTERPRETS engine facts into consultant-grade prose deterministically.
 *
 * The old `SIRIReportTemplate` showed "wymiary + Band + gaps" but never told the reader
 * "co to znaczy i co robić najpierw". This layer supplies exactly that, grounded.
 */

import {
  SIRI_BUILDING_BLOCKS,
  SIRI_DIMENSIONS,
  SIRI_MATURITY_LEVELS,
  type SIRIAssessmentData,
  type SIRIBuildingBlock,
} from '../siriStructure';

// ============================================
// TYPES (mirror a ConclusionOutput shape so renderers stay uniform)
// ============================================

export type SIRILanguage = 'pl' | 'en';

/** Answer-first executive summary — 5 blocks mapping to K1→K2→K3→K4. */
export interface SIRIExecutiveSummary {
  /** Verdict headline (≤ ~20 words) — a thesis, not "wynik wynosi X". */
  headline: string;
  /** K1 — STAN: overall level + strongest/weakest, engine-exact. */
  k1_state: string;
  /** K2 — CO TO ZNACZY: business consequence of the profile. */
  k2_meaning: string;
  /** K1+K2 — TRZY LUKI: top-3 gaps as a single narrated sentence. */
  k3_threeGaps: string;
  /** K3 — CO NAJPIERW: lead recommendation + why this order. */
  k4_whatFirst: string;
  /** K4 — EFEKT: expected effect of Wave 1, with horizon. */
  k5_effect: string;
  /** Numbers carried through for the renderer (engine-exact). */
  facts: {
    overallScore: number;
    overallLevelTitle: string;
    strongestName: string;
    strongestScore: number;
    weakestName: string;
    weakestScore: number;
    weakestGap: number;
    assessedDimensions: number;
    totalDimensions: number;
  };
  confidence: 'high' | 'medium' | 'low' | 'insufficient';
}

/** Top-3 gap card following "co jest → co znaczy → co robić → efekt". */
export interface SIRIGapCard {
  dimensionId: string;
  dimensionName: string;
  buildingBlockName: string;
  current: number;
  target: number;
  gap: number;
  currentLevelTitle: string;
  targetLevelTitle: string;
  /** K1 — co jest. */
  whatIs: string;
  /** K2 — co to znaczy. */
  whatItMeans: string;
  /** K3 — co robić. */
  whatToDo: string;
  /** K4 — efekt. */
  effect: string;
}

export interface SIRIConclusionModel {
  language: SIRILanguage;
  executiveSummary: SIRIExecutiveSummary;
  gapCards: SIRIGapCard[];
}

// ============================================
// HELPERS
// ============================================

const round1 = (n: number) => Math.round(n * 10) / 10;

const BLOCK_ORDER: SIRIBuildingBlock[] = ['PROCESS', 'TECHNOLOGY', 'ORGANIZATION'];

function blockName(block: SIRIBuildingBlock, isPL: boolean): string {
  const cfg = SIRI_BUILDING_BLOCKS[block];
  return isPL ? cfg.namePL : cfg.name;
}

function levelTitle(score: number): string {
  const idx = Math.max(0, Math.min(SIRI_MATURITY_LEVELS.length - 1, Math.round(score)));
  return SIRI_MATURITY_LEVELS[idx]?.title ?? `Level ${idx}`;
}

/** Maturity-level description (from the SIRI canon) for a given score. */
function levelDescription(score: number): string {
  const idx = Math.max(0, Math.min(SIRI_MATURITY_LEVELS.length - 1, Math.round(score)));
  return SIRI_MATURITY_LEVELS[idx]?.description ?? '';
}

interface DimRow {
  id: string;
  name: string;
  block: SIRIBuildingBlock;
  current: number;
  target: number;
  gap: number;
}

function buildDimRows(data: SIRIAssessmentData): DimRow[] {
  return SIRI_DIMENSIONS.map((dim) => {
    const s = data.dimensions?.[dim.id];
    const current = round1(Number(s?.current ?? 0));
    const target = round1(Number(s?.target ?? 0));
    const gap = round1(Math.max(0, target - current));
    return { id: dim.id, name: dim.name, block: dim.buildingBlock, current, target, gap };
  });
}

/**
 * Recommended owner role for a building block (deterministic mapping — R6 "adresat").
 * Grounded in the SIRI building-block semantics, not invented per run.
 */
function ownerForBlock(block: SIRIBuildingBlock, isPL: boolean): string {
  const map: Record<SIRIBuildingBlock, [string, string]> = {
    PROCESS: ['Operations Lead', 'Operations Lead'],
    TECHNOLOGY: ['IT/OT Lead', 'IT/OT Lead'],
    ORGANIZATION: [isPL ? 'HR / Lider Transformacji' : 'HR / Transformation Lead', 'HR Lead'],
  };
  return isPL ? map[block][0] : map[block][1];
}

// ============================================
// EXECUTIVE SUMMARY (K1 → K2 → K3 → K4, answer-first)
// ============================================

function confidenceFor(assessed: number, total: number): SIRIExecutiveSummary['confidence'] {
  if (total === 0) return 'insufficient';
  const pct = assessed / total;
  if (pct >= 0.9) return 'high';
  if (pct >= 0.6) return 'medium';
  if (pct >= 0.3) return 'low';
  return 'insufficient';
}

function buildExecutiveSummary(
  data: SIRIAssessmentData,
  language: SIRILanguage
): SIRIExecutiveSummary {
  const isPL = language === 'pl';
  const rows = buildDimRows(data);

  const overallScore = round1(Number(data.overallScore ?? 0));
  const overallLevelTitle = levelTitle(overallScore);

  const assessed = rows.filter((r) => r.current > 0);
  const assessedCount = assessed.length;

  // Strongest = highest current among assessed; weakest = largest gap.
  const strongest = [...assessed].sort((a, b) => b.current - a.current)[0];
  const withGap = rows.filter((r) => r.gap > 0);
  const weakest = [...withGap].sort((a, b) => b.gap - a.gap)[0];

  // Top-3 gaps (for the "three gaps" paragraph).
  const topGaps = [...withGap].sort((a, b) => b.gap - a.gap).slice(0, 3);

  const strongName =
    strongest?.name ?? (isPL ? 'brak ocenionego wymiaru' : 'no assessed dimension');
  const weakName = weakest?.name ?? (isPL ? 'brak luki' : 'no gap');
  const weakBlockName = weakest ? blockName(weakest.block, isPL) : '';
  const weakGap = weakest?.gap ?? 0;
  const weakOwner = weakest ? ownerForBlock(weakest.block, isPL) : '';

  // ---- HEADLINE (verdict, not "wynik wynosi X") ----
  let headline: string;
  if (assessedCount === 0) {
    headline = isPL
      ? 'Assessment SIRI niekompletny — brak danych do jednoznacznego werdyktu.'
      : 'SIRI assessment incomplete — insufficient data for a firm verdict.';
  } else if (weakest) {
    headline = isPL
      ? `Dojrzałość „${overallLevelTitle}” (${overallScore}/5): fundamenty stoją na „${strongName}”, ale „${weakName}” hamuje przejście na wyższy poziom.`
      : `Maturity "${overallLevelTitle}" (${overallScore}/5): foundations rest on "${strongName}", but "${weakName}" blocks the next level.`;
  } else {
    headline = isPL
      ? `Dojrzałość „${overallLevelTitle}” (${overallScore}/5) — cele osiągnięte we wszystkich wymiarach; utrzymać i podnieść poprzeczkę.`
      : `Maturity "${overallLevelTitle}" (${overallScore}/5) — targets met across all dimensions; hold and raise the bar.`;
  }

  // ---- K1: STAN ----
  const k1 = isPL
    ? `Ogólna dojrzałość SIRI wynosi ${overallScore}/5 (poziom „${overallLevelTitle}”). Najsilniejszy wymiar to „${strongName}” (${round1(strongest?.current ?? 0)}/5); największa luka występuje w „${weakName}” (${round1(weakest?.current ?? 0)}/5 wobec celu ${round1(weakest?.target ?? 0)}/5). Oceniono ${assessedCount} z ${SIRI_DIMENSIONS.length} wymiarów.`
    : `Overall SIRI maturity is ${overallScore}/5 (level "${overallLevelTitle}"). The strongest dimension is "${strongName}" (${round1(strongest?.current ?? 0)}/5); the largest gap is in "${weakName}" (${round1(weakest?.current ?? 0)}/5 vs target ${round1(weakest?.target ?? 0)}/5). ${assessedCount} of ${SIRI_DIMENSIONS.length} dimensions assessed.`;

  // ---- K2: CO TO ZNACZY ----
  const k2 = weakest
    ? isPL
      ? `Profil jest nierównomierny: „${weakName}” (blok ${weakBlockName}) odstaje o ${round1(weakGap)} poziomu od celu, co oznacza, że reszta transformacji Industry 4.0 opiera się na wąskim gardle — inwestycje w mocniejsze wymiary nie przełożą się na wynik, dopóki ten obszar pozostaje na poziomie „${levelTitle(weakest.current)}”.`
      : `The profile is uneven: "${weakName}" (${weakBlockName} block) trails the target by ${round1(weakGap)} levels, meaning the rest of the Industry 4.0 transformation rests on a bottleneck — investment in stronger dimensions will not convert to results while this area sits at "${levelTitle(weakest.current)}".`
    : isPL
      ? `Wszystkie ocenione wymiary osiągnęły lub przekroczyły cel — organizacja nie ma pojedynczego wąskiego gardła; priorytetem staje się utrzymanie poziomu i podniesienie celów.`
      : `All assessed dimensions met or exceeded target — there is no single bottleneck; the priority shifts to sustaining the level and raising targets.`;

  // ---- K3 (three gaps narrated) ----
  const gapsList = topGaps
    .map((g) => `${g.name} (${round1(g.current)}→${round1(g.target)})`)
    .join('; ');
  const k3gaps = topGaps.length
    ? isPL
      ? `Trzy największe luki, w kolejności pilności: ${gapsList}. Zaniechanie ich domknięcia utrwala silosy technologiczne i uniemożliwia realną integrację danych między procesem, technologią a organizacją.`
      : `The three largest gaps, in order of urgency: ${gapsList}. Leaving them open entrenches technology silos and prevents real data integration across process, technology and organization.`
    : isPL
      ? `Brak istotnych luk — wszystkie wymiary na poziomie celu.`
      : `No material gaps — all dimensions at target level.`;

  // ---- K3 lead recommendation: what first + why ----
  const k4 = weakest
    ? isPL
      ? `Najpierw: ${weakOwner} — podnieść „${weakName}” z poziomu „${levelTitle(weakest.current)}” do „${levelTitle(weakest.target)}”, bo to ten wymiar wyznacza sufit całego bloku ${weakBlockName} i blokuje zwrot z pozostałych inwestycji. Kolejność wynika z wielkości luki (${round1(weakGap)}), nie z równoległego frontu.`
      : `First: ${weakOwner} — raise "${weakName}" from "${levelTitle(weakest.current)}" to "${levelTitle(weakest.target)}", because this dimension caps the entire ${weakBlockName} block and blocks the return on the other investments. The order follows gap size (${round1(weakGap)}), not a parallel front.`
    : isPL
      ? `Najpierw: zespół transformacji — zweryfikować cele w warsztacie i podnieść poprzeczkę na kolejnych wymiarach; nie ma luki wymuszającej pojedynczy priorytet.`
      : `First: the transformation team — validate targets in a workshop and raise the bar on the next dimensions; there is no gap forcing a single priority.`;

  // ---- K4: EFFECT ----
  const k5 = weakest
    ? isPL
      ? `Efekt: w horyzoncie 12 miesięcy domknięcie luki w „${weakName}” podnosi dojrzałość bloku ${weakBlockName} i odblokowuje integrację danych w pozostałych wymiarach — mierzalnie: wzrost „${weakName}” do ${round1(weakest.target)}/5 i przejście poziomu „${levelTitle(weakest.current)}” → „${levelTitle(weakest.target)}”.`
      : `Effect: within 12 months, closing the "${weakName}" gap raises the ${weakBlockName} block maturity and unblocks data integration across the remaining dimensions — measurably: "${weakName}" rising to ${round1(weakest.target)}/5 and the level shift "${levelTitle(weakest.current)}" → "${levelTitle(weakest.target)}".`
    : isPL
      ? `Efekt: utrzymanie osiągniętego poziomu „${overallLevelTitle}” i gotowość do podniesienia celów w kolejnym cyklu oceny.`
      : `Effect: sustaining the achieved "${overallLevelTitle}" level and readiness to raise targets in the next assessment cycle.`;

  return {
    headline,
    k1_state: k1,
    k2_meaning: k2,
    k3_threeGaps: k3gaps,
    k4_whatFirst: k4,
    k5_effect: k5,
    facts: {
      overallScore,
      overallLevelTitle,
      strongestName: strongName,
      strongestScore: round1(strongest?.current ?? 0),
      weakestName: weakName,
      weakestScore: round1(weakest?.current ?? 0),
      weakestGap: round1(weakGap),
      assessedDimensions: assessedCount,
      totalDimensions: SIRI_DIMENSIONS.length,
    },
    confidence: confidenceFor(assessedCount, SIRI_DIMENSIONS.length),
  };
}

// ============================================
// TOP-3 GAP CARDS ("co jest → co znaczy → co robić → efekt")
// ============================================

function buildGapCards(data: SIRIAssessmentData, language: SIRILanguage): SIRIGapCard[] {
  const isPL = language === 'pl';
  const rows = buildDimRows(data);
  const topGaps = rows
    .filter((r) => r.gap > 0)
    .sort((a, b) => b.gap - a.gap || BLOCK_ORDER.indexOf(a.block) - BLOCK_ORDER.indexOf(b.block))
    .slice(0, 3);

  return topGaps.map((g) => {
    const bName = blockName(g.block, isPL);
    const owner = ownerForBlock(g.block, isPL);
    const curTitle = levelTitle(g.current);
    const tgtTitle = levelTitle(g.target);
    const tgtDesc = levelDescription(g.target);

    const meansTail = isPL
      ? g.block === 'TECHNOLOGY'
        ? 'systemy działają w silosach, a dane nie przepływają między funkcjami'
        : g.block === 'PROCESS'
          ? 'procesy nie są zintegrowane end-to-end, co ogranicza widoczność i skalowalność'
          : 'ludzie i struktura nie nadążają za tempem transformacji technologicznej'
      : g.block === 'TECHNOLOGY'
        ? 'systems run in silos and data does not flow across functions'
        : g.block === 'PROCESS'
          ? 'processes are not integrated end-to-end, limiting visibility and scalability'
          : 'people and structure lag the pace of technology transformation';

    const whatIs = isPL
      ? `Wymiar „${g.name}” (blok ${bName}) jest na poziomie ${round1(g.current)}/5 — „${curTitle}”. Cel: ${round1(g.target)}/5 — „${tgtTitle}”. Luka: ${round1(g.gap)} poziomu.`
      : `The "${g.name}" dimension (${bName} block) sits at ${round1(g.current)}/5 — "${curTitle}". Target: ${round1(g.target)}/5 — "${tgtTitle}". Gap: ${round1(g.gap)} levels.`;

    const whatItMeans = isPL
      ? `Na poziomie „${curTitle}” organizacja nie korzysta ze zdolności poziomu „${tgtTitle}” (${tgtDesc}). W praktyce oznacza to, że ${meansTail}.`
      : `At "${curTitle}", the organization does not use the "${tgtTitle}" capabilities (${tgtDesc}). In practice this means ${meansTail}.`;

    const whatToDo = isPL
      ? `${owner} — zaplanować i wdrożyć przejście „${g.name}” na poziom „${tgtTitle}”, uruchamiając zdolności opisane dla tego poziomu; zacząć od pilotażu w jednym procesie krytycznym, nie od całej organizacji.`
      : `${owner} — plan and deliver the move of "${g.name}" to "${tgtTitle}", enabling the capabilities described for that level; start with a pilot in one critical process, not the whole organization.`;

    const effect = isPL
      ? `Domknięcie luki ${round1(g.gap)} poziomu podnosi „${g.name}” do ${round1(g.target)}/5 i wzmacnia cały blok ${bName}; w horyzoncie 6–12 miesięcy odblokowuje zależne inicjatywy i integrację danych.`
      : `Closing the ${round1(g.gap)}-level gap raises "${g.name}" to ${round1(g.target)}/5 and strengthens the whole ${bName} block; within 6–12 months it unblocks dependent initiatives and data integration.`;

    return {
      dimensionId: g.id,
      dimensionName: g.name,
      buildingBlockName: bName,
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
 * Build the complete SIRI conclusion model from engine output.
 * Deterministic, no LLM, no invented numbers.
 */
export function buildSIRIConclusionModel(
  data: SIRIAssessmentData,
  language: SIRILanguage = 'pl'
): SIRIConclusionModel {
  return {
    language,
    executiveSummary: buildExecutiveSummary(data, language),
    gapCards: buildGapCards(data, language),
  };
}
