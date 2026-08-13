/**
 * ═══════════════════════════════════════════════════════════════════════
 * STATUS (DRD path only): INCOMPATIBLE_LEGACY_MODEL / NOT_MAPPED
 * (A12 · COORD-06 · 2026-08-13)
 * ═══════════════════════════════════════════════════════════════════════
 * This flag applies ONLY to the DRD branch of this service
 * (`getDrdPathwayRecommendation()` below / `maturityPathwayDrdData.ts`), NOT
 * to the SIRI or ADMA branches, which derive their pathway from each
 * framework's own live `*_DIMENSIONS` / `*_MATURITY_LEVELS` structures and
 * are not affected by this issue.
 *
 * Full analysis: `docs/program/METHOD_ASSESSMENT_CORE_2026-08-13/
 * DRD_PATHWAY_MAPPING_TASK.md`. Coordinator decision: COORD-06 in
 * `docs/program/METHOD_ASSESSMENT_CORE_2026-08-13/COORDINATION.md`.
 *
 * The DRD model this service consumes for `framework: 'drd'`
 * (`maturityPathwayDrdData.ts`) — 8 dimensions `D1`..`D8`, one uniform
 * 1..5 (I..V) scale, 32 transition steps — does NOT line up 1:1 with the
 * canonical DRD measurement model: 7 axes / 39 areas with MIXED native
 * scales per axis (5/5/5/7/7/6/6/5 for D1..D8 once aggregated via Canon
 * §3.2 "MAP-1.0"), implemented in `src/services/drdStructure.ts` →
 * `DRD_STRUCTURE`. See `maturityPathwayDrdData.ts` for the full measured
 * breakdown of both models.
 *
 * Consequence: `getMaturityPathway({ framework: 'drd', ... })` is NOT fed
 * by any real assessment result today — `src/method-core/methods/drd/
 * compileDrdPack.ts` deliberately does not wire it into the DRD Method
 * Pack, exactly because of this mismatch (see its `discrepancies` report
 * entry). Do not connect it to real 39-area assessment scores, and do not
 * build a heuristic/name-matching/AI-inferred mapping between the 39 areas
 * and `D1`..`D8` as a shortcut — any such mapping requires an explicit
 * decision from the DRD methodology owner plus full traceability (each
 * `D_x` level ⇄ source area(s) ⇄ approver), per the mapping task doc above.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Maturity Pathway Service — "co KONKRETNIE zrobić, by przejść z poziomu N na N+1"
 *
 * OXFORD Round 4 #4 (O1). Turns an assessment result from a DESCRIPTION ("you are
 * at level N") into a PRESCRIPTION ("do X, Y, Z to reach N+1, expect this evidence,
 * watch out for this obstacle") — for DRD, SIRI and ADMA, per dimension, per
 * current level.
 *
 * Shape: `docs/standards/CONCLUSION_LAYER_STANDARD.md` — every recommendation is
 * K1 (co jest) → K2 (co to znaczy) → K3 (co robić najpierw) → K4 (jaki efekt).
 * This is a W1/W4-adjacent variant (assessment surface) but scoped to a SINGLE
 * dimension transition rather than a whole executive summary.
 *
 * DETERMINISM (hard rule, same as R5 in the standard): the recipe — actions,
 * target evidence, typical obstacles — is built ENTIRELY from canon/structure
 * data (DRD Canon §5, SIRI/ADMA level ladders + knowledge base). There is no LLM
 * in the critical path. This is intentional: "co zrobić, by przejść z N na N+1"
 * is a lookup against a frozen methodology, not a generative task — the fallback
 * IS the primary path, not a degraded one. A future prose-polish layer (LLM) may
 * sit on TOP of `getMaturityPathway()` output, but the underlying facts (K1, K3
 * actions, K4 evidence) must never depend on it.
 *
 * Frameworks:
 * - DRD:  dimension = D1..D8 (Canon §3.2 MAP-1.0), levels 1..5 (I..V), sourced
 *         from the frozen 32-path table in `maturityPathwayDrdData.ts`.
 * - SIRI: dimension = SIRI_DIMENSIONS id (e.g. "operations"), levels 0..5,
 *         derived from `SIRI_MATURITY_LEVELS` (next level's title/description/
 *         indicators = target state) + `siriKnowledge` (evidence/mistakes).
 * - ADMA: dimension = ADMA_DIMENSIONS id (e.g. "digital_strategy"), levels 1..5,
 *         derived from `ADMA_MATURITY_LEVELS` (next level's characteristics =
 *         target state) + `admaKnowledge` (evidence/mistakes).
 */

