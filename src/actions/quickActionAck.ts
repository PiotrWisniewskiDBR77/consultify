/**
 * quickActionAck — POTWIERDZENIE SKORELOWANE dla szyny
 * `idea-workspace-quick-action` (RISK-30, S5-TERESA, 2026-08-12).
 *
 * ── PROBLEM ─────────────────────────────────────────────────────────────────
 * `ActionResult.ok` znaczyło „wysłałem zdarzenie", a nie „operacja się stała".
 * Zmierzone na `src/actions/registry/runtimeHelpers.ts` @ edb38d6a29
 * (skrypt-census, wynik zgodny z niezależnym liczeniem koordynatora):
 *   • 90 miejsc `return { ok: true`,
 *   • 6 z nich zaraz po `dispatchQuickAction(...)` — szyna, wystrzel-i-zapomnij
 *     (linie 65, 266, 820, 865, 893, 939),
 *   • 59 zaraz po `(run as () => void)()` — domknięcie UI, którego wyniku
 *     nikt nie oglądał,
 *   • 25 pozostałych — już strzeżone albo niezwiązane.
 * Skutek na produkcie: użytkownik prosi Teresę o usunięcie toru, operacja
 * zostaje ODMÓWIONA (ostatni tor), człowiek widzi poprawny toast z odmową —
 * a odpowiedź Teresy brzmi jak sukces.
 *
 * ── MECHANIZM I DLACZEGO TEN ────────────────────────────────────────────────
 * Identyfikator korelacji (`ackId`) doklejany do detalu zdarzenia szyny +
 * rejestr obietnic (`Map<ackId, resolve>`) + osobne zdarzenie odpowiedzi
 * `idea-workspace-quick-action-ack`.
 *
 * To NIE jest wzorzec wymyślony na tę okazję — to ten sam kształt, który już
 * działa w tym repozytorium w `src/components/MyWork/table/extensions/`:
 * `extensionSDK.ts` (`requestId = crypto.randomUUID()` + `this.callbacks` +
 * `postMessage`) ⇄ `ExtensionHost.tsx` (`sendResponse(requestId, data, error)`
 * → `type: 'tp:response'`). Sprawdzone PRZED wyborem, nie zgadnięte.
 *
 * Odrzucone alternatywy:
 *  • „uczyń handler synchronicznie osiągalnym" — handlery narzędzi to
 *    domknięcia Reacta (`useCallback` nad stanem konkretnej instancji);
 *    rejestr nie ma do nich referencji bez globalnego singletonu instancji,
 *    czego to repo nigdzie nie robi;
 *  • callback wstrzyknięty w `detail.ack` — działałby, ale robi z detalu
 *    zdarzenia kanał dwukierunkowy, nieserializowalny i nieprzenośny poza
 *    jedno okno; wzorzec `requestId` jest tu kanoniczny.
 *
 * ── LIMIT CZASU: 1500 ms, ARMOWANY WARUNKOWO ────────────────────────────────
 * `window.dispatchEvent` woła nasłuchy SYNCHRONICZNIE, więc odbiornik, który
 * odpowiada od razu, rozstrzyga obietnicę jeszcze w środku `dispatch(ackId)`.
 * Dlatego:
 *   • odbiornik odpowiedział od razu → wynik natychmiast, zegar NIE POWSTAJE;
 *   • odbiornik zgłosił `deferAck(ackId)` (chce odpowiedzieć później) →
 *     arming zegara na 1500 ms; po tym czasie `no_receiver`;
 *   • NIKT nie odpowiedział i nikt nie zgłosił odroczenia → wiemy to
 *     NATYCHMIAST (synchronicznie) i zwracamy `no_receiver` BEZ CZEKANIA.
 *
 * Ten trzeci punkt jest istotny: gdyby zegar armował się bezwarunkowo, każda
 * z ~dziesiątek akcji szyny, których hook jeszcze nie potwierdza, czekałaby
 * 1500 ms zanim zwróci wynik. Ack NIE MOŻE spowalniać niezmigrowanych
 * ścieżek — inaczej „naprawa" byłaby regresją wydajności na całym module.
 *
 * Sam budżet 1500 ms: z zapasem ponad zacięcie wątku głównego rzędu kilku
 * klatek (16-100 ms), a na tyle krótko, że tura rozmowy z Teresą nie wisi
 * odczuwalnie. Limit kończy się WŁASNYM, ODRÓŻNIALNYM wynikiem
 * (`no_receiver`) — nigdy fałszywym `ok`, nigdy zawieszeniem.
 */

