/**
 * RPA Scanner — insight staircase + structural gap detection (OXFORD O3).
 *
 * Pattern mirror of src/config/smedplanner/smedInsightStaircase.ts, retargeted
 * from SMED improvements to RPA automation ideas and the assessment session's
 * structural facts. Closes the same audit gap: a session can score gates and
 * sequence moves without ever being forced to justify WHY an idea belongs on
 * the list, or WHY a technology tier was picked. This module enforces three
 * disciplines:
 *
 *   1. K1->K2->K3 STAIRCASE per automation idea — fact (what was observed) ->
 *      interpretation (what it means for THIS process) -> implication (what
 *      follows for the move sequence).
 *   2. INVENTED-NUMBER GUARD — an idea/candidate claim that quantifies
 *      (minutes, volume, %, ROI) with no evidence and no declared status is
 *      flagged.
 *   3. STRUCTURAL GAP DETECTION — portfolio-level facts the gate-score engine
 *      cannot see on its own: candidates missing the figures a tech-tier
 *      decision depends on, an optimistic tier pick on a high-exception
 *      candidate, orphan ideas, and candidates fast-tracked to a tech tier
 *      before being standardized.
 */

import type { AutomationIdea, ProcessCandidate, RpaSession } from './feasibilityEngine';

// ---------------------------------------------------------------------------
// K1 -> K2 -> K3 staircase per automation idea
// ---------------------------------------------------------------------------

export interface RpaInsightStaircase {
  /** K1 — the observable fact, with references into session evidence. */
  fact: string;
  factRefs: string[];
  /** K2 — what the fact means FOR THIS PROCESS (not a generic RPA truth). */
  interpretation: string;
  /** K3 seed — what follows for the move sequence. */
  implication: string;
}

