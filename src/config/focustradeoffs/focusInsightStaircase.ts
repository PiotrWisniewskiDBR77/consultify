/**
 * Focus & Trade-offs — insight staircase (OXFORD O3).
 *
 * Cloned from src/config/porter/porterInsightStaircase.ts. CONCLUSION_LAYER_STANDARD
 * K1->K2->K3 discipline applied to EACH PRIORITY: every pursue/defer/drop
 * verdict must carry fact -> interpretation -> implication, so the reader
 * always sees WHERE the recommendation came from — never a bare 1-5 slider
 * dressed up as a decision.
 *
 * The second discipline is DRIVER DECOMPOSITION: a priority is never "pursue"
 * as one undifferentiated blob. It wins BECAUSE of a dominant driver
 * (evidence-strength / strategic-fit / resource-scarcity / timing-window),
 * and each driver points at a different first step — exactly as Porter
 * decomposes force intensity into concentration/switching-costs/barriers/scale.
 */

export interface FocusPriorityStaircase {
  /** K1 — the observable fact, with references into session facts (signal ids). */
  fact: string;
  /** Signal ids / fact keys backing the fact. Empty = declared, unconfirmed. */
  factRefs: string[];
  /** K2 — what the fact means for scarce attention/capacity (business consequence). */
  interpretation: string;
  /** K3 seed — what it implies for the focus decision (feeds the synthesis engine). */
  implication: string;
}

/**
 * Dominant driver behind a priority's score. Each points at a different
 * consulting move:
 *   evidence-strength   -> validate first / commit fully
 *   strategic-fit        -> re-scope to fit / reject as off-strategy
 *   resource-scarcity     -> sequence / free capacity before starting
 *   timing-window          -> act now / explicitly park with a re-entry trigger
 */
export type FocusDriverDimension =
  | 'evidence-strength'
  | 'strategic-fit'
  | 'resource-scarcity'
  | 'timing-window';

export interface FocusDriverDecomposition {
  dimension: FocusDriverDimension;
  finding: string;
}

export const FOCUS_DRIVER_LABELS: Record<FocusDriverDimension, { en: string; pl: string }> = {
  'evidence-strength': { en: 'evidence strength', pl: 'siła dowodu' },
  'strategic-fit': { en: 'strategic fit', pl: 'dopasowanie strategiczne' },
  'resource-scarcity': { en: 'resource scarcity', pl: 'niedobór zasobów' },
  'timing-window': { en: 'timing window', pl: 'okno czasowe' },
};

export interface FocusStaircaseIssue {
  code:
    | 'missing-fact'
    | 'missing-interpretation'
    | 'missing-implication'
    | 'missing-fact-refs'
    | 'needs-driver'
    | 'interpretation-is-restatement'
    | 'recommendation-without-driver';
  messageEn: string;
  messagePl: string;
}

interface StaircaseValidationInput {
  priorityId: string;
  /** The synthesized recommendation this staircase supports, if already computed. */
  recommendation?: 'pursue' | 'defer' | 'drop';
  staircase?: FocusPriorityStaircase;
  drivers?: FocusDriverDecomposition[];
  /** 'declared' priorities may legitimately have zero factRefs. */
  evidenceStatus?: 'confirmed' | 'declared' | 'missing';
}

/**
 * Validates the fact->interpretation->implication structure of one priority's
 * verdict. Used by tests, by the review-gap computation, and as an
 * adversarial checklist fed back into AI prompts. A pursue/drop verdict
 * (i.e. anything that is NOT a neutral defer) MUST name at least one
 * dominant driver — a recommendation without a driver is an opinion, not
 * an analysis.
 */
