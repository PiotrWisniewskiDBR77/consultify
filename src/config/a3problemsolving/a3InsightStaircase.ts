/**
 * A3 Problem Solving — insight staircase (OXFORD O3).
 *
 * The A3 analogue of src/config/swot/swotInsightStaircase.ts. CONCLUSION_LAYER_STANDARD
 * K1->K2->K3 discipline applied to individual A3 elements: every element carries
 * fact -> interpretation -> implication, so the reader always sees WHERE the
 * conclusion came from ("skąd wniosek"). For an A3, the staircase is the audit
 * trail that turns "the line is slow" into "cycle time is 42s vs 30s standard on
 * station 4 (fact) -> the bottleneck sits downstream of the fixture change (meaning)
 * -> the countermeasure must attack the fixture change, not the operator (implication)".
 *
 * The second discipline enforced here is DECOMPOSITION: umbrella claims like
 * "quality issues" / "problemy z jakością" must be broken into their dominant root
 * dimension (process / tools / skills / incentives), because each root demands a
 * different countermeasure — the same trap the root-cause ladder guards against.
 */

import type { A3RootDimension } from './a3CausalEngine';

export interface A3InsightStaircase {
  /** K1 — the observable fact, with references into session facts (signal/data ids). */
  fact: string;
  /** Signal/data ids backing the fact. Empty = declared, unconfirmed. */
  factRefs: string[];
  /** K2 — what the fact means for THIS problem (business/operational consequence). */
  interpretation: string;
  /** K3 seed — what it implies for the countermeasure decision. */
  implication: string;
}

export interface A3Decomposition {
  dimension: A3RootDimension;
  finding: string;
}

export interface A3StaircaseIssue {
  code:
    | 'missing-fact'
    | 'missing-interpretation'
    | 'missing-implication'
    | 'missing-fact-refs'
    | 'needs-decomposition'
    | 'interpretation-is-restatement';
  messageEn: string;
  messagePl: string;
}

/**
 * Umbrella terms that hide 2+ different problems behind one word. An A3 element
 * whose text matches one of these and has no decomposition is not actionable yet.
 * Matching is substring-based on lowercased text (PL + EN forms).
 */
const UMBRELLA_TERMS: { pattern: RegExp; labelEn: string; labelPl: string }[] = [
  {
    pattern: /quality issues|poor quality|problemy z jako|niska jako/i,
    labelEn: 'quality',
    labelPl: 'jakość',
  },
  {
    pattern: /inefficien|efficien|efektywno|wydajno/i,
    labelEn: 'efficiency',
    labelPl: 'efektywność',
  },
  { pattern: /communicat|komunikacj/i, labelEn: 'communication', labelPl: 'komunikacja' },
  { pattern: /\bculture\b|kultur[aey]/i, labelEn: 'culture', labelPl: 'kultura' },
  {
    pattern: /human error|błąd ludzk|błędy ludzk/i,
    labelEn: 'human error',
    labelPl: 'błąd ludzki',
  },
  { pattern: /training|szkoleni/i, labelEn: 'training', labelPl: 'szkolenia' },
  {
    pattern: /motivat|motywacj|zaangażowan|engagement/i,
    labelEn: 'motivation',
    labelPl: 'motywacja',
  },
  { pattern: /waste|marnotraw|straty/i, labelEn: 'waste', labelPl: 'marnotrawstwo' },
];

export function detectA3UmbrellaClaim(text: string): { labelEn: string; labelPl: string } | null {
  for (const term of UMBRELLA_TERMS) {
    if (term.pattern.test(text)) return { labelEn: term.labelEn, labelPl: term.labelPl };
  }
  return null;
}

export function requiresA3Decomposition(text: string): boolean {
  return detectA3UmbrellaClaim(text) !== null;
}

interface StaircaseValidationInput {
  text: string;
  staircase?: A3InsightStaircase;
  decomposition?: A3Decomposition[];
  /** 'declared' items may legitimately have zero factRefs. */
  evidenceStatus?: 'confirmed' | 'declared' | 'missing';
}

/**
 * Validates the fact->interpretation->implication structure of one A3 element.
 * Used by tests, by the review-gap computation, and as an adversarial checklist
 * fed back into AI prompts.
 */
