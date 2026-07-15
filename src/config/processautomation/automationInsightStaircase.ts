/**
 * Process Automation — insight staircase + structural gap detection (OXFORD O3).
 *
 * Pattern mirror of src/config/smedplanner/smedInsightStaircase.ts and
 * src/config/rpascanner/rpaInsightStaircase.ts, retargeted from SMED/RPA to
 * Process Automation candidates and the session's baseline facts. Closes the
 * same audit gap: a session can score phases and sequence moves without ever
 * being forced to justify WHY a candidate belongs on the list, or WHY the Lean
 * order (map -> standardize -> automate -> sustain) is being respected. This
 * module enforces three disciplines:
 *
 *   1. K1->K2->K3 STAIRCASE per candidate — fact (what was observed) ->
 *      interpretation (what it means for THIS process) -> implication (what
 *      follows for the move sequence).
 *   2. INVENTED-NUMBER GUARD — a candidate claim that quantifies (hours, %,
 *      minutes) with no evidence and no declared status is flagged.
 *   3. STRUCTURAL GAP DETECTION — session-level facts the phase-score engine
 *      cannot see on its own: automate-phase candidates while standardize was
 *      skipped entirely, candidates proposed on top of an unquantified
 *      baseline, and an error-rate target with no baseline to measure it against.
 */

import type { AutomationBaselineInput, AutomationCandidate, AutomationSession } from './automationEngine';

// ---------------------------------------------------------------------------
// K1 -> K2 -> K3 staircase per candidate
// ---------------------------------------------------------------------------

export interface AutomationInsightStaircase {
  /** K1 — the observable fact, with references into session evidence. */
  fact: string;
  factRefs: string[];
  /** K2 — what the fact means FOR THIS PROCESS (not a generic automation truth). */
  interpretation: string;
  /** K3 seed — what follows for the move sequence. */
  implication: string;
}

export interface AutomationStaircaseIssue {
  code:
    | 'missing-fact'
    | 'missing-interpretation'
    | 'missing-implication'
    | 'missing-fact-refs'
    | 'interpretation-is-restatement'
    | 'invented-number';
  itemId?: string;
  messageEn: string;
  messagePl: string;
}

interface CandidateStaircaseInput {
  id?: string;
  title?: string;
  description?: string;
  minutesSaved?: number;
  evidence?: unknown[];
  staircase?: AutomationInsightStaircase;
  evidenceStatus?: 'confirmed' | 'declared' | 'missing';
}

/** Validates the fact->interpretation->implication structure of one candidate. */
export function validateAutomationInsightStaircase(
  item: CandidateStaircaseInput
): AutomationStaircaseIssue[] {
  const issues: AutomationStaircaseIssue[] = [];
  const s = item.staircase;

  if (!s || !s.fact?.trim()) {
    issues.push({
      code: 'missing-fact',
      itemId: item.id,
      messageEn: 'Candidate has no underlying fact (K1) — what was observed about this process?',
      messagePl: 'Kandydat nie ma faktu bazowego (K1) — co zaobserwowano w tym procesie?',
    });
  }
  if (!s || !s.interpretation?.trim()) {
    issues.push({
      code: 'missing-interpretation',
      itemId: item.id,
      messageEn: 'Candidate has no interpretation (K2) — what does the fact mean for THIS process?',
      messagePl: 'Kandydat nie ma interpretacji (K2) — co ten fakt znaczy dla TEGO procesu?',
    });
  }
  if (!s || !s.implication?.trim()) {
    issues.push({
      code: 'missing-implication',
      itemId: item.id,
      messageEn: 'Candidate has no implication (K3 seed) — what follows for the move sequence?',
      messagePl: 'Kandydat nie ma implikacji (zalążek K3) — co z tego wynika dla sekwencji ruchów?',
    });
  }
  if (s && s.fact?.trim() && (!s.factRefs || s.factRefs.length === 0)) {
    if (item.evidenceStatus === 'confirmed') {
      issues.push({
        code: 'missing-fact-refs',
        itemId: item.id,
        messageEn: 'Candidate is marked confirmed but references no session evidence.',
        messagePl: 'Kandydat oznaczony jako potwierdzony, ale nie wskazuje dowodu z sesji.',
      });
    }
  }
  if (s && s.fact?.trim() && s.interpretation?.trim()) {
    const fact = s.fact.trim().toLowerCase();
    const interp = s.interpretation.trim().toLowerCase();
    if (fact === interp || (interp.length > 20 && fact.includes(interp))) {
      issues.push({
        code: 'interpretation-is-restatement',
        itemId: item.id,
        messageEn: 'Interpretation restates the fact instead of explaining what it means for this process.',
        messagePl: 'Interpretacja powtarza fakt zamiast wyjaśnić, co znaczy dla tego procesu.',
      });
    }
  }

  issues.push(...validateInventedNumberGuard(item));

  return issues;
}