import { ADMA_DIMENSIONS, ADMA_MATURITY_LEVELS } from '@/services/admaStructure';
import { SIRI_DIMENSIONS, SIRI_MATURITY_LEVELS } from '@/services/siriStructure';

import { getADMAKnowledge } from './admaKnowledge';
import type { DRDDimensionId } from './drdIndustryProfiles';
import { DRD_DIMENSION_IDS, DRD_DIMENSION_LABELS } from './drdIndustryProfiles';
import {
  DRD_FOUNDATION_GRAPH,
  DRD_PATHWAY_LEVEL_ROMAN,
  type DRDPathwayLevel,
  getDRDPathway,
} from './maturityPathwayDrdData';
import { getSIRIKnowledge } from './siriKnowledge';

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export type MaturityPathwayFramework = 'drd' | 'siri' | 'adma';

/** CONCLUSION_LAYER K1→K4 shape, scoped to one dimension's N→N+1 transition. */
export interface MaturityPathwayRecommendation {
  framework: MaturityPathwayFramework;
  dimensionId: string;
  dimensionName: string;
  fromLevel: number;
  toLevel: number;
  /** Human label for from/to (Roman numerals for DRD, numeric title for SIRI/ADMA). */
  fromLabel: string;
  toLabel: string;

  /** K1 — co jest: fakt (obecny poziom + jego krótka charakterystyka). */
  currentState: string;
  /** K2 — co to znaczy: konsekwencja/luka do zamknięcia, opisana przez cel N+1. */
  gapMeaning: string;
  /** K3 — co robić najpierw: 2–4 konkretne działania (czasownik + artefakt). */
  actions: string[];
  /** K4 — jaki efekt: dowód, który potwierdzi osiągnięcie N+1. */
  targetEvidence: string;
  /** Typowe przeszkody na tym przejściu (jeśli framework ma taką wiedzę; może być pusta). */
  typicalObstacles: string[];
  /** Prerequisite note from the dependency graph, if this dimension has one (DRD only today). */
  prerequisiteNote?: string;

  /** Source of the recipe — always deterministic today; reserved for future LLM polish layer. */
  source: 'canon' | 'structure-derived' | 'fallback';
}

export interface MaturityPathwayInput {
  framework: MaturityPathwayFramework;
  /** DRD: "D1".."D8". SIRI: SIRI_DIMENSIONS id. ADMA: ADMA_DIMENSIONS id. */
  dimensionId: string;
  /** Current achieved level (framework-native scale). */
  currentLevel: number;
  language?: 'pl' | 'en';
}

// ============================================================================
// TOP-LEVEL LOOKUP
// ============================================================================

/**
 * Returns the N→N+1 recipe for one (framework, dimension, currentLevel).
 * Never throws, never returns an empty recipe: at the ceiling level (no N+1)
 * or on unknown dimension/framework, returns a well-formed "already/unknown"
 * recommendation rather than null, so callers never need a null-check dance.
 */
export function getMaturityPathway(input: MaturityPathwayInput): MaturityPathwayRecommendation {
  const lang = input.language ?? 'pl';
  const fw = String(input.framework || '').toLowerCase() as MaturityPathwayFramework;

  try {
    if (fw === 'drd')
      return getDrdPathwayRecommendation(input.dimensionId, input.currentLevel, lang);
    if (fw === 'siri')
      return getSiriPathwayRecommendation(input.dimensionId, input.currentLevel, lang);
    if (fw === 'adma')
      return getAdmaPathwayRecommendation(input.dimensionId, input.currentLevel, lang);
  } catch {
    // fall through to generic fallback below
  }
  return genericFallback(input.framework, input.dimensionId, input.currentLevel, lang);
}

// ============================================================================
// DRD
// ============================================================================

function isDrdDimensionId(id: string): id is DRDDimensionId {
  return (DRD_DIMENSION_IDS as readonly string[]).includes(id);
}

