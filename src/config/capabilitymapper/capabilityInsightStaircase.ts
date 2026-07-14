/**
 * Capability Mapper — insight staircase + invented-number guard (OXFORD O3).
 *
 * Pattern mirror of src/config/portfolio/portfolioValueStaircase.ts. Where
 * Portfolio Priority scores VALUE and FEASIBILITY on a sourced ladder, Capability
 * Mapper scores each capability on TWO axes and demands both rest on a traceable
 * ladder instead of a gut number:
 *
 *   MATURITY   — current maturity level (1..5): process / people-skills /
 *                technology-data / track-record.
 *   IMPORTANCE — strategic weight: differentiation / customer-value /
 *                cost-to-replicate / strategic-fit.
 *
 * Two disciplines are enforced (the exact gap this tool exists to close):
 *   1. SOURCE ENFORCEMENT — every rung that drives a score must name where it
 *      came from (an audit id / a benchmark / an explicit assumption). A score
 *      with no source is downgraded to "declared, unconfirmed" — never invented.
 *   2. INVENTED-NUMBER GUARD — a quantified claim in free text ("cuts cost 30%",
 *      "top-decile") with no sourced rung behind it is flagged. "Ocena bez
 *      dowodu" must never silently become a number the rest of the tool trusts.
 */

export type CapabilityAxis = 'maturity' | 'importance';

/** The four levers behind a maturity score — each demands its own evidence. */
export type CapabilityMaturityLever =
  | 'process'
  | 'people-skills'
  | 'technology-data'
  | 'track-record';

/** The four levers behind an importance score. */
export type CapabilityImportanceLever =
  | 'differentiation'
  | 'customer-value'
  | 'cost-to-replicate'
  | 'strategic-fit';

export type CapabilityEvidenceStatus = 'confirmed' | 'declared' | 'missing';

/**
 * One rung of a score's ladder: a claimed driver, the number/level it implies,
 * and the source that backs it. `sourceRefs` empty => this rung is a declaration.
 */
export interface CapabilityScoreRung<Lever extends string = string> {
  lever: Lever;
  /** Human-readable claim, e.g. "delivery track record shows 4/5 on-time launches". */
  claim: string;
  /** Signal ids / audit ids / benchmark ids backing the claim. */
  sourceRefs: string[];
  /** Optional explicit assumption when there is no hard source (named, not hidden). */
  assumption?: string;
}

export interface CapabilityInsightStaircase {
  /** Rungs that build the maturity score (process / people / tech / track-record). */
  maturity: CapabilityScoreRung<CapabilityMaturityLever>[];
  /** Rungs that build the importance score (differentiation / value / cost / fit). */
  importance: CapabilityScoreRung<CapabilityImportanceLever>[];
}

export interface CapabilityStaircaseIssue {
  code:
    | 'missing-maturity-ladder'
    | 'missing-importance-ladder'
    | 'maturity-score-without-source'
    | 'importance-score-without-source'
    | 'invented-number';
  axis?: CapabilityAxis;
  messageEn: string;
  messagePl: string;
}

interface StaircaseValidationInput {
  capabilityId: string;
  name: string;
  description?: string;
  currentMaturity?: number;
  importanceScore?: number;
  staircase?: CapabilityInsightStaircase;
  /** 'declared' capabilities may legitimately have zero source refs. */
  evidenceStatus?: CapabilityEvidenceStatus;
}

/**
 * Terms in a description that PROMISE a number ("cuts cost 30%", "top decile",
 * "2x faster") but must be backed by a source. If the text quantifies but no rung
 * sources it, that is an invented number — the exact thing the guard forbids.
 */
const QUANTIFIED_CLAIM =
  /(\d[\d.,]*\s?%)|(\d[\d.,]*\s?(k|m|mln|tys|x|×)\b)|(\bpln\b|\beur\b|\busd\b|€|\$|zł)|(top[\s-]?decile|top[\s-]?quartile)/i;

export function textMakesQuantifiedClaim(text: string): boolean {
  return QUANTIFIED_CLAIM.test(text);
}

function rungHasSource(rung: CapabilityScoreRung): boolean {
  return (
    (Array.isArray(rung.sourceRefs) && rung.sourceRefs.length > 0) ||
    Boolean(rung.assumption && rung.assumption.trim().length > 0)
  );
}

/**
 * Validate one capability's maturity/importance ladder. Used by tests, by the
 * matrix engine's confidence read, and as an adversarial checklist fed back into
 * AI prompts (a score without a source never reaches the priority ranking as fact).
 *
 * Rules:
 * - a non-trivial maturity/importance score requires at least one rung on that axis,
 * - every rung must name a source OR an explicit assumption (source enforcement),
 * - a quantified claim in the description/name with no sourced rung = invented-number,
 *   UNLESS the capability is explicitly declared/unconfirmed.
 */