/** Zdarzenie odpowiedzi. Nadaje ODBIORNIK (hook narzędzia), nasłuchuje ten moduł. */
export const QUICK_ACTION_ACK_EVENT = 'idea-workspace-quick-action-ack';

/** Patrz „LIMIT CZASU" w nagłówku pliku. */
export const QUICK_ACTION_ACK_TIMEOUT_MS = 1500;

/**
 * Powody ODMOWY zwracane przez realny handler narzędzia. Każdy odpowiada
 * istniejącej ścieżce `return` w handlerach toru
 * (`useProcessFlowNodes.ts` / `IdeaProcessFlowTool.tsx`) — nic „na zapas".
 */
export type QuickActionRefusal =
  /** `locked` w handlerze — Idea otwarta w trybie tylko do odczytu. */
  | 'locked'
  /** `lanes.length <= 1` w `handleLaneDelete` — ostatni tor (toast G4-LANE-DELETE). */
  | 'last_lane'
  /** Wskazany obiekt (tor/ramka/węzeł) nie istnieje w bieżącym stanie. */
  | 'unknown_lane'
  /** `pf_lane_move_up` na torze, który już jest pierwszy. */
  | 'already_first'
  /** `pf_lane_move_down` na torze, który już jest ostatni. */
  | 'already_last'
  /** Brak wymaganego parametru operacji (`label` dla rename, `color` dla color). */
  | 'missing_param'
  /** Odbiornik jest, ale narzędzie nie wpięło tego konkretnego handlera. */
  | 'no_handler';

/** Wynik JEDNEJ operacji, zwracany przez handler narzędzia. */
export type QuickActionOutcome = { ok: true } | { ok: false; reason: QuickActionRefusal };

/** Alias czytelny w kodzie torów — ten sam typ, węższa nazwa domenowa. */
export type LaneOpOutcome = QuickActionOutcome;

/** Wynik oczekiwania po stronie rejestru (+ brak odbiornika/limit czasu). */
export type QuickActionAckOutcome =
  | { ok: true }
  | { ok: false; reason: QuickActionRefusal | 'no_receiver' };

const REFUSALS: readonly QuickActionRefusal[] = [
  'locked',
  'last_lane',
  'unknown_lane',
  'already_first',
  'already_last',
  'missing_param',
  'no_handler',
];

/** Type guard — chroni przed „potwierdzeniem" o nieznanym kształcie. */
export function isQuickActionOutcome(value: unknown): value is QuickActionOutcome {
  if (!value || typeof value !== 'object') return false;
  const v = value as { ok?: unknown; reason?: unknown };
  if (v.ok === true) return true;
  if (v.ok !== false) return false;
  return REFUSALS.includes(v.reason as QuickActionRefusal);
}

/** Alias, patrz `LaneOpOutcome`. */
export const isLaneOpOutcome = isQuickActionOutcome;

const pending = new Map<string, (outcome: QuickActionAckOutcome) => void>();
/** `ackId`, dla których odbiornik zapowiedział późniejszą odpowiedź. */
const deferred = new Set<string>();
let listening = false;

function onAckEvent(event: Event) {
  const detail = (event as CustomEvent).detail as
    | { ackId?: unknown; ok?: unknown; reason?: unknown }
    | undefined;
  const ackId = typeof detail?.ackId === 'string' ? detail.ackId : '';
  if (!ackId) return;
  const settle = pending.get(ackId);
  // Brak wpisu = potwierdzenie spóźnione (po limicie) albo zdublowane przez
  // drugi odbiornik. Ignorujemy — rozstrzygnięcie następuje DOKŁADNIE RAZ.
  if (!settle) return;
  pending.delete(ackId);
  deferred.delete(ackId);
  if (detail?.ok === true) {
    settle({ ok: true });
    return;
  }
  const reason = REFUSALS.includes(detail?.reason as QuickActionRefusal)
    ? (detail?.reason as QuickActionRefusal)
    : 'no_handler';
  settle({ ok: false, reason });
}