function getDrdPathwayRecommendation(
  dimensionId: string,
  currentLevel: number,
  lang: 'pl' | 'en'
): MaturityPathwayRecommendation {
  if (!isDrdDimensionId(dimensionId)) {
    return genericFallback('drd', dimensionId, currentLevel, lang);
  }
  const label = DRD_DIMENSION_LABELS[dimensionId];
  const dimensionName = lang === 'en' ? label.en : label.pl;
  const clampedLevel = Math.min(Math.max(Math.round(currentLevel), 1), 5) as DRDPathwayLevel;

  if (clampedLevel >= 5) {
    return atCeiling('drd', dimensionId, dimensionName, 5, 'V', lang);
  }

  const pathway = getDRDPathway(dimensionId, clampedLevel);
  if (!pathway) {
    return genericFallback('drd', dimensionId, currentLevel, lang);
  }

  const fromRoman = DRD_PATHWAY_LEVEL_ROMAN[pathway.fromLevel];
  const toRoman = DRD_PATHWAY_LEVEL_ROMAN[pathway.toLevel];
  const foundation = DRD_FOUNDATION_GRAPH[dimensionId];

  const isPL = lang === 'pl';
  const currentState = isPL
    ? `${dimensionName} jest dziś na poziomie ${fromRoman} (Canon §4.1).`
    : `${dimensionName} is currently at level ${fromRoman} (Canon §4.1).`;

  const gapMeaning = isPL
    ? `Przejście ${fromRoman}→${toRoman} wymaga zamknięcia konkretnej luki wykonawczej (nie deklaracji): ${pathway.actions.length} elementów do zbudowania wg kanonu DRD §5, zanim wynik wymiaru realnie przesunie się na kolejny poziom.`
    : `The ${fromRoman}→${toRoman} transition requires closing a concrete execution gap (not a declaration): ${pathway.actions.length} build items per DRD Canon §5 before the dimension score genuinely moves to the next level.`;

  const targetEvidence = isPL
    ? `Poziom ${toRoman} jest potwierdzony, gdy WSZYSTKIE działania niżej działają w praktyce (nie pilotaż) i dają obserwowalny artefakt: system w użyciu, raport, log, KPI w rytmie zarządczym.`
    : `Level ${toRoman} is confirmed once ALL actions below run in practice (not a pilot) and yield an observable artefact: a system in active use, a report, a log, a KPI in the management cadence.`;

  const prerequisiteNote = foundation
    ? isPL
      ? foundation.note
      : foundation.note // canon note is PL-only today; kept identical pending EN canon translation
    : undefined;

  return {
    framework: 'drd',
    dimensionId,
    dimensionName,
    fromLevel: pathway.fromLevel,
    toLevel: pathway.toLevel,
    fromLabel: fromRoman,
    toLabel: toRoman,
    currentState,
    gapMeaning,
    actions: pathway.actions,
    targetEvidence,
    typicalObstacles: deriveDrdObstacles(dimensionId, isPL),
    prerequisiteNote,
    source: 'canon',
  };
}

/**
 * Typical obstacles are not separately catalogued in Canon §5 (which is
 * action-only); we derive a short, dimension-appropriate obstacle from the
 * foundation graph (§7.3) when one exists, otherwise a generic-but-still
 * concrete execution risk tied to the dimension's nature. Kept intentionally
 * short (this is a hint, not a risk register).
 */
function deriveDrdObstacles(dimensionId: DRDDimensionId, isPL: boolean): string[] {
  const foundation = DRD_FOUNDATION_GRAPH[dimensionId];
  const obstacles: string[] = [];
  if (foundation) {
    obstacles.push(
      isPL
        ? `Zależność wyprzedzająca: ${foundation.requires.join(', ')} musi być na poziomie ≥ III, inaczej inicjatywa nie utrzyma się (Canon §7.3).`
        : `Upstream dependency: ${foundation.requires.join(', ')} must be at level ≥ III, or the initiative will not hold (Canon §7.3).`
    );
  }
  obstacles.push(
    isPL
      ? 'Najczęstsza przeszkoda: działanie wdrożone jako pilotaż w 1 zespole, nigdy nie doprowadzone do stałego użycia w całej organizacji.'
      : 'Most common obstacle: the action ships as a single-team pilot and is never carried through to organisation-wide, standing use.'
  );
  return obstacles;
}