export function validateCapabilityStaircase(
  cap: StaircaseValidationInput
): CapabilityStaircaseIssue[] {
  const issues: CapabilityStaircaseIssue[] = [];
  const s = cap.staircase;
  const scored = (n?: number) => typeof n === 'number' && n > 0;

  if (scored(cap.currentMaturity) && (!s || s.maturity.length === 0)) {
    issues.push({
      code: 'missing-maturity-ladder',
      axis: 'maturity',
      messageEn:
        'Capability has a maturity score but no maturity ladder — which of process / people-skills / technology-data / track-record drives it, and from what source?',
      messagePl:
        'Zdolność ma ocenę dojrzałości, ale nie ma drabiny dojrzałości — który z czynników (proces / ludzie-kompetencje / technologia-dane / historia realizacji) ją napędza i z jakiego źródła?',
    });
  }
  if (scored(cap.importanceScore) && (!s || s.importance.length === 0)) {
    issues.push({
      code: 'missing-importance-ladder',
      axis: 'importance',
      messageEn:
        'Capability has an importance score but no importance ladder — differentiation / customer-value / cost-to-replicate / strategic-fit must justify it.',
      messagePl:
        'Zdolność ma ocenę znaczenia, ale nie ma drabiny znaczenia — różnicowanie / wartość dla klienta / koszt odtworzenia / dopasowanie strategiczne muszą ją uzasadniać.',
    });
  }

  const isDeclared = cap.evidenceStatus === 'declared';
  if (s && s.maturity.length > 0 && !isDeclared && !s.maturity.some(rungHasSource)) {
    issues.push({
      code: 'maturity-score-without-source',
      axis: 'maturity',
      messageEn:
        'Maturity score rests on no source — name an audit, a delivery track record, a benchmark, or mark the rung as an explicit assumption.',
      messagePl:
        'Ocena dojrzałości nie ma źródła — wskaż audyt, historię realizacji, benchmark albo oznacz szczebel jako jawne założenie.',
    });
  }
  if (s && s.importance.length > 0 && !isDeclared && !s.importance.some(rungHasSource)) {
    issues.push({
      code: 'importance-score-without-source',
      axis: 'importance',
      messageEn:
        'Importance score rests on no source — name a competitive fact, a customer signal, or an explicit assumption.',
      messagePl:
        'Ocena znaczenia nie ma źródła — wskaż fakt konkurencyjny, sygnał od klienta albo jawne założenie.',
    });
  }

  // Invented-number guard: a quantified promise in the text with no sourced rung.
  const haystack = `${cap.name} ${cap.description || ''}`;
  if (textMakesQuantifiedClaim(haystack)) {
    const anySourced = [...(s?.maturity || []), ...(s?.importance || [])].some(
      (r) => Array.isArray(r.sourceRefs) && r.sourceRefs.length > 0
    );
    if (!anySourced && !isDeclared) {
      issues.push({
        code: 'invented-number',
        messageEn:
          'Description/name states a number with no source behind any rung — attach evidence or drop the figure (no invented numbers).',
        messagePl:
          'Opis/nazwa podaje liczbę, której nie kryje żadne źródło na szczeblach — podepnij dowód albo usuń liczbę (zakaz zmyślania).',
      });
    }
  }

  return issues;
}

/** Batch guard over a whole capability set — the O3 acceptance gate. */
export function guardCapabilitySet(caps: StaircaseValidationInput[]): {
  ok: boolean;
  perCapability: { capabilityId: string; name: string; issues: CapabilityStaircaseIssue[] }[];
} {
  const perCapability = caps.map((cap) => ({
    capabilityId: cap.capabilityId,
    name: cap.name,
    issues: validateCapabilityStaircase(cap),
  }));
  return { ok: perCapability.every((c) => c.issues.length === 0), perCapability };
}

/** Prompt block teaching the model the staircase + source contract (PL/EN aware). */
export function buildCapabilityStaircasePromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `KAŻDA zdolność niesie DWIE drabiny ocen:
- "staircase.maturity": szczeble po jednym z czynników "process|people-skills|technology-data|track-record" — każdy ze "sourceRefs" (id audytu/benchmarku) LUB jawnym "assumption". Zakaz liczb bez źródła.
- "staircase.importance": szczeble po "differentiation|customer-value|cost-to-replicate|strategic-fit" — tak samo źródłowane.
- Jeśli nic nie potwierdza zdolności: evidenceStatus="declared" i puste sourceRefs — jawnie „deklaracja, niepotwierdzone", nigdy zmyślona liczba.
- Każda liczba w opisie (%, x-krotność, kwota) musi mieć źródłowany szczebel — inaczej to invented-number.`;
  }
  return `EVERY capability carries TWO score ladders:
- "staircase.maturity": rungs by lever "process|people-skills|technology-data|track-record" — each with "sourceRefs" (audit/benchmark ids) OR an explicit "assumption". No numbers without a source.
- "staircase.importance": rungs by lever "differentiation|customer-value|cost-to-replicate|strategic-fit" — sourced the same way.
- If nothing backs the capability: evidenceStatus="declared" and empty sourceRefs — explicitly "declared, unconfirmed", never an invented number.
- Any number in the description (%, multiplier, amount) must have a sourced rung behind it — otherwise it is an invented-number.`;
}