export interface RpaStaircaseIssue {
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

interface IdeaStaircaseInput {
  id?: string;
  title?: string;
  description?: string;
  evidence?: unknown[];
  staircase?: RpaInsightStaircase;
  evidenceStatus?: 'confirmed' | 'declared' | 'missing';
}

/** Validates the fact->interpretation->implication structure of one automation idea. */
export function validateRpaInsightStaircase(item: IdeaStaircaseInput): RpaStaircaseIssue[] {
  const issues: RpaStaircaseIssue[] = [];
  const s = item.staircase;

  if (!s || !s.fact?.trim()) {
    issues.push({
      code: 'missing-fact',
      itemId: item.id,
      messageEn: 'Idea has no underlying fact (K1) — what was observed about this process?',
      messagePl: 'Pomysł nie ma faktu bazowego (K1) — co zaobserwowano w tym procesie?',
    });
  }
  if (!s || !s.interpretation?.trim()) {
    issues.push({
      code: 'missing-interpretation',
      itemId: item.id,
      messageEn: 'Idea has no interpretation (K2) — what does the fact mean for THIS process?',
      messagePl: 'Pomysł nie ma interpretacji (K2) — co ten fakt znaczy dla TEGO procesu?',
    });
  }
  if (!s || !s.implication?.trim()) {
    issues.push({
      code: 'missing-implication',
      itemId: item.id,
      messageEn: 'Idea has no implication (K3 seed) — what follows for the move sequence?',
      messagePl: 'Pomysł nie ma implikacji (zalążek K3) — co z tego wynika dla sekwencji ruchów?',
    });
  }
  if (s && s.fact?.trim() && (!s.factRefs || s.factRefs.length === 0)) {
    if (item.evidenceStatus === 'confirmed') {
      issues.push({
        code: 'missing-fact-refs',
        itemId: item.id,
        messageEn: 'Idea is marked confirmed but references no session evidence.',
        messagePl: 'Pomysł oznaczony jako potwierdzony, ale nie wskazuje dowodu z sesji.',
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
          'Interpretation restates the fact instead of explaining what it means for this process.',
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

const QUANTIFIED_CLAIM =
  /(\d[\d.,]*\s?%)|(\d[\d.,]*\s?(min|h|godz|x|×|k|m)\b)|(\bpln\b|\beur\b|\busd\b|€|\$|zł)/i;

export function textMakesQuantifiedClaim(text: string): boolean {
  return QUANTIFIED_CLAIM.test(text);
}

function validateInventedNumberGuard(item: IdeaStaircaseInput): RpaStaircaseIssue[] {
  const haystack = `${item.title || ''} ${item.description || ''}`;
  if (!textMakesQuantifiedClaim(haystack)) return [];

  const isDeclared = item.evidenceStatus === 'declared';
  const hasEvidence = (item.evidence?.length || 0) > 0;
  if (hasEvidence || isDeclared) return [];

  return [
    {
      code: 'invented-number',
      itemId: item.id,
      messageEn:
        'Idea states a number with no evidence behind it — attach a source (log, PoC) or mark it "declared, unconfirmed" (no invented volume or ROI).',
      messagePl:
        'Pomysł podaje liczbę, której nie kryje żaden dowód — podepnij źródło (log, PoC) albo oznacz jako „deklaracja, niepotwierdzone" (zakaz zmyślania wolumenu lub ROI).',
    },
  ];
}

// ---------------------------------------------------------------------------
// Structural gap detection (portfolio-level facts the gate-score engine cannot see)
// ---------------------------------------------------------------------------

export interface RpaGap {
  code:
    | 'unquantified-candidate'
    | 'high-exception-optimistic-tier'
    | 'idea-without-candidate'
    | 'low-standardization-fast-tracked';
  candidateId?: string;
  ideaId?: string;
  messageEn: string;
  messagePl: string;
}

/** High exception share above which a plain rule-based bot is a poor fit. */
const HIGH_EXCEPTION_THRESHOLD = 0.3;

/**
 * Detects four structural gaps a gate-score ranking alone would miss:
 *
 *   - unquantified-candidate: a tech tier was picked before volume/handling
 *     time exist — the business case is unquantified.
 *   - high-exception-optimistic-tier: a candidate with >30% exceptions is
 *     assigned to plain 'rpa', which does not handle exceptions well.
 *   - idea-without-candidate: an idea references a processId with no matching
 *     candidate — an orphan idea (mirrors the ambition orphan-initiative gap).
 *   - low-standardization-fast-tracked: a candidate with low standardization
 *     already has a tech tier assigned, skipping the standardize gate.
 */
export function detectRpaGaps(session: RpaSession): RpaGap[] {
  const gaps: RpaGap[] = [];
  const candidates: ProcessCandidate[] = session.candidates || [];
  const ideas: AutomationIdea[] = session.ideas || [];

  candidates
    .filter((c) => c.techTier !== undefined)
    .filter((c) => c.volumePerMonth === undefined || c.handlingMinutes === undefined)
    .forEach((c) => {
      gaps.push({
        code: 'unquantified-candidate',
        candidateId: c.id,
        messageEn: `Candidate "${c.id}" has a tech tier (${c.techTier}) assigned but is missing volume or handling time — the business case is unquantified.`,
        messagePl: `Kandydat „${c.id}" ma przypisany poziom technologii (${c.techTier}), ale brakuje wolumenu lub czasu obsługi — przypadek biznesowy jest niepoliczony.`,
      });
    });

  candidates
    .filter((c) => c.techTier === 'rpa' && (c.exceptionRate ?? 0) > HIGH_EXCEPTION_THRESHOLD)
    .forEach((c) => {
      gaps.push({
        code: 'high-exception-optimistic-tier',
        candidateId: c.id,
        messageEn: `Candidate "${c.id}" has a ${Math.round((c.exceptionRate || 0) * 100)}% exception rate but is assigned plain "rpa" — a rule-based bot handles exceptions poorly; consider OCR/API/AI or standardizing first.`,
        messagePl: `Kandydat „${c.id}" ma ${Math.round((c.exceptionRate || 0) * 100)}% wyjątków, ale przypisano zwykłe „rpa" — bot regułowy słabo radzi sobie z wyjątkami; rozważ OCR/API/AI albo najpierw standaryzację.`,
      });
    });

  const candidateIds = new Set(candidates.map((c) => c.id));
  ideas
    .filter((i) => i.processId && !candidateIds.has(i.processId))
    .forEach((i) => {
      gaps.push({
        code: 'idea-without-candidate',
        ideaId: i.id,
        messageEn: `Idea "${i.id}" references process "${i.processId}", which is not among the candidates — an orphan idea with no measured process behind it.`,
        messagePl: `Pomysł „${i.id}" odwołuje się do procesu „${i.processId}", którego nie ma wśród kandydatów — pomysł-sierota bez zmierzonego procesu za sobą.`,
      });
    });

  candidates
    .filter((c) => c.standardization === 'low' && c.techTier !== undefined)
    .forEach((c) => {
      gaps.push({
        code: 'low-standardization-fast-tracked',
        candidateId: c.id,
        messageEn: `Candidate "${c.id}" has low standardization but already has a tech tier (${c.techTier}) — the process is being automated before it is standardized.`,
        messagePl: `Kandydat „${c.id}" ma niską standaryzację, ale już ma przypisany poziom technologii (${c.techTier}) — proces jest automatyzowany, zanim został ustandaryzowany.`,
      });
    });

  return gaps;
}

/** Prompt block teaching the model the staircase + invented-number-guard + gap contract (PL/EN aware). */
export function buildRpaStaircasePromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `KAŻDY pomysł automatyzacji niesie drabinę wniosku (insight staircase):
- "staircase.fact" (K1): obserwowalny fakt Z SESJI, nigdy wymyślony; "factRefs" wskazują dowód.
- "staircase.interpretation" (K2): co ten fakt znaczy dla TEGO procesu (nie ogólna prawda o RPA).
- "staircase.implication" (K3-zalążek): co z tego wynika dla sekwencji ruchów.
ZAKAZ ZMYŚLONYCH LICZB: jeśli opis podaje liczbę (minuty, wolumen, %, ROI), musi mieć dowód w "evidence" LUB być jawnie oznaczony jako "declared" (deklaracja, niepotwierdzone) — nigdy liczba bez źródła.
STRUKTURALNE LUKI do zgłoszenia, jeśli wykryte: (1) kandydat z poziomem technologii, ale bez policzonego wolumenu/czasu; (2) wysoki udział wyjątków (>30%) przy zwykłym poziomie „rpa"; (3) pomysł bez odpowiadającego kandydata (sierota); (4) kandydat o niskiej standaryzacji już przyspieszony do poziomu technologii.`;
  }
  return `EVERY automation idea carries an insight staircase:
- "staircase.fact" (K1): an observable fact FROM THE SESSION, never invented; "factRefs" point at evidence.
- "staircase.interpretation" (K2): what the fact means for THIS process (not a generic RPA truth).
- "staircase.implication" (K3 seed): what follows for the move sequence.
NO INVENTED NUMBERS: if the description states a number (minutes, volume, %, ROI), it must have "evidence" OR be explicitly marked "declared" (declared, unconfirmed) — never a number with no source.
STRUCTURAL GAPS to surface if detected: (1) a candidate with a tech tier but no counted volume/handling time; (2) a high exception rate (>30%) on plain "rpa" tier; (3) an idea with no matching candidate (orphan); (4) a low-standardization candidate already fast-tracked to a tech tier.`;
}
