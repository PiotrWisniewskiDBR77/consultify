/**
 * SMED Planner — insight staircase + structural gap detection (OXFORD O3).
 *
 * Pattern mirror of src/config/ambitiondecomposer/ambitionInsightStaircase.ts +
 * ambitionTreeEngine.ts, retargeted from ambition themes to SMED improvement
 * items and the changeover session's structural facts. Closes the same audit
 * gap: a session can score phases and sequence moves without ever being forced
 * to justify WHY an improvement belongs on the list, or WHY the Shingo order
 * is being respected. This module enforces three disciplines:
 *
 *   1. K1->K2->K3 STAIRCASE per improvement — fact (what was observed) ->
 *      interpretation (what it means for THIS changeover) -> implication
 *      (what follows for the move sequence).
 *   2. INVENTED-NUMBER GUARD — an improvement/step claim that quantifies
 *      (minutes, %, x) with no evidence and no declared status is flagged.
 *   3. STRUCTURAL GAP DETECTION — session-level facts the scoring engine
 *      cannot see on its own: steps targeted for action while still unmeasured,
 *      standardize proposed before any confirmed gain, and a convertible
 *      opportunity identified but never logged as an improvement.
 */

import type { ChangeoverStep, ImprovementItem, SmedSession } from './changeoverEngine';

// ---------------------------------------------------------------------------
// K1 -> K2 -> K3 staircase per improvement
// ---------------------------------------------------------------------------

export interface SmedInsightStaircase {
  /** K1 — the observable fact, with references into session evidence. */
  fact: string;
  /** Evidence ids / fact keys backing the fact. Empty = declared, unconfirmed. */
  factRefs: string[];
  /** K2 — what the fact means FOR THIS CHANGEOVER (not a generic truth). */
  interpretation: string;
  /** K3 seed — what follows for the move sequence. */
  implication: string;
}

export interface SmedStaircaseIssue {
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

interface ImprovementStaircaseInput {
  id?: string;
  title?: string;
  description?: string;
  durationMinutes?: number;
  evidence?: unknown[];
  staircase?: SmedInsightStaircase;
  evidenceStatus?: 'confirmed' | 'declared' | 'missing';
}

/** Validates the fact->interpretation->implication structure of one improvement. */
export function validateSmedInsightStaircase(
  item: ImprovementStaircaseInput
): SmedStaircaseIssue[] {
  const issues: SmedStaircaseIssue[] = [];
  const s = item.staircase;

  if (!s || !s.fact?.trim()) {
    issues.push({
      code: 'missing-fact',
      itemId: item.id,
      messageEn: 'Improvement has no underlying fact (K1) — what was observed in the changeover?',
      messagePl: 'Usprawnienie nie ma faktu bazowego (K1) — co zaobserwowano w przezbrojeniu?',
    });
  }
  if (!s || !s.interpretation?.trim()) {
    issues.push({
      code: 'missing-interpretation',
      itemId: item.id,
      messageEn:
        'Improvement has no interpretation (K2) — what does the fact mean for THIS changeover?',
      messagePl:
        'Usprawnienie nie ma interpretacji (K2) — co ten fakt znaczy dla TEGO przezbrojenia?',
    });
  }
  if (!s || !s.implication?.trim()) {
    issues.push({
      code: 'missing-implication',
      itemId: item.id,
      messageEn: 'Improvement has no implication (K3 seed) — what follows for the move sequence?',
      messagePl:
        'Usprawnienie nie ma implikacji (zalążek K3) — co z tego wynika dla sekwencji ruchów?',
    });
  }
  if (s && s.fact?.trim() && (!s.factRefs || s.factRefs.length === 0)) {
    if (item.evidenceStatus === 'confirmed') {
      issues.push({
        code: 'missing-fact-refs',
        itemId: item.id,
        messageEn: 'Improvement is marked confirmed but references no session evidence.',
        messagePl: 'Usprawnienie oznaczone jako potwierdzone, ale nie wskazuje dowodu z sesji.',
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
        messageEn:
          'Interpretation restates the fact instead of explaining what it means for this changeover.',
        messagePl:
          'Interpretacja powtarza fakt zamiast wyjaśnić, co znaczy dla tego przezbrojenia.',
      });
    }
  }

  issues.push(...validateInventedNumberGuard(item));

  return issues;
}

// ---------------------------------------------------------------------------
// Invented-number guard
// ---------------------------------------------------------------------------

const QUANTIFIED_CLAIM = /(\d[\d.,]*\s?%)|(\d[\d.,]*\s?(min|godz|h|x|×)\b)/i;

export function textMakesQuantifiedClaim(text: string): boolean {
  return QUANTIFIED_CLAIM.test(text);
}

function validateInventedNumberGuard(item: ImprovementStaircaseInput): SmedStaircaseIssue[] {
  const haystack = `${item.title || ''} ${item.description || ''} ${
    item.durationMinutes !== undefined ? `${item.durationMinutes} min` : ''
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
        'Improvement states a number with no evidence behind it — attach a source (measurement, pilot) or mark it "declared, unconfirmed" (no invented minutes).',
      messagePl:
        'Usprawnienie podaje liczbę, której nie kryje żaden dowód — podepnij źródło (pomiar, pilotaż) albo oznacz jako „deklaracja, niepotwierdzone" (zakaz zmyślania minut).',
    },
  ];
}

// ---------------------------------------------------------------------------
// Structural gap detection (session-level facts the scoring engine cannot see)
// ---------------------------------------------------------------------------

export interface SmedGap {
  code: 'unmeasured-target-step' | 'standardize-before-gain' | 'convert-identified-not-logged';
  stepId?: string;
  messageEn: string;
  messagePl: string;
}

/**
 * Detects three structural gaps a phase-score ranking alone would miss:
 *
 *   - unmeasured-target-step: a step marked convertible/shortenable (i.e. in
 *     scope for action) whose duration is not measured — acting on a guess.
 *   - standardize-before-gain: a standardize-phase improvement exists while the
 *     convert/streamline phases that would produce the gain have zero
 *     improvements logged — locking a standard before the gain exists.
 *   - convert-identified-not-logged: steps are classified convertible (the
 *     opportunity was identified) but no improvement of phase 'convert' has
 *     been logged — an identified opportunity abandoned mid-session.
 */
export function detectSmedGaps(session: SmedSession): SmedGap[] {
  const gaps: SmedGap[] = [];
  const steps: ChangeoverStep[] = session.steps || [];
  const improvements: ImprovementItem[] = session.improvements || [];

  steps
    .filter(
      (s) =>
        s.kind === 'internal' && (s.potential === 'convertible' || s.potential === 'shortenable')
    )
    .filter((s) => !s.measured)
    .forEach((s) => {
      gaps.push({
        code: 'unmeasured-target-step',
        stepId: s.id,
        messageEn: `Step "${s.id}" is targeted for ${s.potential} action but its duration is unmeasured — the phase score for this step is a guess, not a fact.`,
        messagePl: `Czynność „${s.id}" jest celem działania (${s.potential}), ale jej czas nie jest zmierzony — wynik fazy dla tej czynności jest zgadywaniem, nie faktem.`,
      });
    });

  const hasImprovementsInPhase = (phase: 'convert' | 'streamline') =>
    improvements.some((i) => i.phase === phase);
  const hasStandardizeImprovement = improvements.some((i) => i.phase === 'standardize');
  if (
    hasStandardizeImprovement &&
    !hasImprovementsInPhase('convert') &&
    !hasImprovementsInPhase('streamline')
  ) {
    gaps.push({
      code: 'standardize-before-gain',
      messageEn:
        'A standardize-phase improvement exists but no convert/streamline improvement has been logged yet — standardizing now would lock in the current method before any gain is confirmed.',
      messagePl:
        'Istnieje usprawnienie fazy standaryzacji, ale nie zalogowano żadnego usprawnienia fazy konwersji/skracania — standaryzacja teraz utrwaliłaby obecną metodę, zanim powstanie potwierdzony zysk.',
    });
  }

  const convertibleSteps = steps.filter(
    (s) => s.kind === 'internal' && s.potential === 'convertible'
  );
  if (convertibleSteps.length > 0 && !hasImprovementsInPhase('convert')) {
    gaps.push({
      code: 'convert-identified-not-logged',
      messageEn: `${convertibleSteps.length} step(s) are classified convertible (the opportunity was identified) but no 'convert' improvement has been logged — the opportunity is sitting unactioned.`,
      messagePl: `${convertibleSteps.length} czynność(-ci) jest sklasyfikowana jako konwertowalna (okazja zidentyfikowana), ale nie zalogowano żadnego usprawnienia „convert" — okazja stoi bez działania.`,
    });
  }

  return gaps;
}

