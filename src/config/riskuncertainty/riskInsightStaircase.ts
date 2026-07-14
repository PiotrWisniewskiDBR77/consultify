/**
 * Risk & Uncertainty — insight staircase + evidence discipline (OXFORD O3).
 *
 * Pattern mirror of src/config/portfolio/portfolioValueStaircase.ts and
 * src/config/swot/swotInsightStaircase.ts. Where SWOT enforces
 * fact -> interpretation -> implication per item, Risk & Uncertainty enforces
 * the same staircase behind EVERY probability/impact score, and adds the two
 * disciplines that separate a partner's risk register from a fear list:
 *
 *   1. NO INVENTED NUMBERS (transferred from Portfolio's guard). A probability or
 *      impact is a number. A high-exposure number asserted with no signal behind
 *      it is a guess dressed as analysis. The guard flags a scored risk that has
 *      no evidence and is not marked as an explicit assumption — the same way
 *      Portfolio flags a quantified value claim with no sourced rung.
 *
 *   2. RISK vs UNCERTAINTY (Knight's distinction — the Oxford-merit core). A
 *      KNOWN-UNKNOWN is a nameable event you can attach a base rate to: it belongs
 *      on the 2x2 and earns a probability. An UNKNOWN-UNKNOWN is deep uncertainty
 *      — novel, unprecedented, structurally unpredictable: pinning a precise
 *      probability on it is FALSE PRECISION, itself an invented number. Deep
 *      uncertainty is handled by robustness (optionality, signals-to-watch,
 *      stress scenarios), not by a point estimate and a mitigation line.
 *
 * The staircase makes "where did this risk assessment come from?" answerable:
 *   FACT          — which observed signal grounds this risk being real?
 *   INTERPRETATION — why does that signal imply THIS probability x impact?
 *   IMPLICATION   — therefore which response, on which trigger?
 *
 * Pure, deterministic, bilingual (PL/EN). Consumed by tests, the review-gap
 * computation, and as an adversarial checklist fed back into the AI prompt.
 */

import type { RiskAssumption, RiskItem, RiskUncertaintyData } from '@/store/useToolStore';

import type { Bilingual } from './deepeningLadder';

// ---------------------------------------------------------------------------
// The three-rung insight staircase (shared shape with SWOT/Portfolio)
// ---------------------------------------------------------------------------

export type RiskStaircaseRungId = 'fact' | 'interpretation' | 'implication';

export const RISK_STAIRCASE_RUNGS: RiskStaircaseRungId[] = [
  'fact',
  'interpretation',
  'implication',
];

export interface RiskStaircaseRung {
  id: RiskStaircaseRungId;
  label: Bilingual;
  prompt: Bilingual;
}

/** The staircase behind every risk assessment — "skąd ta ocena ryzyka?". */
export const RISK_INSIGHT_STAIRCASE: RiskStaircaseRung[] = [
  {
    id: 'fact',
    label: { pl: 'Fakt', en: 'Fact' },
    prompt: {
      pl: 'Jaki OBSERWOWALNY sygnał (dane, wywiad, benchmark) świadczy, że to ryzyko jest realne, a nie wyobrażone?',
      en: 'Which OBSERVABLE signal (data, interview, benchmark) shows this risk is real, not imagined?',
    },
  },
  {
    id: 'interpretation',
    label: { pl: 'Interpretacja', en: 'Interpretation' },
    prompt: {
      pl: 'Dlaczego ten sygnał uzasadnia AKURAT to prawdopodobieństwo i ten wpływ — jaka jest baza porównawcza?',
      en: 'Why does that signal justify THIS probability and THIS impact — what is the base rate you lean on?',
    },
  },
  {
    id: 'implication',
    label: { pl: 'Implikacja', en: 'Implication' },
    prompt: {
      pl: 'Co z tego wynika dla działania — jaka reakcja i po jakim triggerze, zanim ryzyko się zmaterializuje?',
      en: 'What does it imply for action — which response, on which trigger, before the risk materializes?',
    },
  },
];

// ---------------------------------------------------------------------------
// Risk vs uncertainty — Knight's distinction (known-unknown vs unknown-unknown)
// ---------------------------------------------------------------------------

export type EpistemicType = 'known-unknown' | 'unknown-unknown';

/**
 * Language that signals DEEP uncertainty — a condition no honest base rate can
 * price. When present with no evidence, the item is an unknown-unknown and a
 * precise probability on it is false precision.
 */
