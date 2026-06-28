/**
 * cardSpecBuilders — F3 (D11): czyste producenty `CardSpec` z danych sekcji.
 *
 * Każdy builder bierze SUROWE dane jednej sekcji inicjatywy (problem / teza-stan
 * docelowy / business-case) i mapuje pola → deklaratywne BLOKI (`CardBlock`),
 * które generyczny `CardBlockRenderer` zamienia na UI. To zastępuje bespoke JSX
 * kart rdzenia jednym kontraktem — i jest dokładnie tym, co AI-generator może
 * EMITOWAĆ wprost (grammar zamiast wolnego tekstu).
 *
 * Zasady:
 *   - CZYSTE funkcje: bez React, bez i18n-providera, bez sieci → unit-testowalne.
 *   - DEFENSYWNE: brakujące/puste pola są pomijane (nie tworzą pustych bloków).
 *     Builder NIGDY nie rzuca; przy całkiem pustym wejściu zwraca kartę bez
 *     bloków (renderer pokaże łagodny empty-state, walidator zgłosi CB-03).
 *   - `sectionKey` = parytet z SECTION_REGISTRY (np. 'problemDefinition').
 *   - Etykiety bloków przyjmowane przez `labels` (i18n po stronie wołającego);
 *     gdy brak — używane są neutralne fallbacki PL.
 */

import {
  type CalloutBlock,
  type CardBlock,
  type CardSpec,
  type KpiTile,
  validateCardSpec,
} from './cardBlockSchema';

// ── helpers ──────────────────────────────────────────────────────────────────

function isNonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/** Czyści tekst (trim) lub zwraca undefined dla pustych. */
function clean(v: unknown): string | undefined {
  return isNonEmpty(v) ? v.trim() : undefined;
}

/** Filtruje tablicę stringów do niepustych, przyciętych pozycji. */
function cleanList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (isNonEmpty(x) ? x.trim() : '')).filter((x) => x.length > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1) PROBLEM — symptom / rootCause / costOfInaction
// ─────────────────────────────────────────────────────────────────────────────

export interface ProblemCardData {
  symptom?: string | null;
  rootCause?: string | null;
  costOfInaction?: string | null;
}

export interface ProblemCardLabels {
  /** Tytuł karty (action-title). */
  title?: string;
  symptomHeading?: string;
  rootCauseHeading?: string;
  costOfInactionTitle?: string;
}

const PROBLEM_FALLBACK_LABELS: Required<ProblemCardLabels> = {
  title: 'Definicja problemu',
  symptomHeading: 'Symptom',
  rootCauseHeading: 'Przyczyna źródłowa',
  costOfInactionTitle: 'Koszt bezczynności',
};

/**
 * Buduje `CardSpec` karty problemu:
 *   symptom        → heading + paragraph
 *   rootCause      → heading + paragraph
 *   costOfInaction → callout (tone: danger)
 */
export function buildProblemCardSpec(
  data: ProblemCardData | null | undefined,
  labels: ProblemCardLabels = {},
): CardSpec {
  const L = { ...PROBLEM_FALLBACK_LABELS, ...labels };
  const blocks: CardBlock[] = [];

  const symptom = clean(data?.symptom);
  if (symptom) {
    blocks.push({ type: 'heading', text: L.symptomHeading, level: 4 });
    blocks.push({ type: 'paragraph', text: symptom });
  }

  const rootCause = clean(data?.rootCause);
  if (rootCause) {
    blocks.push({ type: 'heading', text: L.rootCauseHeading, level: 4 });
    blocks.push({ type: 'paragraph', text: rootCause });
  }

  const cost = clean(data?.costOfInaction);
  if (cost) {
    blocks.push({
      type: 'callout',
      tone: 'danger',
      title: L.costOfInactionTitle,
      text: cost,
    } satisfies CalloutBlock);
  }

  return { sectionKey: 'problemDefinition', title: L.title, blocks };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2) TARGET STATE — vision/thesis + successCriteria[] + deliverables[]
// ─────────────────────────────────────────────────────────────────────────────

export interface TargetStateCardData {
  /** Teza / wizja stanu docelowego (proza). */
  vision?: string | null;
  /** Mierzalne kryteria sukcesu. */
  successCriteria?: string[] | null;
  /** Konkretne produkty/rezultaty. */
  deliverables?: string[] | null;
}

export interface TargetStateCardLabels {
  title?: string;
  visionHeading?: string;
  successCriteriaHeading?: string;
  deliverablesHeading?: string;
}

const TARGET_FALLBACK_LABELS: Required<TargetStateCardLabels> = {
  title: 'Stan docelowy',
  visionHeading: 'Teza',
  successCriteriaHeading: 'Kryteria sukcesu',
  deliverablesHeading: 'Rezultaty',
};

