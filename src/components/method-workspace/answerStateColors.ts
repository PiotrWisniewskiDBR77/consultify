/**
 * answerStateColors — JEDNO źródło mapy „stan odpowiedzi → kolor semantyczny".
 *
 * Uwaga właściciela 06.09 15:10 (sesja DRD, poziom 3): „Po naciśnięciu
 * przycisku »Potwierdzone« element ma się zaznaczać odpowiednim kolorem.
 * Karta powinna być wyróżniona […] Jeśli status częściowy — pomarańczowy;
 * potwierdzony — zielony. Bardzo trudno się tym zarządza."
 *
 * Mapa jest używana w TRZECH miejscach naraz (przycisk stanu, karta pytania,
 * kropka statusu w drzewie/akordeonie) — dlatego mieszka tutaj, a nie w
 * którymkolwiek z komponentów. Zmiana koloru w jednym miejscu bez drugiego
 * jest wtedy niemożliwa z konstrukcji.
 *
 * Kanon kolorów (CLAUDE.md reguła UI 3): crimson/`primary-*` NIGDY. Czerwień
 * `c-danger` wyłącznie jako semantyka „nie spełnione" — stan `no`. Stany
 * bez rozstrzygnięcia (`dont_know`, `no_evidence`, `not_applicable`) są
 * NEUTRALNE: mają być widocznie WYBRANE, ale nie mogą udawać wyniku.
 */
import type { MethodAnswerState } from './types';

export type AnswerStateTone = 'success' | 'warning' | 'danger' | 'neutral';

export const ANSWER_STATE_TONE: Record<MethodAnswerState, AnswerStateTone> = {
  confirmed: 'success',
  partial: 'warning',
  no: 'danger',
  dont_know: 'neutral',
  no_evidence: 'neutral',
  not_applicable: 'neutral',
};

/** Wybrany przycisk stanu — pełne wypełnienie + obramowanie w kolorze tonu. */
export const ANSWER_TONE_BUTTON_SELECTED: Record<AnswerStateTone, string> = {
  success: 'border-c-success bg-c-success/15 text-c-success',
  warning: 'border-c-warning bg-c-warning/15 text-c-warning',
  danger: 'border-c-danger bg-c-danger/15 text-c-danger',
  neutral: 'border-c-border-strong bg-c-surface-raised text-c-text',
};

/** Karta pytania — lewa krawędź 4px + delikatne tło w tym samym kolorze. */
export const ANSWER_TONE_CARD: Record<AnswerStateTone, string> = {
  success: 'border-l-4 border-l-c-success bg-c-success/5',
  warning: 'border-l-4 border-l-c-warning bg-c-warning/5',
  danger: 'border-l-4 border-l-c-danger bg-c-danger/5',
  neutral: 'border-l-4 border-l-c-border-strong bg-c-surface-raised',
};

/** Kropka statusu (drzewo jednostek, zwinięte kroki akordeonu). */
export const ANSWER_TONE_DOT: Record<AnswerStateTone, string> = {
  success: 'bg-c-success',
  warning: 'bg-c-warning',
  danger: 'bg-c-danger',
  neutral: 'bg-c-text-muted',
};

export const ANSWER_STATE_LABEL: Record<MethodAnswerState, string> = {
  confirmed: 'Potwierdzone',
  partial: 'Częściowo',
  no: 'Nie',
  dont_know: 'Nie wiem / potrzebuję pomocy',
  no_evidence: 'Nie mam dowodu',
  not_applicable: 'Nie dotyczy',
};

export function answerStateTone(state: MethodAnswerState | null | undefined): AnswerStateTone | null {
  if (!state) return null;
  return ANSWER_STATE_TONE[state] ?? null;
}

/** Klasa karty pytania. Bez odpowiedzi = neutralna ramka, BEZ lewej krawędzi. */
export function answerStateCardClass(state: MethodAnswerState | null | undefined): string {
  const tone = answerStateTone(state);
  return tone ? ANSWER_TONE_CARD[tone] : 'border-c-border bg-c-surface';
}

/** Klasa kropki statusu, albo `null` gdy na pytanie jeszcze nie odpowiedziano. */
export function answerStateDotClass(state: MethodAnswerState | null | undefined): string | null {
  const tone = answerStateTone(state);
  return tone ? ANSWER_TONE_DOT[tone] : null;
}

/** Klasa wybranego przycisku stanu. */
export function answerStateButtonSelectedClass(state: MethodAnswerState): string {
  return ANSWER_TONE_BUTTON_SELECTED[ANSWER_STATE_TONE[state]];
}

/**
 * Rollup stanu odpowiedzi dla CAŁEJ jednostki (drzewo po lewej): najgorszy
 * wygrywa. Kolejność jest świadoma — „Nie" i „Częściowo" to informacja o luce,
 * której nie wolno zasłonić zieloną kropką z sąsiedniego pytania; stany
 * nierozstrzygnięte biją „Potwierdzone", bo jednostka nie jest domknięta.
 */
const ROLLUP_PRIORITY: readonly MethodAnswerState[] = [
  'no',
  'partial',
  'dont_know',
  'no_evidence',
  'not_applicable',
  'confirmed',
];

export function rollupAnswerState(
  states: readonly (MethodAnswerState | null | undefined)[]
): MethodAnswerState | null {
  const present = new Set(states.filter(Boolean) as MethodAnswerState[]);
  if (present.size === 0) return null;
  for (const candidate of ROLLUP_PRIORITY) {
    if (present.has(candidate)) return candidate;
  }
  return null;
}