/** Prompt block teaching the model the staircase + invented-number-guard + gap contract (PL/EN aware). */
export function buildSmedStaircasePromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `KAŻDE usprawnienie niesie drabinę wniosku (insight staircase):
- "staircase.fact" (K1): obserwowalny fakt Z SESJI, nigdy wymyślony; "factRefs" wskazują dowód.
- "staircase.interpretation" (K2): co ten fakt znaczy dla TEGO przezbrojenia (nie ogólna prawda o SMED).
- "staircase.implication" (K3-zalążek): co z tego wynika dla sekwencji ruchów.
ZAKAZ ZMYŚLONYCH LICZB: jeśli opis podaje liczbę (minuty, %, x), musi mieć dowód w "evidence" LUB być jawnie oznaczony jako "declared" (deklaracja, niepotwierdzone) — nigdy liczba bez źródła.
STRUKTURALNE LUKI do zgłoszenia, jeśli wykryte: (1) czynność celowana do działania, ale niezmierzona; (2) standaryzacja zaproponowana zanim istnieje potwierdzony zysk z konwersji/skracania; (3) czynność sklasyfikowana jako konwertowalna, ale bez zalogowanego usprawnienia „convert".`;
  }
  return `EVERY improvement carries an insight staircase:
- "staircase.fact" (K1): an observable fact FROM THE SESSION, never invented; "factRefs" point at evidence.
- "staircase.interpretation" (K2): what the fact means for THIS changeover (not a generic SMED truth).
- "staircase.implication" (K3 seed): what follows for the move sequence.
NO INVENTED NUMBERS: if the description states a number (minutes, %, x), it must have "evidence" OR be explicitly marked "declared" (declared, unconfirmed) — never a number with no source.
STRUCTURAL GAPS to surface if detected: (1) a step targeted for action but unmeasured; (2) standardize proposed before a confirmed convert/streamline gain exists; (3) a step classified convertible with no 'convert' improvement logged.`;
}