/**
 * Buduje `CardSpec` karty stanu docelowego:
 *   vision           → paragraph (emphasis: lead)
 *   successCriteria  → heading + bullet_list
 *   deliverables     → heading + bullet_list
 */
export function buildTargetStateCardSpec(
  data: TargetStateCardData | null | undefined,
  labels: TargetStateCardLabels = {},
): CardSpec {
  const L = { ...TARGET_FALLBACK_LABELS, ...labels };
  const blocks: CardBlock[] = [];

  const vision = clean(data?.vision);
  if (vision) {
    blocks.push({ type: 'paragraph', text: vision, emphasis: 'lead' });
  }

  const criteria = cleanList(data?.successCriteria);
  if (criteria.length > 0) {
    blocks.push({ type: 'heading', text: L.successCriteriaHeading, level: 4 });
    blocks.push({ type: 'bullet_list', items: criteria });
  }

  const deliverables = cleanList(data?.deliverables);
  if (deliverables.length > 0) {
    blocks.push({ type: 'heading', text: L.deliverablesHeading, level: 4 });
    blocks.push({ type: 'bullet_list', items: deliverables });
  }

  return { sectionKey: 'targetState', title: L.title, blocks };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3) BUSINESS CASE — KPI (inwestycja/zwrot/payback) + uzasadnienie + ryzyko
// ─────────────────────────────────────────────────────────────────────────────

/** Wartości KPI są już SFORMATOWANE po stronie producenta ("1,2 mln zł", "37%"). */
export interface BusinessCaseCardData {
  /** Proza uzasadnienia inwestycji. */
  rationale?: string | null;
  /** Sformatowane KPI finansowe. */
  investment?: string | null;
  expectedReturn?: string | null;
  /** np. "8 mies." */
  payback?: string | null;
  /** np. "37%" — pokazane jako delta przy zwrocie. */
  roi?: string | null;
  /** Kluczowe ryzyko / zastrzeżenie. */
  keyRisk?: string | null;
}

export interface BusinessCaseCardLabels {
  title?: string;
  rationaleHeading?: string;
  investmentLabel?: string;
  expectedReturnLabel?: string;
  paybackLabel?: string;
  keyRiskTitle?: string;
}

const BUSINESS_CASE_FALLBACK_LABELS: Required<BusinessCaseCardLabels> = {
  title: 'Business case',
  rationaleHeading: 'Uzasadnienie',
  investmentLabel: 'Inwestycja',
  expectedReturnLabel: 'Oczekiwany zwrot',
  paybackLabel: 'Zwrot w czasie',
  keyRiskTitle: 'Kluczowe ryzyko',
};

/**
 * Buduje `CardSpec` karty business-case:
 *   investment/return/payback → kpi_strip (return niesie deltę roi)
 *   rationale                 → heading + paragraph
 *   keyRisk                   → callout (tone: warning)
 */
export function buildBusinessCaseCardSpec(
  data: BusinessCaseCardData | null | undefined,
  labels: BusinessCaseCardLabels = {},
): CardSpec {
  const L = { ...BUSINESS_CASE_FALLBACK_LABELS, ...labels };
  const blocks: CardBlock[] = [];

  const tiles: KpiTile[] = [];
  const investment = clean(data?.investment);
  if (investment) {
    tiles.push({ label: L.investmentLabel, value: investment });
  }
  const expectedReturn = clean(data?.expectedReturn);
  if (expectedReturn) {
    const roi = clean(data?.roi);
    tiles.push({
      label: L.expectedReturnLabel,
      value: expectedReturn,
      ...(roi ? { delta: roi, trend: 'up' as const } : {}),
    });
  }
  const payback = clean(data?.payback);
  if (payback) {
    tiles.push({ label: L.paybackLabel, value: payback });
  }
  if (tiles.length > 0) {
    blocks.push({ type: 'kpi_strip', tiles });
  }

  const rationale = clean(data?.rationale);
  if (rationale) {
    blocks.push({ type: 'heading', text: L.rationaleHeading, level: 4 });
    blocks.push({ type: 'paragraph', text: rationale });
  }

  const keyRisk = clean(data?.keyRisk);
  if (keyRisk) {
    blocks.push({
      type: 'callout',
      tone: 'warning',
      title: L.keyRiskTitle,
      text: keyRisk,
    } satisfies CalloutBlock);
  }

  return { sectionKey: 'businessCase', title: L.title, blocks };
}

// ── opcjonalny convenience: builder + walidacja w jednym ─────────────────────

/**
 * Czy zbudowany spec jest renderowalny (brak CRITICAL z walidatora)?
 * Wygodne dla wołającego, by zdecydować display-vs-edit, bez znajomości schematu.
 */
export function isBuiltSpecRenderable(spec: CardSpec): boolean {
  return !validateCardSpec(spec).some((it) => it.severity === 'CRITICAL');
}
