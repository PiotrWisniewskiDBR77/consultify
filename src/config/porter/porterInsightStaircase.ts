/**
 * Market Forces (Porter) — insight staircase (OXFORD O3, tool #2).
 *
 * Cloned from src/config/swot/swotInsightStaircase.ts.
 * CONCLUSION_LAYER_STANDARD K1->K2->K3 discipline applied to EACH FORCE:
 * every force verdict carries fact -> interpretation -> implication, so the reader
 * always sees WHERE the intensity rating came from — never a bare 1-5 slider.
 *
 * The second discipline enforced here is DRIVER DECOMPOSITION: a force is never
 * "high" as one undifferentiated blob. It is high BECAUSE of a dominant structural
 * driver (concentration / switching-costs / barriers / scale-economics), and each
 * driver points at a different strategic response — exactly as SWOT decomposes an
 * umbrella weakness into process/tools/skills/incentives.
 */

import type { PorterForceId } from '@/store/useToolStore';

export interface PorterForceStaircase {
  /** K1 — the observable structural fact, with references into session facts (signal ids). */
  fact: string;
  /** Signal ids / fact keys backing the fact. Empty = declared, unconfirmed. */
  factRefs: string[];
  /** K2 — what the fact means for THIS company's margin/position (business consequence). */
  interpretation: string;
  /** K3 seed — what it implies for the strategic response (feeds the synthesis engine). */
  implication: string;
}

/**
 * Structural drivers behind a Porter force. Each demands a different strategic move:
 *   concentration    -> shape structure / de-concentrate exposure
 *   switching-costs   -> raise or exploit lock-in
 *   barriers          -> build / defend / breach an entry or mobility barrier
 *   scale-economics   -> win on cost curve or avoid a losing one
 */
export type PorterDriverDimension =
  | 'concentration'
  | 'switching-costs'
  | 'barriers'
  | 'scale-economics';

export interface PorterDriverDecomposition {
  dimension: PorterDriverDimension;
  finding: string;
}

export interface PorterStaircaseIssue {
  code:
    | 'missing-fact'
    | 'missing-interpretation'
    | 'missing-implication'
    | 'missing-fact-refs'
    | 'needs-driver'
    | 'interpretation-is-restatement'
    | 'intensity-without-driver';
  messageEn: string;
  messagePl: string;
}

export const PORTER_DRIVER_LABELS: Record<PorterDriverDimension, { en: string; pl: string }> = {
  concentration: { en: 'concentration', pl: 'koncentracja' },
  'switching-costs': { en: 'switching costs', pl: 'koszty zmiany' },
  barriers: { en: 'entry/mobility barriers', pl: 'bariery wejścia/mobilności' },
  'scale-economics': { en: 'scale economics', pl: 'ekonomia skali' },
};

interface StaircaseValidationInput {
  force: PorterForceId;
  /** The synthesized intensity verdict for this force, if already computed. */
  intensity?: 'low' | 'medium' | 'high';
  staircase?: PorterForceStaircase;
  drivers?: PorterDriverDecomposition[];
  /** 'declared' forces may legitimately have zero factRefs. */
  evidenceStatus?: 'confirmed' | 'declared' | 'missing';
}

/**
 * Validates the fact->interpretation->implication structure of one force verdict.
 * Used by tests, by the review-gap computation, and as an adversarial checklist
 * fed back into AI prompts. A high/medium force MUST name at least one structural
 * driver — an intensity rating without a driver is an opinion, not an analysis.
 */
