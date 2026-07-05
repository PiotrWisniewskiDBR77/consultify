/**
 * Dynamic SWOT — insight staircase (OXFORD O3 pilot).
 *
 * CONCLUSION_LAYER_STANDARD K1->K2->K3 discipline applied to individual SWOT items:
 * every element carries fact -> interpretation -> implication, so the reader always
 * sees WHERE the conclusion came from (the audit gap: "brak insight-staircase").
 *
 * The second discipline enforced here is DECOMPOSITION: umbrella claims like
 * "brak zwinności" / "lack of agility" must be broken into their dominant root
 * (process / tools / skills / incentives), because each root demands a different move.
 */

export interface SwotInsightStaircase {
  /** K1 — the observable fact, with references into session facts (signal ids). */
  fact: string;
  /** Signal ids / fact keys backing the fact. Empty = declared, unconfirmed. */
  factRefs: string[];
  /** K2 — what the fact means for THIS organization (business consequence). */
  interpretation: string;
  /** K3 seed — what it implies for the decision at hand (feeds tensions/moves). */
  implication: string;
}

export type SwotRootDimension = 'process' | 'tools' | 'skills' | 'incentives';

export interface SwotDecomposition {
  dimension: SwotRootDimension;
  finding: string;
}

export interface SwotStaircaseIssue {
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
 * Umbrella terms that hide 2+ different problems behind one word. An item whose
 * text matches one of these and has no decomposition is not actionable yet.
 * Matching is substring-based on lowercased text (PL + EN forms).
 */
const UMBRELLA_TERMS: { pattern: RegExp; labelEn: string; labelPl: string }[] = [
  { pattern: /agility|agile|zwinno/i, labelEn: 'agility', labelPl: 'zwinność' },
  { pattern: /communicat|komunikacj/i, labelEn: 'communication', labelPl: 'komunikacja' },
  { pattern: /\bculture\b|kultur[aey]/i, labelEn: 'culture', labelPl: 'kultura' },
  { pattern: /innovat|innowacyj/i, labelEn: 'innovation', labelPl: 'innowacyjność' },
  { pattern: /efficien|efektywno|wydajno/i, labelEn: 'efficiency', labelPl: 'efektywność' },
  { pattern: /digitali[sz]|cyfryzacj/i, labelEn: 'digitalization', labelPl: 'cyfryzacja' },
  { pattern: /leadership|przywódz/i, labelEn: 'leadership', labelPl: 'przywództwo' },
  { pattern: /quality issues|problemy z jako/i, labelEn: 'quality', labelPl: 'jakość' },
];

export function detectUmbrellaClaim(
  text: string
): { labelEn: string; labelPl: string } | null {
  for (const term of UMBRELLA_TERMS) {
    if (term.pattern.test(text)) return { labelEn: term.labelEn, labelPl: term.labelPl };
  }
  return null;
}

export function requiresDecomposition(text: string): boolean {
  return detectUmbrellaClaim(text) !== null;
}

interface StaircaseValidationInput {
  text: string;
  staircase?: SwotInsightStaircase;
  decomposition?: SwotDecomposition[];
  /** 'declared' items may legitimately have zero factRefs. */
  evidenceStatus?: 'confirmed' | 'declared' | 'missing';
}

/**
 * Validates the fact->interpretation->implication structure of one SWOT item.
 * Used by tests, by the review-gap computation, and as an adversarial checklist
 * fed back into AI prompts.
 */
export function validateInsightStaircase(item: StaircaseValidationInput): SwotStaircaseIssue[] {
  const issues: SwotStaircaseIssue[] = [];
  const s = item.staircase;

  if (!s || !s.fact?.trim()) {
    issues.push({
      code: 'missing-fact',
      messageEn: 'Item has no underlying fact (K1) — where does this claim come from?',
      messagePl: 'Element nie ma faktu bazowego (K1) — skąd pochodzi ta teza?',
    });
  }
  if (!s || !s.interpretation?.trim()) {
    issues.push({
      code: 'missing-interpretation',
      messageEn: 'Item has no interpretation (K2) — what does the fact mean for this business?',
      messagePl: 'Element nie ma interpretacji (K2) — co ten fakt znaczy dla tego biznesu?',
    });
  }
  if (!s || !s.implication?.trim()) {
    issues.push({
      code: 'missing-implication',
      messageEn: 'Item has no implication (K3 seed) — what follows for the decision?',
      messagePl: 'Element nie ma implikacji (zalążek K3) — co z tego wynika dla decyzji?',
    });
  }
  if (s && s.fact?.trim() && (!s.factRefs || s.factRefs.length === 0)) {
    if (item.evidenceStatus === 'confirmed') {
      issues.push({
        code: 'missing-fact-refs',
        messageEn: 'Item is marked confirmed but references no session evidence.',
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
        messageEn: 'Interpretation restates the fact instead of adding business meaning.',
        messagePl: 'Interpretacja powtarza fakt zamiast dodawać sens biznesowy.',
      });
    }
  }
  if (requiresDecomposition(item.text) && (!item.decomposition || item.decomposition.length === 0)) {
    const umbrella = detectUmbrellaClaim(item.text);
    issues.push({
      code: 'needs-decomposition',
      messageEn: `"${umbrella?.labelEn}" hides several different problems — decompose into process / tools / skills / incentives; each root demands a different move.`,
      messagePl: `„${umbrella?.labelPl}" ukrywa kilka różnych problemów — zdekomponuj na procesy / narzędzia / kompetencje / bodźce; każdy korzeń wymaga innego ruchu.`,
    });
  }
  return issues;
}

/** Prompt block teaching the model the staircase contract (PL/EN aware). */
export function buildStaircasePromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `KAŻDY element SWOT musi nieść drabinę wniosku (insight staircase):
- "staircase.fact" (K1): obserwowalny fakt Z SESJI — liczba/obserwacja z sygnałów, nigdy wymyślona; "factRefs" wskazują id sygnałów.
- "staircase.interpretation" (K2): co ten fakt znaczy dla TEJ firmy (konsekwencja biznesowa), nie parafraza faktu.
- "staircase.implication" (K3-zalążek): co z tego wynika dla decyzji — zasila napięcia i ruchy.
- Teza parasolowa (np. "brak zwinności", "słaba komunikacja", "kultura") MUSI mieć "decomposition":
  [{"dimension":"process|tools|skills|incentives","finding":"..."}] — każdy korzeń wymaga innego ruchu.
- Element bez dowodu w sesji: factRefs=[] i evidenceStatus="declared" — jawnie "deklaracja, niepotwierdzone".`;
  }
  return `EVERY SWOT item must carry an insight staircase:
- "staircase.fact" (K1): an observable fact FROM THE SESSION — a number/observation from signals, never invented; "factRefs" point at signal ids.
- "staircase.interpretation" (K2): what the fact means for THIS company (business consequence), not a paraphrase of the fact.
- "staircase.implication" (K3 seed): what follows for the decision — it feeds tensions and moves.
- Umbrella claims (e.g. "lack of agility", "poor communication", "culture") MUST include "decomposition":
  [{"dimension":"process|tools|skills|incentives","finding":"..."}] — each root demands a different move.
- An item with no session evidence: factRefs=[] and evidenceStatus="declared" — explicitly "declared, unconfirmed".`;
}
