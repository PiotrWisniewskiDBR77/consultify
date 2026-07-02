/**
 * Portfolio Priority — value & feasibility staircase (OXFORD O3, tool #5).
 *
 * Pattern mirror of src/config/swot/swotInsightStaircase.ts. Where SWOT enforces
 * fact -> interpretation -> implication per item, Portfolio Priority scores each
 * element (initiative / project / product) on TWO axes and demands that BOTH
 * scores rest on a traceable ladder instead of a gut number:
 *
 *   VALUE       — business impact: revenue / cost / risk / strategic fit.
 *   FEASIBILITY — ability to deliver: effort / cost-to-build / capabilities /
 *                 dependencies on other elements.
 *
 * Two disciplines are enforced here (the audit gaps this tool exists to close):
 *   1. SOURCE ENFORCEMENT — every number that drives a score must name where it
 *      came from (a signal id / a benchmark / an explicit assumption). A score
 *      with no source is downgraded to "declared, unconfirmed" — never invented.
 *   2. DEPENDENCY HONESTY — feasibility that ignores prerequisites is fiction.
 *      An element that depends on another element must say so, so the sequencing
 *      engine can order A before B (CONCLUSION_LAYER W2: sequence, not wishlist).
 */

export type PortfolioAxis = 'value' | 'feasibility';

/** The four levers behind a value score — each demands its own evidence. */
export type PortfolioValueLever = 'revenue' | 'cost' | 'risk' | 'strategic';

/** The four levers behind a feasibility score. */
export type PortfolioFeasibilityLever =
  | 'effort'
  | 'cost-to-build'
  | 'capabilities'
  | 'dependencies';

export type PortfolioEvidenceStatus = 'confirmed' | 'declared' | 'missing';

/**
 * One rung of a score's ladder: a claimed driver, the number it implies, and the
 * source that backs it. `sourceRefs` empty => this rung is a declaration.
 */
export interface PortfolioScoreRung<Lever extends string = string> {
  lever: Lever;
  /** Human-readable claim, e.g. "opens a €1.2M ARR segment". */
  claim: string;
  /** Signal ids / benchmark ids / assumption keys backing the claim. */
  sourceRefs: string[];
  /** Optional explicit assumption when there is no hard source (named, not hidden). */
  assumption?: string;
}

export interface PortfolioValueStaircase {
  /** Rungs that build the value score (revenue / cost / risk / strategic). */
  value: PortfolioScoreRung<PortfolioValueLever>[];
  /** Rungs that build the feasibility score (effort / cost / capabilities / deps). */
  feasibility: PortfolioScoreRung<PortfolioFeasibilityLever>[];
}

/**
 * A declared dependency of one element on another element in the SAME portfolio.
 * Feeds the sequencing engine: `dependsOnElementId` must be delivered first.
 */
export interface PortfolioDependency {
  dependsOnElementId: string;
  /** Why — what does the prerequisite unlock? */
  reason: string;
  /** Hard = blocks entirely; soft = raises cost/risk but not a blocker. */
  kind: 'hard' | 'soft';
}

export interface PortfolioStaircaseIssue {
  code:
    | 'missing-value-ladder'
    | 'missing-feasibility-ladder'
    | 'value-score-without-source'
    | 'feasibility-score-without-source'
    | 'invented-number'
    | 'dependency-not-declared'
    | 'dangling-dependency';
  axis?: PortfolioAxis;
  messageEn: string;
  messagePl: string;
}

interface StaircaseValidationInput {
  elementId: string;
  title: string;
  description?: string;
  valueScore?: number;
  feasibilityScore?: number;
  staircase?: PortfolioValueStaircase;
  dependencies?: PortfolioDependency[];
  /** 'declared' elements may legitimately have zero source refs. */
  evidenceStatus?: PortfolioEvidenceStatus;
  /** Element ids that exist in the portfolio (for dangling-dependency check). */
  knownElementIds?: Set<string>;
}

/**
 * Terms in a description that PROMISE a number ("save 30%", "double throughput")
 * but must be backed by a source. If the text quantifies but no rung sources it,
 * that is an invented number — the exact thing this tool forbids.
 */
const QUANTIFIED_CLAIM =
  /(\d[\d.,]*\s?%)|(\d[\d.,]*\s?(k|m|mln|tys|x|×)\b)|(\bpln\b|\beur\b|\busd\b|€|\$|zł)/i;

export function textMakesQuantifiedClaim(text: string): boolean {
  return QUANTIFIED_CLAIM.test(text);
}

function rungHasSource(rung: PortfolioScoreRung): boolean {
  return (
    (Array.isArray(rung.sourceRefs) && rung.sourceRefs.length > 0) ||
    Boolean(rung.assumption && rung.assumption.trim().length > 0)
  );
}

/**
 * Validate one element's value/feasibility ladder. Used by tests, by the review-gap
 * computation, and as an adversarial checklist fed back into AI prompts.
 *
 * Rules:
 * - a non-trivial value/feasibility score requires at least one rung on that axis,
 * - every rung must name a source OR an explicit assumption (source enforcement),
 * - a quantified claim in the description with no sourced rung = invented-number,
 * - a description implying a prerequisite with no declared dependency = flagged,
 * - a declared dependency pointing at a non-existent element = dangling.
 */