const DEEP_UNCERTAINTY_HINT =
  /\b(unprecedented|no precedent|black swan|cannot know|can'?t know|unknowable|unpredictable|structural(ly)? uncertain|first[- ]of[- ]its[- ]kind|paradigm shift)\b|(bezprecedensow|czarny łabędź|nie sposób przewidzieć|nieprzewidywaln|nieznane nieznane|nowość rynkow|pierwszy raz|zmiana paradygmat|nie da się oszacować)/i;

export function textSignalsDeepUncertainty(text: string): boolean {
  return DEEP_UNCERTAINTY_HINT.test(text);
}

export interface EpistemicClassificationInput {
  text: string;
  /** Evidence signal ids/labels backing the item. */
  evidence?: string[];
  /** 1..5 self-reported confidence (assumptions carry it; risks optionally). */
  confidence?: number;
  /** Explicit override when the user/consultant has already judged the type. */
  declaredType?: EpistemicType;
}

/**
 * Classify an item as a known-unknown (quantifiable risk) or an unknown-unknown
 * (deep uncertainty). Heuristic, transparent, overridable:
 *   - an explicit declaredType always wins,
 *   - deep-uncertainty language with NO evidence => unknown-unknown,
 *   - no evidence AND very low confidence (<=2) => unknown-unknown (you are guessing),
 *   - otherwise => known-unknown (a nameable event you can price).
 */
export function classifyEpistemicType(input: EpistemicClassificationInput): EpistemicType {
  if (input.declaredType) return input.declaredType;
  const hasEvidence = (input.evidence?.length || 0) > 0;
  if (!hasEvidence && textSignalsDeepUncertainty(input.text)) return 'unknown-unknown';
  if (!hasEvidence && typeof input.confidence === 'number' && input.confidence <= 2) {
    return 'unknown-unknown';
  }
  return 'known-unknown';
}

/** How each epistemic type should be handled — the consultant framing. */
export function epistemicGuidance(type: EpistemicType): Bilingual {
  return type === 'known-unknown'
    ? {
        pl: 'Ryzyko właściwe (known-unknown): nazwij zdarzenie, oszacuj prawdopodobieństwo × wpływ z bazy porównawczej i przypisz reakcję z triggerem.',
        en: 'A proper risk (known-unknown): name the event, estimate probability x impact from a base rate, and assign a response with a trigger.',
      }
    : {
        pl: 'Głęboka niepewność (unknown-unknown): NIE udawaj precyzyjnego prawdopodobieństwa — buduj odporność: opcjonalność, sygnały-do-obserwacji i scenariusz skrajny zamiast punktowej mitygacji.',
        en: 'Deep uncertainty (unknown-unknown): do NOT fake a precise probability — build robustness: optionality, signals-to-watch and a stress scenario instead of point mitigation.',
      };
}

// ---------------------------------------------------------------------------
// Invented-number guard + evidence discipline
// ---------------------------------------------------------------------------

/**
 * Terms in text that PROMISE a quantity ("50% chance", "€2M loss", "3x cost").
 * Mirrors Portfolio's QUANTIFIED_CLAIM: a number in the prose must be backed.
 */
const QUANTIFIED_CLAIM =
  /(\d[\d.,]*\s?%)|(\d[\d.,]*\s?(k|m|bn|mln|mld|tys|x|×)\b)|(\bpln\b|\beur\b|\busd\b|€|\$|zł)/i;

export function textMakesQuantifiedClaim(text: string): boolean {
  return QUANTIFIED_CLAIM.test(text);
}

export type RiskEvidenceIssueCode =
  | 'score-without-evidence'
  | 'invented-number'
  | 'false-precision-uncertainty'
  | 'missing-trigger-high-exposure'
  | 'no-validation-fragile-assumption';

export interface RiskEvidenceIssue {
  itemId: string;
  itemType: 'risk' | 'assumption';
  code: RiskEvidenceIssueCode;
  messageEn: string;
  messagePl: string;
}

export interface RiskEvidenceOptions {
  /**
   * Exposure (probability x impact, 1..25) at or above which a risk MUST carry
   * evidence — a serious number cannot rest on nothing. Default 8.
   */
  exposureEvidenceThreshold?: number;
}

const isAccepted = (item: { proposalStatus?: string }): boolean =>
  item.proposalStatus !== 'rejected' && item.proposalStatus !== 'rethinking';

const hasEvidence = (item: { evidence?: string[] }): boolean => (item.evidence?.length || 0) > 0;

/**
 * The invented-number guard for a single risk. Flags:
 *   - score-without-evidence: exposure at/above threshold, no evidence, and the
 *     text is not framed as an explicit assumption -> the P/I is asserted, not shown;
 *   - invented-number: the description quantifies (%, money, multiple) with no evidence;
 *   - false-precision-uncertainty: the item reads as deep uncertainty yet carries
 *     a confident, precise probability -> treating an unknown-unknown as a risk;
 *   - missing-trigger-high-exposure: a high-exposure risk with no early-warning trigger.
 */
export function validateRiskEvidence(
  risk: RiskItem,
  opts: RiskEvidenceOptions = {}
): RiskEvidenceIssue[] {
  const issues: RiskEvidenceIssue[] = [];
  const threshold = opts.exposureEvidenceThreshold ?? 8;
  const id = risk.id;
  const text = `${risk.title || ''} ${risk.description || ''}`.trim();
  const probability = risk.probability ?? 0;
  const impact = risk.impact ?? 0;
  const exposure = probability * impact;
  const backed = hasEvidence(risk);
  const framedAsAssumption =
    /(assum|hypoth|we believe|guess|założen|hipotez|zakładamy|przypuszcz|wierzymy)/i.test(text);

  if (exposure >= threshold && !backed && !framedAsAssumption) {
    issues.push({
      itemId: id,
      itemType: 'risk',
      code: 'score-without-evidence',
      messageEn: `Risk scored P${probability}×I${impact}=${exposure}/25 with no signal behind it — attach evidence or mark it an explicit assumption (no invented numbers).`,
      messagePl: `Ryzyko ocenione P${probability}×I${impact}=${exposure}/25 bez żadnego sygnału — podepnij dowód albo oznacz jako jawne założenie (zakaz zmyślonych liczb).`,
    });
  }

  if (textMakesQuantifiedClaim(text) && !backed) {
    issues.push({
      itemId: id,
      itemType: 'risk',
      code: 'invented-number',
      messageEn:
        'Description states a number (%, money, multiple) with no source — attach evidence or drop the figure.',
      messagePl:
        'Opis podaje liczbę (%, kwota, krotność), której nie kryje żadne źródło — podepnij dowód albo usuń liczbę.',
    });
  }

  const epistemic = classifyEpistemicType({
    text,
    evidence: risk.evidence,
    confidence: risk.confidence,
  });
  // A precise, confident probability on a deep-uncertainty item is false precision.
  if (epistemic === 'unknown-unknown' && probability >= 4) {
    issues.push({
      itemId: id,
      itemType: 'risk',
      code: 'false-precision-uncertainty',
      messageEn:
        'This reads as deep uncertainty yet carries a high, precise probability — do not price an unknown-unknown; handle it with robustness (scenario, optionality), not a point estimate.',
      messagePl:
        'To brzmi jak głęboka niepewność, a nosi wysokie, precyzyjne prawdopodobieństwo — nie wyceniaj nieznanego-nieznanego; potraktuj odpornością (scenariusz, opcjonalność), nie punktowym szacunkiem.',
    });
  }

  if (exposure >= 12 && !(risk.trigger && risk.trigger.trim())) {
    issues.push({
      itemId: id,
      itemType: 'risk',
      code: 'missing-trigger-high-exposure',
      messageEn:
        'High-exposure risk has no early-warning trigger — you will learn it materialized only after it hurts.',
      messagePl:
        'Ryzyko wysokiej ekspozycji nie ma triggera wczesnego ostrzegania — dowiecie się o nim dopiero, gdy zaboli.',
    });
  }

  return issues;
}

/** The same discipline for an assumption: a fragile belief must name a validation. */
export function validateAssumptionEvidence(assumption: RiskAssumption): RiskEvidenceIssue[] {
  const issues: RiskEvidenceIssue[] = [];
  const confidence = assumption.confidence ?? 3;
  const backed = hasEvidence(assumption);
  const hasValidation = !!(assumption.validationMethod && assumption.validationMethod.trim());

  // Low-confidence, unbacked assumption with no plan to test it: the plan rests
  // on a wish nobody has scheduled to check.
  if (confidence <= 2 && !backed && !hasValidation) {
    issues.push({
      itemId: assumption.id,
      itemType: 'assumption',
      code: 'no-validation-fragile-assumption',
      messageEn:
        'Fragile assumption (confidence <= 2) with no evidence and no validation method — schedule a cheap test before the plan leans on it.',
      messagePl:
        'Kruche założenie (pewność <= 2) bez dowodu i bez metody walidacji — zaplanuj tani test, zanim plan się na nim oprze.',
    });
  }

  return issues;
}

export interface RiskEvidenceReport {
  issues: RiskEvidenceIssue[];
  /** How many accepted risks carry an unbacked, at-or-above-threshold score. */
  unbackedScores: number;
  /** How many accepted risks are deep-uncertainty items forced onto a precise probability. */
  falsePrecision: number;
  /** Epistemic split across accepted risks. */
  knownUnknowns: number;
  unknownUnknowns: number;
  ok: boolean;
}

/**
 * Run the full evidence discipline over a session. Only accepted items are
 * assessed. Deterministic — feeds tests, the review-gap panel, and the AI prompt.
 */
export function assessRiskEvidence(
  data: RiskUncertaintyData,
  opts: RiskEvidenceOptions = {}
): RiskEvidenceReport {
  const risks = (data.risks || []).filter(isAccepted);
  const assumptions = (data.assumptions || []).filter(isAccepted);

  const issues: RiskEvidenceIssue[] = [
    ...risks.flatMap((r) => validateRiskEvidence(r, opts)),
    ...assumptions.flatMap(validateAssumptionEvidence),
  ];

  let knownUnknowns = 0;
  let unknownUnknowns = 0;
  risks.forEach((r) => {
    const t = classifyEpistemicType({
      text: `${r.title || ''} ${r.description || ''}`,
      evidence: r.evidence,
      confidence: r.confidence,
    });
    if (t === 'unknown-unknown') unknownUnknowns += 1;
    else knownUnknowns += 1;
  });

  const unbackedScores = issues.filter((i) => i.code === 'score-without-evidence').length;
  const falsePrecision = issues.filter((i) => i.code === 'false-precision-uncertainty').length;

  return {
    issues,
    unbackedScores,
    falsePrecision,
    knownUnknowns,
    unknownUnknowns,
    ok: issues.length === 0,
  };
}

/** Prompt block teaching the model the staircase + evidence discipline (PL/EN aware). */
export function buildRiskStaircasePromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `KAŻDA ocena ryzyka niesie trójstopniową drabinę wnioskowania — na żądanie musisz umieć ją odtworzyć:
- FAKT: obserwowalny sygnał (dane/wywiad/benchmark), że ryzyko jest realne.
- INTERPRETACJA: dlaczego ten sygnał uzasadnia AKURAT to prawdopodobieństwo × wpływ (baza porównawcza).
- IMPLIKACJA: jaka reakcja i po jakim triggerze.
DYSCYPLINA DOWODU (twarda):
- Zakaz zmyślonych liczb: prawdopodobieństwo/wpływ o wysokiej ekspozycji BEZ sygnału = błąd; podepnij dowód albo oznacz jako jawne założenie.
- Ryzyko vs niepewność: known-unknown (nazwane zdarzenie z bazą) → wyceniaj P×I; unknown-unknown (bezprecedensowe, nie do oszacowania) → NIE nadawaj precyzyjnego prawdopodobieństwa, buduj odporność (scenariusz, opcjonalność, sygnały-do-obserwacji).
- Precyzyjne prawdopodobieństwo na głębokiej niepewności to fałszywa precyzja = ta sama zmyślona liczba.`;
  }
  return `EVERY risk assessment carries a three-rung reasoning staircase — you must be able to reconstruct it on demand:
- FACT: the observable signal (data/interview/benchmark) that the risk is real.
- INTERPRETATION: why that signal justifies THIS probability x impact (the base rate).
- IMPLICATION: which response, on which trigger.
EVIDENCE DISCIPLINE (hard):
- No invented numbers: a high-exposure probability/impact with NO signal is an error; attach evidence or mark it an explicit assumption.
- Risk vs uncertainty: known-unknown (a nameable event with a base rate) -> price it P x I; unknown-unknown (unprecedented, unpriceable) -> do NOT assign a precise probability, build robustness (scenario, optionality, signals-to-watch).
- A precise probability on deep uncertainty is false precision = the same invented number.`;
}