function ensureListener() {
  if (listening || typeof window === 'undefined') return;
  window.addEventListener(QUICK_ACTION_ACK_EVENT, onAckEvent as EventListener);
  listening = true;
}

let ackCounter = 0;
function newAckId(): string {
  ackCounter += 1;
  const rnd =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `qa-ack-${ackCounter}-${rnd}`;
}

/**
 * ODBIORNIK → REJESTR. Woła ją hook narzędzia po wykonaniu (lub odmowie)
 * operacji, przekazując `ackId` z detalu zdarzenia wejściowego. Bez `ackId`
 * nie robi NIC — wywołujący sprzed tej fali mają ścieżkę nietkniętą.
 */
export function emitQuickActionAck(
  ackId: string | undefined,
  outcome: QuickActionOutcome
): void {
  if (!ackId || typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(QUICK_ACTION_ACK_EVENT, {
      detail: {
        ackId,
        ok: outcome.ok,
        ...(outcome.ok ? {} : { reason: outcome.reason }),
      },
    })
  );
}

/** Alias domenowy dla torów. */
export const emitLaneAck = emitQuickActionAck;

/**
 * ODBIORNIK → REJESTR, faza wcześniejsza. Odbiornik, który NIE potrafi
 * odpowiedzieć synchronicznie, woła to podczas obsługi zdarzenia; dopiero
 * wtedy uzbrajamy limit czasu. Bez tego brak odpowiedzi jest wykrywany
 * natychmiast (patrz nagłówek pliku).
 */
export function deferQuickActionAck(ackId: string | undefined): void {
  if (ackId) deferred.add(ackId);
}

/**
 * REJESTR → ODBIORNIK. Rejestruje obietnicę pod nowym `ackId`, woła
 * `dispatch(ackId)` (który ma wysłać zdarzenie szyny z tym identyfikatorem)
 * i czeka na potwierdzenie zgodnie z regułą armowania z nagłówka pliku.
 */
export function awaitQuickActionAck(
  dispatch: (ackId: string) => void,
  timeoutMs: number = QUICK_ACTION_ACK_TIMEOUT_MS
): Promise<QuickActionAckOutcome> {
  ensureListener();
  const ackId = newAckId();
  let settled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let resolveOuter!: (outcome: QuickActionAckOutcome) => void;
  const promise = new Promise<QuickActionAckOutcome>((resolve) => {
    resolveOuter = resolve;
  });

  pending.set(ackId, (outcome) => {
    settled = true;
    if (timer) clearTimeout(timer);
    resolveOuter(outcome);
  });

  try {
    dispatch(ackId);
  } catch (err) {
    // Wyjątek po stronie odbiornika NIE MOŻE wyglądać jak sukces ani zawiesić
    // tury — sprzątamy wpis i zwracamy odmowę o tym samym kształcie.
    pending.delete(ackId);
    deferred.delete(ackId);
    if (!settled) resolveOuter({ ok: false, reason: 'no_receiver' });
    return promise;
  }

  if (!settled) {
    if (deferred.has(ackId)) {
      timer = setTimeout(() => {
        pending.delete(ackId);
        deferred.delete(ackId);
        resolveOuter({ ok: false, reason: 'no_receiver' });
      }, timeoutMs);
    } else {
      // Nikt nie odpowiedział i nikt nie zapowiedział odpowiedzi — wiemy to
      // JUŻ TERAZ, bo nasłuchy szyny są synchroniczne. Zero czekania.
      pending.delete(ackId);
      resolveOuter({ ok: false, reason: 'no_receiver' });
    }
  }
  return promise;
}

/** Alias domenowy dla torów. */
export const awaitLaneAck = awaitQuickActionAck;

/** Tylko dla testów: ile obietnic czeka (wykrywa wycieki rejestru). */
export function pendingQuickActionAckCount(): number {
  return pending.size;
}
