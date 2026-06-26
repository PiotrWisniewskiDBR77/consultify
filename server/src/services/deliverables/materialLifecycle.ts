/**
 * materialLifecycle (F6.1) — maszyna stanów cyklu życia materiału.
 *
 * Draft → Review → Authorized → Sent. „Sent" = auto-lock (immutable): wysłanego
 * materiału nie edytujemy ani nie cofamy — to dowód wysłany klientowi.
 *
 * Dozwolone przejścia (poza happy-path też powroty):
 *   draft      → review                    (submit do akceptacji)
 *   review     → draft | authorized        (zwrot do poprawek | akceptacja)
 *   authorized → review | draft | sent     (cofnij akceptację | major-revision | wyślij)
 *   sent       → (BRAK — zamknięte)
 *
 * Czyste funkcje, deterministyczne, nigdy nie rzucają.
 */

export type MaterialState = 'draft' | 'review' | 'authorized' | 'sent';

export const MATERIAL_STATES: readonly MaterialState[] = [
  'draft',
  'review',
  'authorized',
  'sent',
] as const;

/** Graf dozwolonych przejść. `sent` = stan terminalny (pusta lista). */
const ALLOWED_TRANSITIONS: Record<MaterialState, readonly MaterialState[]> = {
  draft: ['review'],
  review: ['draft', 'authorized'],
  authorized: ['review', 'draft', 'sent'],
  sent: [],
};

export function isMaterialState(s: unknown): s is MaterialState {
  return typeof s === 'string' && (MATERIAL_STATES as readonly string[]).includes(s);
}

/** Czy stan jest zamknięty (wysłany → immutable)? */
export function isLocked(state: MaterialState): boolean {
  return state === 'sent';
}

/**
 * Czy materiał w tym stanie można edytować?
 * draft/review = tak (praca w toku). authorized = nie (zaakceptowany — wymaga
 * cofnięcia do review). sent = nie (zamknięty).
 */
export function isEditable(state: MaterialState): boolean {
  return state === 'draft' || state === 'review';
}

/** Czy przejście from→to jest dozwolone? */
export function canTransition(from: MaterialState, to: MaterialState): boolean {
  if (!isMaterialState(from) || !isMaterialState(to)) return false;
  return (ALLOWED_TRANSITIONS[from] as readonly string[]).includes(to);
}

/** Dozwolone następne stany z danego stanu. */
export function nextStates(from: MaterialState): MaterialState[] {
  return isMaterialState(from) ? [...ALLOWED_TRANSITIONS[from]] : [];
}

export interface TransitionResult {
  ok: boolean;
  state: MaterialState; // stan po (lub bez zmiany przy błędzie)
  error?: string;
}

/**
 * Wykonaj przejście. Zwraca nowy stan lub błąd (bez rzutu).
 * Egzekwuje: brak edycji/cofania z `sent`; tylko dozwolone krawędzie grafu.
 */
export function transition(from: MaterialState, to: MaterialState): TransitionResult {
  if (!isMaterialState(from)) {
    return { ok: false, state: 'draft', error: `Unknown source state: ${String(from)}` };
  }
  if (!isMaterialState(to)) {
    return { ok: false, state: from, error: `Unknown target state: ${String(to)}` };
  }
  if (from === 'sent') {
    return { ok: false, state: from, error: 'Material is sent (locked) — no further transitions' };
  }
  if (from === to) {
    return { ok: false, state: from, error: `Already in state "${to}"` };
  }
  if (!canTransition(from, to)) {
    return {
      ok: false,
      state: from,
      error: `Illegal transition ${from} → ${to} (allowed: ${ALLOWED_TRANSITIONS[from].join(', ') || 'none'})`,
    };
  }
  return { ok: true, state: to };
}