// ---------------------------------------------------------------------------
// Invented-number guard
// ---------------------------------------------------------------------------

const QUANTIFIED_CLAIM = /(\d[\d.,]*\s?%)|(\d[\d.,]*\s?(min|h|godz|x|×)\b)/i;

export function textMakesQuantifiedClaim(text: string): boolean {
  return QUANTIFIED_CLAIM.test(text);
}

function validateInventedNumberGuard(item: CandidateStaircaseInput): AutomationStaircaseIssue[] {
  const haystack = `${item.title || ''} ${item.description || ''} ${
    item.minutesSaved !== undefined ? `${item.minutesSaved} min` : ''
  }`;
  if (!textMakesQuantifiedClaim(haystack)) return [];

  const isDeclared = item.evidenceStatus === 'declared';
  const hasEvidence = (item.evidence?.length || 0) > 0;
  if (hasEvidence || isDeclared) return [];

  return [
    {
      code: 'invented-number',
      itemId: item.id,
      messageEn:
        'Candidate states a number with no evidence behind it — attach a source (log, measurement) or mark it "declared, unconfirmed" (no invented hours or error rates).',
      messagePl:
        'Kandydat podaje liczbę, której nie kryje żaden dowód — podepnij źródło (log, pomiar) albo oznacz jako „deklaracja, niepotwierdzone" (zakaz zmyślania godzin lub wskaźników błędu).',
    },
  ];
}

// ---------------------------------------------------------------------------
// Structural gap detection (session-level facts the phase-score engine cannot see)
// ---------------------------------------------------------------------------

export interface AutomationGap {
  code: 'automate-before-standardize' | 'unquantified-baseline-with-candidates' | 'error-target-without-baseline';
  candidateId?: string;
  messageEn: string;
  messagePl: string;
}

const num = (v: number | null | undefined): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

/**
 * Detects three structural gaps a phase-score ranking alone would miss:
 *
 *   - automate-before-standardize: 'automate' candidates exist while zero
 *     'standardize' candidates have been logged — skipping the Lean order
 *     entirely rather than just deferring it.
 *   - unquantified-baseline-with-candidates: candidates exist but the
 *     quantitative baseline (volume/cycle time) is empty — proposing
 *     automation with no counted hours behind it.
 *   - error-target-without-baseline: an error-rate target is stated with no
 *     baseline error rate to measure the improvement against.
 */