export function validatePortfolioStaircase(
  el: StaircaseValidationInput
): PortfolioStaircaseIssue[] {
  const issues: PortfolioStaircaseIssue[] = [];
  const s = el.staircase;
  const scored = (n?: number) => typeof n === 'number' && n > 0;

  if (scored(el.valueScore) && (!s || s.value.length === 0)) {
    issues.push({
      code: 'missing-value-ladder',
      axis: 'value',
      messageEn:
        'Element has a value score but no value ladder — which of revenue / cost / risk / strategic fit drives it, and from what source?',
      messagePl:
        'Element ma ocenę wartości, ale nie ma drabiny wartości — który z czynników (przychód / koszt / ryzyko / strategiczność) ją napędza i z jakiego źródła?',
    });
  }
  if (scored(el.feasibilityScore) && (!s || s.feasibility.length === 0)) {
    issues.push({
      code: 'missing-feasibility-ladder',
      axis: 'feasibility',
      messageEn:
        'Element has a feasibility score but no feasibility ladder — effort / cost / capabilities / dependencies must justify it.',
      messagePl:
        'Element ma ocenę wykonalności, ale nie ma drabiny wykonalności — nakład / koszt / zdolności / zależności muszą ją uzasadniać.',
    });
  }

  // Source enforcement per axis: at least one rung must carry a source/assumption
  // (unless the whole element is explicitly declared/unconfirmed).
  const isDeclared = el.evidenceStatus === 'declared';
  if (s && s.value.length > 0 && !isDeclared && !s.value.some(rungHasSource)) {
    issues.push({
      code: 'value-score-without-source',
      axis: 'value',
      messageEn:
        'Value score rests on no source — name a signal, a benchmark, or mark the rung as an explicit assumption.',
      messagePl:
        'Ocena wartości nie ma źródła — wskaż sygnał, benchmark albo oznacz szczebel jako jawne założenie.',
    });
  }
  if (s && s.feasibility.length > 0 && !isDeclared && !s.feasibility.some(rungHasSource)) {
    issues.push({
      code: 'feasibility-score-without-source',
      axis: 'feasibility',
      messageEn:
        'Feasibility score rests on no source — name a capacity fact, a past-delivery benchmark, or an explicit assumption.',
      messagePl:
        'Ocena wykonalności nie ma źródła — wskaż fakt o zasobach, benchmark z realizacji albo jawne założenie.',
    });
  }

  // Invented-number guard: a quantified promise in the text with no sourced rung.
  const haystack = `${el.title} ${el.description || ''}`;
  if (textMakesQuantifiedClaim(haystack)) {
    const anySourced = [...(s?.value || []), ...(s?.feasibility || [])].some(
      (r) => Array.isArray(r.sourceRefs) && r.sourceRefs.length > 0
    );
    if (!anySourced && !isDeclared) {
      issues.push({
        code: 'invented-number',
        messageEn:
          'Description states a number with no source behind any rung — attach evidence or drop the figure (no invented numbers).',
        messagePl:
          'Opis podaje liczbę, której nie kryje żadne źródło na szczeblach — podepnij dowód albo usuń liczbę (zakaz zmyślania).',
      });
    }
  }

  // Dependency honesty.
  const deps = el.dependencies || [];
  if (el.knownElementIds) {
    deps.forEach((d) => {
      if (!el.knownElementIds!.has(d.dependsOnElementId)) {
        issues.push({
          code: 'dangling-dependency',
          messageEn: `Element depends on "${d.dependsOnElementId}", which is not in this portfolio.`,
          messagePl: `Element zależy od „${d.dependsOnElementId}", którego nie ma w tym portfelu.`,
        });
      }
    });
  }
  if (mentionsPrerequisite(haystack) && deps.length === 0) {
    issues.push({
      code: 'dependency-not-declared',
      messageEn:
        'Description implies a prerequisite ("after", "once ... is done", "requires") but declares no dependency — sequencing cannot order it.',
      messagePl:
        'Opis sugeruje warunek wstępny („po", „gdy ... gotowe", „wymaga"), lecz nie deklaruje zależności — silnik sekwencji nie ułoży kolejności.',
    });
  }

  return issues;
}

const PREREQ_HINT =
  /\b(after|once|requires|depends on|prerequisite|blocked by)\b|\b(po |wymaga|zależy od|warunkiem|dopiero gdy|najpierw)\b/i;

export function mentionsPrerequisite(text: string): boolean {
  return PREREQ_HINT.test(text);
}

/** Prompt block teaching the model the staircase + source contract (PL/EN aware). */
export function buildPortfolioStaircasePromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `KAŻDY element portfela (inicjatywa / projekt / produkt) niesie DWIE drabiny ocen:
- "staircase.value": szczeble po jednym z czynników "revenue|cost|risk|strategic" — każdy ze "sourceRefs" (id sygnału/benchmarku) LUB jawnym "assumption". Zakaz liczb bez źródła.
- "staircase.feasibility": szczeble po "effort|cost-to-build|capabilities|dependencies" — tak samo źródłowane; wykonalność MUSI uwzględniać zależności od innych elementów.
- Jeśli elementu nic nie potwierdza: evidenceStatus="declared" i puste sourceRefs — jawnie „deklaracja, niepotwierdzone", nigdy zmyślona liczba.
- "dependencies": [{"dependsOnElementId":"...","reason":"co odblokowuje","kind":"hard|soft"}] — element zależny MUSI to zadeklarować, by dało się ułożyć kolejność (A przed B).`;
  }
  return `EVERY portfolio element (initiative / project / product) carries TWO score ladders:
- "staircase.value": rungs by lever "revenue|cost|risk|strategic" — each with "sourceRefs" (signal/benchmark ids) OR an explicit "assumption". No numbers without a source.
- "staircase.feasibility": rungs by lever "effort|cost-to-build|capabilities|dependencies" — sourced the same way; feasibility MUST account for dependencies on other elements.
- If nothing backs the element: evidenceStatus="declared" and empty sourceRefs — explicitly "declared, unconfirmed", never an invented number.
- "dependencies": [{"dependsOnElementId":"...","reason":"what it unlocks","kind":"hard|soft"}] — a dependent element MUST declare it so sequencing can order A before B.`;
}