function atCeiling(
  framework: MaturityPathwayFramework,
  dimensionId: string,
  dimensionName: string,
  level: number,
  label: string,
  lang: 'pl' | 'en'
): MaturityPathwayRecommendation {
  const isPL = lang === 'pl';
  return {
    framework,
    dimensionId,
    dimensionName,
    fromLevel: level,
    toLevel: level,
    fromLabel: label,
    toLabel: label,
    currentState: isPL
      ? `${dimensionName} jest na najwyższym poziomie skali (${label}).`
      : `${dimensionName} is at the top of the scale (${label}).`,
    gapMeaning: isPL
      ? 'Brak kolejnego poziomu do osiągnięcia w tym wymiarze — priorytetem jest utrzymanie pozycji i transfer dobrych praktyk do innych wymiarów/obszarów.'
      : 'No further level exists for this dimension — the priority shifts to sustaining the position and transferring good practice to other dimensions/areas.',
    actions: isPL
      ? [
          'Udokumentować bieżącą praktykę jako wewnętrzny standard (playbook).',
          'Wyznaczyć właściciela utrzymania poziomu (nie tylko wdrożenia).',
          'Przenieść wzorzec na wymiar/obszar z największą luką.',
        ]
      : [
          'Document current practice as an internal standard (playbook).',
          'Assign an owner for sustaining the level (not just achieving it).',
          'Transfer the pattern to the dimension/area with the largest remaining gap.',
        ],
    targetEvidence: isPL
      ? 'Utrzymanie wyniku w kolejnym cyklu oceny + co najmniej jeden udokumentowany transfer praktyki do innego wymiaru.'
      : 'Sustained score in the next assessment cycle + at least one documented practice transfer to another dimension.',
    typicalObstacles: isPL
      ? ['Ryzyko stagnacji: brak kolejnego celu demotywuje zespół odpowiedzialny za wymiar.']
      : ['Stagnation risk: without a next target, the team owning the dimension loses momentum.'],
    source: 'canon',
  };
}

// ============================================================================
// SIRI
// ============================================================================

function getSiriPathwayRecommendation(
  dimensionId: string,
  currentLevel: number,
  lang: 'pl' | 'en'
): MaturityPathwayRecommendation {
  const dimension = SIRI_DIMENSIONS.find((d) => d.id === dimensionId);
  if (!dimension) return genericFallback('siri', dimensionId, currentLevel, lang);

  const clamped = Math.min(Math.max(Math.round(currentLevel), 0), 5);
  const isPL = lang === 'pl';

  if (clamped >= 5) {
    return atCeiling('siri', dimensionId, dimension.name, 5, 'Level 5 (Intelligent)', lang);
  }

  const fromLevel = SIRI_MATURITY_LEVELS.find((l) => l.level === clamped);
  const toLevel = SIRI_MATURITY_LEVELS.find((l) => l.level === clamped + 1);
  if (!fromLevel || !toLevel) return genericFallback('siri', dimensionId, currentLevel, lang);

  const knowledge = getSIRIKnowledge(dimensionId, clamped + 1, lang);

  const fromLabel = `${fromLevel.level} (${fromLevel.title})`;
  const toLabel = `${toLevel.level} (${toLevel.title})`;

  const currentState = isPL
    ? `${dimension.name} jest dziś na poziomie ${fromLabel}: ${fromLevel.description}`
    : `${dimension.name} is currently at level ${fromLabel}: ${fromLevel.description}`;

  const gapMeaning = isPL
    ? `Poziom ${toLabel} oznacza: ${toLevel.description} To przesunięcie z „${fromLevel.title}" do „${toLevel.title}" w Building Block ${dimension.buildingBlock}.`
    : `Level ${toLabel} means: ${toLevel.description} This is the shift from "${fromLevel.title}" to "${toLevel.title}" within the ${dimension.buildingBlock} Building Block.`;

  const actions = buildActionsFromIndicators(toLevel.indicators ?? [], isPL);

  const targetEvidence = isPL
    ? `Dowód poziomu ${toLabel}: ${knowledge.evidenceGuidance}`
    : `Evidence for level ${toLabel}: ${knowledge.evidenceGuidance}`;

  return {
    framework: 'siri',
    dimensionId,
    dimensionName: dimension.name,
    fromLevel: fromLevel.level,
    toLevel: toLevel.level,
    fromLabel,
    toLabel,
    currentState,
    gapMeaning,
    actions,
    targetEvidence,
    typicalObstacles: knowledge.commonMistakes.slice(0, 2),
    source: 'structure-derived',
  };
}

// ============================================================================
// ADMA
// ============================================================================