export function detectAutomationGaps(session: AutomationSession): AutomationGap[] {
  const gaps: AutomationGap[] = [];
  const candidates: AutomationCandidate[] = session.candidates || [];
  const baseline: AutomationBaselineInput = session.baseline || {};

  const automateCandidates = candidates.filter((c) => c.phase === 'automate');
  const standardizeCandidates = candidates.filter((c) => c.phase === 'standardize');
  if (automateCandidates.length > 0 && standardizeCandidates.length === 0) {
    gaps.push({
      code: 'automate-before-standardize',
      messageEn: `${automateCandidates.length} 'automate' candidate(s) exist but zero 'standardize' candidates have been logged — the Lean order (map -> standardize -> automate) is being skipped, not just deferred.`,
      messagePl: `Istnieje ${automateCandidates.length} kandydat(ów) „automate", ale nie zalogowano żadnego kandydata „standardize" — porządek Lean (mapuj -> standaryzuj -> automatyzuj) jest pomijany, nie tylko odłożony.`,
    });
  }

  const volumePerWeek = num(baseline.volumePerWeek) ?? 0;
  const baselineMinutesPerCycle = num(baseline.baselineMinutesPerCycle) ?? 0;
  if (candidates.length > 0 && (volumePerWeek <= 0 || baselineMinutesPerCycle <= 0)) {
    gaps.push({
      code: 'unquantified-baseline-with-candidates',
      messageEn:
        'Automation candidates exist but the quantitative baseline (volume/week, minutes/cycle) is empty — the payback is being proposed with no counted hours behind it.',
      messagePl:
        'Istnieją kandydaci do automatyzacji, ale ilościowa baza (wolumen/tydzień, minuty/cykl) jest pusta — zwrot jest proponowany bez policzonych godzin za sobą.',
    });
  }

  const errorTarget = num(baseline.errorRateTargetPct) ?? 0;
  const errorBaseline = num(baseline.errorRateBaselinePct) ?? 0;
  if (errorTarget > 0 && errorBaseline <= 0) {
    gaps.push({
      code: 'error-target-without-baseline',
      messageEn: `An error-rate target (${errorTarget}%) is stated but there is no baseline error rate to measure the improvement against.`,
      messagePl: `Podano cel wskaźnika błędu (${errorTarget}%), ale brak bazowego wskaźnika błędu, względem którego mierzyć poprawę.`,
    });
  }

  return gaps;
}

/** Prompt block teaching the model the staircase + invented-number-guard + gap contract (PL/EN aware). */
export function buildAutomationStaircasePromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `KAŻDY kandydat automatyzacji niesie drabinę wniosku (insight staircase):
- "staircase.fact" (K1): obserwowalny fakt Z SESJI, nigdy wymyślony; "factRefs" wskazują dowód.
- "staircase.interpretation" (K2): co ten fakt znaczy dla TEGO procesu (nie ogólna prawda o automatyzacji).
- "staircase.implication" (K3-zalążek): co z tego wynika dla sekwencji ruchów.
ZAKAZ ZMYŚLONYCH LICZB: jeśli opis podaje liczbę (godziny, minuty, %), musi mieć dowód w "evidence" LUB być jawnie oznaczony jako "declared" (deklaracja, niepotwierdzone) — nigdy liczba bez źródła.
STRUKTURALNE LUKI do zgłoszenia, jeśli wykryte: (1) kandydaci fazy „automate" bez żadnego kandydata „standardize" (pominięty porządek Lean, nie tylko odłożony); (2) kandydaci proponowani na niepoliczonej bazie ilościowej; (3) cel wskaźnika błędu bez bazowego wskaźnika do porównania.`;
  }
  return `EVERY automation candidate carries an insight staircase:
- "staircase.fact" (K1): an observable fact FROM THE SESSION, never invented; "factRefs" point at evidence.
- "staircase.interpretation" (K2): what the fact means for THIS process (not a generic automation truth).
- "staircase.implication" (K3 seed): what follows for the move sequence.
NO INVENTED NUMBERS: if the description states a number (hours, minutes, %), it must have "evidence" OR be explicitly marked "declared" (declared, unconfirmed) — never a number with no source.
STRUCTURAL GAPS to surface if detected: (1) 'automate'-phase candidates with zero 'standardize' candidates (the Lean order skipped, not just deferred); (2) candidates proposed on an unquantified baseline; (3) an error-rate target with no baseline to compare against.`;
}