export function validateFocusStaircase(item: StaircaseValidationInput): FocusStaircaseIssue[] {
  const issues: FocusStaircaseIssue[] = [];
  const s = item.staircase;

  if (!s || !s.fact?.trim()) {
    issues.push({
      code: 'missing-fact',
      messageEn:
        'Priority has no underlying fact (K1) — what observation makes this priority what it is?',
      messagePl:
        'Priorytet nie ma faktu bazowego (K1) — jaka obserwacja czyni ten priorytet tym, czym jest?',
    });
  }
  if (!s || !s.interpretation?.trim()) {
    issues.push({
      code: 'missing-interpretation',
      messageEn:
        'Priority has no interpretation (K2) — what does this fact mean for scarce capacity?',
      messagePl: 'Priorytet nie ma interpretacji (K2) — co ten fakt znaczy dla ograniczonej mocy?',
    });
  }
  if (!s || !s.implication?.trim()) {
    issues.push({
      code: 'missing-implication',
      messageEn: 'Priority has no implication (K3 seed) — what focus decision does it point to?',
      messagePl: 'Priorytet nie ma implikacji (zalążek K3) — na jaką decyzję o fokusie wskazuje?',
    });
  }
  if (s && s.fact?.trim() && (!s.factRefs || s.factRefs.length === 0)) {
    if (item.evidenceStatus === 'confirmed') {
      issues.push({
        code: 'missing-fact-refs',
        messageEn: 'Priority is marked confirmed but references no session evidence.',
        messagePl: 'Priorytet oznaczony jako potwierdzony, ale nie wskazuje dowodu z sesji.',
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
        messageEn: 'Interpretation restates the fact instead of adding scarce-capacity meaning.',
        messagePl: 'Interpretacja powtarza fakt zamiast dodawać sens dla ograniczonej mocy.',
      });
    }
  }
  // A pursue or drop verdict must name at least one dominant driver.
  const hasDrivers = Boolean(item.drivers && item.drivers.length > 0);
  if ((item.recommendation === 'pursue' || item.recommendation === 'drop') && !hasDrivers) {
    issues.push({
      code: 'recommendation-without-driver',
      messageEn: `A "${item.recommendation}" recommendation must name its dominant driver — evidence strength / strategic fit / resource scarcity / timing window — each points at a different first step.`,
      messagePl: `Rekomendacja „${item.recommendation === 'pursue' ? 'pursue' : 'drop'}" musi nazwać dominujący sterownik — siła dowodu / dopasowanie strategiczne / niedobór zasobów / okno czasowe — każdy wskazuje inny pierwszy krok.`,
    });
  }
  return issues;
}

export function requiresDriver(recommendation?: 'pursue' | 'defer' | 'drop'): boolean {
  return recommendation === 'pursue' || recommendation === 'drop';
}

/** Prompt block teaching the model the staircase contract (PL/EN aware). */
export function buildFocusStaircasePromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `KAŻDY priorytet musi nieść drabinę wniosku (insight staircase):
- "staircase.fact" (K1): obserwowalny fakt Z SESJI — dane popytu/zobowiązanie/koszt zaniechania z sygnałów, nigdy wymyślony; "factRefs" wskazują id sygnałów.
- "staircase.interpretation" (K2): co ten fakt znaczy dla ograniczonej mocy/uwagi, nie parafraza faktu.
- "staircase.implication" (K3-zalążek): na jaką decyzję o fokusie wskazuje — zasila silnik syntezy.
- Priorytet oceniony jako "pursue" lub "drop" MUSI mieć "drivers":
  [{"dimension":"evidence-strength|strategic-fit|resource-scarcity|timing-window","finding":"..."}] — każdy sterownik wskazuje inny pierwszy krok.
- Priorytet bez dowodu w sesji: factRefs=[] i evidenceStatus="declared" — jawnie „deklaracja, niepotwierdzone".`;
  }
  return `EVERY priority must carry an insight staircase:
- "staircase.fact" (K1): an observable fact FROM THE SESSION — demand data/commitment/cost-of-inaction from signals, never invented; "factRefs" point at signal ids.
- "staircase.interpretation" (K2): what the fact means for scarce capacity/attention, not a paraphrase of the fact.
- "staircase.implication" (K3 seed): what focus decision it points to — it feeds the synthesis engine.
- A priority rated "pursue" or "drop" MUST include "drivers":
  [{"dimension":"evidence-strength|strategic-fit|resource-scarcity|timing-window","finding":"..."}] — each driver points at a different first step.
- A priority with no session evidence: factRefs=[] and evidenceStatus="declared" — explicitly "declared, unconfirmed".`;
}