function getAdmaPathwayRecommendation(
  dimensionId: string,
  currentLevel: number,
  lang: 'pl' | 'en'
): MaturityPathwayRecommendation {
  const dimension = ADMA_DIMENSIONS.find((d) => d.id === dimensionId);
  if (!dimension) return genericFallback('adma', dimensionId, currentLevel, lang);

  const clamped = Math.min(Math.max(Math.round(currentLevel), 1), 5);
  const isPL = lang === 'pl';

  if (clamped >= 5) {
    return atCeiling('adma', dimensionId, dimension.name, 5, 'Level 5 (Expert)', lang);
  }

  const fromLevel = ADMA_MATURITY_LEVELS.find((l) => l.level === clamped);
  const toLevel = ADMA_MATURITY_LEVELS.find((l) => l.level === clamped + 1);
  if (!fromLevel || !toLevel) return genericFallback('adma', dimensionId, currentLevel, lang);

  const knowledge = getADMAKnowledge(dimensionId, clamped + 1, lang);

  const fromLabel = `${fromLevel.level} (${fromLevel.title})`;
  const toLabel = `${toLevel.level} (${toLevel.title})`;

  const currentState = isPL
    ? `${dimension.name} jest dziś na poziomie ${fromLabel}: ${fromLevel.description}`
    : `${dimension.name} is currently at level ${fromLabel}: ${fromLevel.description}`;

  const gapMeaning = isPL
    ? `Poziom ${toLabel} oznacza: ${toLevel.description} To przesunięcie z „${fromLevel.title}" do „${toLevel.title}" w filarze ${dimension.pillar}.`
    : `Level ${toLabel} means: ${toLevel.description} This is the shift from "${fromLevel.title}" to "${toLevel.title}" within the ${dimension.pillar} pillar.`;

  const actions = buildActionsFromIndicators(toLevel.characteristics ?? [], isPL);

  const targetEvidence = isPL
    ? `Dowód poziomu ${toLabel}: ${knowledge.evidenceGuidance}`
    : `Evidence for level ${toLabel}: ${knowledge.evidenceGuidance}`;

  return {
    framework: 'adma',
    dimensionId,
    dimensionName: dimension.name,
    fromLevel: fromLevel.level,
    toLevel: toLevel.level,
    fromLabel,
    toLabel,
    currentState,
    gapMeaning,
    actions,
    targetEvidence,
    typicalObstacles: knowledge.commonMistakes.slice(0, 2),
    source: 'structure-derived',
  };
}

// ============================================================================
// SHARED HELPERS
// ============================================================================

/** Turn a level's indicator/characteristic list into imperative build actions. */
function buildActionsFromIndicators(indicators: string[], isPL: boolean): string[] {
  if (!indicators || indicators.length === 0) {
    return isPL
      ? [
          'Zbudować i wdrożyć zdolność opisaną przez docelowy poziom (brak szczegółów w strukturze — do doprecyzowania z konsultantem).',
        ]
      : [
          'Build and deploy the capability described by the target level (no structural detail — clarify with the consultant).',
        ];
  }
  return indicators.map((indicator) =>
    isPL ? `Wdrożyć i utrzymać: ${indicator}.` : `Implement and sustain: ${indicator}.`
  );
}

function genericFallback(
  framework: MaturityPathwayFramework | string,
  dimensionId: string,
  currentLevel: number,
  lang: 'pl' | 'en'
): MaturityPathwayRecommendation {
  const isPL = lang === 'pl';
  const fw = (
    ['drd', 'siri', 'adma'].includes(String(framework).toLowerCase())
      ? (String(framework).toLowerCase() as MaturityPathwayFramework)
      : 'drd'
  ) as MaturityPathwayFramework;
  const toLevel = currentLevel + 1;
  return {
    framework: fw,
    dimensionId,
    dimensionName: dimensionId,
    fromLevel: currentLevel,
    toLevel,
    fromLabel: String(currentLevel),
    toLabel: String(toLevel),
    currentState: isPL
      ? `Wymiar "${dimensionId}" jest dziś na poziomie ${currentLevel} (dane strukturalne niedostępne dla tego identyfikatora).`
      : `Dimension "${dimensionId}" is currently at level ${currentLevel} (structural data unavailable for this id).`,
    gapMeaning: isPL
      ? 'Nie znaleziono zdefiniowanej ścieżki N→N+1 dla tego wymiaru/frameworka — poniżej ogólna recepta do doprecyzowania przez konsultanta z użyciem kanonu metodyki.'
      : 'No defined N→N+1 pathway was found for this dimension/framework — a generic recipe follows, to be refined by the consultant using the methodology canon.',
    actions: isPL
      ? [
          'Zidentyfikować z konsultantem 2–3 konkretne luki blokujące przejście na kolejny poziom.',
          'Wskazać właściciela i termin dla każdej luki.',
          'Zebrać dowód (system/log/KPI) potwierdzający domknięcie luki.',
        ]
      : [
          'Work with the consultant to identify 2–3 concrete gaps blocking the next level.',
          'Assign an owner and deadline for each gap.',
          'Collect evidence (system/log/KPI) confirming the gap is closed.',
        ],
    targetEvidence: isPL
      ? 'Do ustalenia z konsultantem na podstawie kanonu metodyki (brak zdefiniowanej ścieżki).'
      : 'To be established with the consultant from the methodology canon (no defined pathway).',
    typicalObstacles: [],
    source: 'fallback',
  };
}