export function validatePorterStaircase(item: StaircaseValidationInput): PorterStaircaseIssue[] {
  const issues: PorterStaircaseIssue[] = [];
  const s = item.staircase;

  if (!s || !s.fact?.trim()) {
    issues.push({
      code: 'missing-fact',
      messageEn: 'Force has no underlying structural fact (K1) — what in the market makes this force what it is?',
      messagePl: 'Siła nie ma faktu strukturalnego (K1) — co na rynku czyni tę siłę tym, czym jest?',
    });
  }
  if (!s || !s.interpretation?.trim()) {
    issues.push({
      code: 'missing-interpretation',
      messageEn: 'Force has no interpretation (K2) — what does this fact mean for our margin or position?',
      messagePl: 'Siła nie ma interpretacji (K2) — co ten fakt znaczy dla naszej marży lub pozycji?',
    });
  }
  if (!s || !s.implication?.trim()) {
    issues.push({
      code: 'missing-implication',
      messageEn: 'Force has no implication (K3 seed) — what strategic response does it point to?',
      messagePl: 'Siła nie ma implikacji (zalążek K3) — na jaką odpowiedź strategiczną wskazuje?',
    });
  }
  if (s && s.fact?.trim() && (!s.factRefs || s.factRefs.length === 0)) {
    if (item.evidenceStatus === 'confirmed') {
      issues.push({
        code: 'missing-fact-refs',
        messageEn: 'Force is marked confirmed but references no session evidence.',
        messagePl: 'Siła oznaczona jako potwierdzona, ale nie wskazuje dowodu z sesji.',
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
        messageEn: 'Interpretation restates the fact instead of adding margin/position meaning.',
        messagePl: 'Interpretacja powtarza fakt zamiast dodawać sens dla marży/pozycji.',
      });
    }
  }
  // A high/medium force must name at least one structural driver.
  const hasDrivers = Boolean(item.drivers && item.drivers.length > 0);
  if ((item.intensity === 'high' || item.intensity === 'medium') && !hasDrivers) {
    issues.push({
      code: 'intensity-without-driver',
      messageEn: `A ${item.intensity} force must name its dominant structural driver — concentration / switching costs / barriers / scale economics — each points at a different move.`,
      messagePl: `Siła ${item.intensity === 'high' ? 'wysoka' : 'średnia'} musi nazwać dominujący sterownik strukturalny — koncentracja / koszty zmiany / bariery / ekonomia skali — każdy wskazuje inny ruch.`,
    });
  }
  return issues;
}

export function requiresDriver(intensity?: 'low' | 'medium' | 'high'): boolean {
  return intensity === 'high' || intensity === 'medium';
}

/** Prompt block teaching the model the staircase contract (PL/EN aware). */
export function buildPorterStaircasePromptRules(language: 'pl' | 'en'): string {
  if (language === 'pl') {
    return `KAŻDA siła Portera musi nieść drabinę wniosku (insight staircase):
- "staircase.fact" (K1): obserwowalny fakt strukturalny Z SESJI — koncentracja/udział/liczba z sygnałów, nigdy wymyślony; "factRefs" wskazują id sygnałów.
- "staircase.interpretation" (K2): co ten fakt znaczy dla NASZEJ marży/pozycji, nie parafraza faktu.
- "staircase.implication" (K3-zalążek): na jaką odpowiedź strategiczną wskazuje — zasila silnik syntezy.
- Siła oceniona jako wysoka/średnia MUSI mieć "drivers":
  [{"dimension":"concentration|switching-costs|barriers|scale-economics","finding":"..."}] — każdy sterownik wskazuje inny ruch.
- Siła bez dowodu w sesji: factRefs=[] i evidenceStatus="declared" — jawnie „deklaracja, niepotwierdzone".`;
  }
  return `EVERY Porter force must carry an insight staircase:
- "staircase.fact" (K1): an observable structural fact FROM THE SESSION — concentration/share/count from signals, never invented; "factRefs" point at signal ids.
- "staircase.interpretation" (K2): what the fact means for OUR margin/position, not a paraphrase of the fact.
- "staircase.implication" (K3 seed): what strategic response it points to — it feeds the synthesis engine.
- A force rated high/medium MUST include "drivers":
  [{"dimension":"concentration|switching-costs|barriers|scale-economics","finding":"..."}] — each driver points at a different move.
- A force with no session evidence: factRefs=[] and evidenceStatus="declared" — explicitly "declared, unconfirmed".`;
}