export function validateA3InsightStaircase(item: StaircaseValidationInput): A3StaircaseIssue[] {
  const issues: A3StaircaseIssue[] = [];
  const s = item.staircase;

  if (!s || !s.fact?.trim()) {
    issues.push({
      code: 'missing-fact',
      messageEn: 'Element has no underlying fact (K1) — where does this claim come from?',
      messagePl: 'Element nie ma faktu bazowego (K1) — skąd pochodzi ta teza?',
    });
  }
  if (!s || !s.interpretation?.trim()) {
    issues.push({
      code: 'missing-interpretation',
      messageEn: 'Element has no interpretation (K2) — what does the fact mean for this problem?',
      messagePl: 'Element nie ma interpretacji (K2) — co ten fakt znaczy dla tego problemu?',
    });
  }
  if (!s || !s.implication?.trim()) {
    issues.push({
      code: 'missing-implication',
      messageEn: 'Element has no implication (K3 seed) — what follows for the countermeasure?',
      messagePl: 'Element nie ma implikacji (zalążek K3) — co z tego wynika dla przeciwśrodka?',
    });
  }
  if (s && s.fact?.trim() && (!s.factRefs || s.factRefs.length === 0)) {
    if (item.evidenceStatus === 'confirmed') {
      issues.push({
        code: 'missing-fact-refs',
        messageEn: 'Element is marked confirmed but references no session evidence.',
        messagePl: 'Element oznaczony jako potwierdzony, ale nie wskazuje dowodu z sesji.',
      });
    }
  }
  // Interpretation must add meaning, not restate the fact.
  if (s && s.fact?.trim() && s.interpretation?.trim()) {
    const fact = s.fact.trim().toLowerCase();
    const interp = s.interpretation.trim().toLowerCase();
    if (fact === interp || (interp.length > 20 && fact.includes(interp))) {
      issues.push({
        code: 'interpretation-is-restatement',
        messageEn: 'Interpretation restates the fact instead of adding operational meaning.',
        messagePl: 'Interpretacja powtarza fakt zamiast dodawać sens operacyjny.',
      });
    }
  }
  if (
    requiresA3Decomposition(item.text) &&
    (!item.decomposition || item.decomposition.length === 0)
  ) {
    const umbrella = detectA3UmbrellaClaim(item.text);
    issues.push({
      code: 'needs-decomposition',
      messageEn: `"${umbrella?.labelEn}" hides several different problems — decompose into process / tools / skills / incentives; each root demands a different countermeasure.`,
      messagePl: `„${umbrella?.labelPl}" ukrywa kilka różnych problemów — zdekomponuj na procesy / narzędzia / kompetencje / bodźce; każdy korzeń wymaga innego przeciwśrodka.`,
    });
  }
  return issues;
}

/** Prompt block teaching the model the staircase contract (PL/EN aware). */
export function buildA3StaircasePromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `KAŻDY element A3 musi nieść drabinę wniosku (insight staircase):
- "staircase.fact" (K1): obserwowalny fakt Z SESJI — pomiar/obserwacja z gemba, nigdy wymyślony; "factRefs" wskazują id danych/sygnałów.
- "staircase.interpretation" (K2): co ten fakt znaczy dla TEGO problemu (konsekwencja operacyjna), nie parafraza faktu.
- "staircase.implication" (K3-zalążek): co z tego wynika dla przeciwśrodka.
- Teza parasolowa (np. „problemy z jakością", „błąd ludzki", „niska efektywność") MUSI mieć "decomposition":
  [{"dimension":"process|tools|skills|incentives","finding":"..."}] — każdy korzeń wymaga innego przeciwśrodka.
- Element bez dowodu w sesji: factRefs=[] i evidenceStatus="declared" — jawnie „deklaracja, niepotwierdzone".`;
  }
  return `EVERY A3 element must carry an insight staircase:
- "staircase.fact" (K1): an observable fact FROM THE SESSION — a measurement/gemba observation, never invented; "factRefs" point at data/signal ids.
- "staircase.interpretation" (K2): what the fact means for THIS problem (operational consequence), not a paraphrase of the fact.
- "staircase.implication" (K3 seed): what follows for the countermeasure.
- Umbrella claims (e.g. "quality issues", "human error", "inefficiency") MUST include "decomposition":
  [{"dimension":"process|tools|skills|incentives","finding":"..."}] — each root demands a different countermeasure.
- An element with no session evidence: factRefs=[] and evidenceStatus="declared" — explicitly "declared, unconfirmed".`;
}
