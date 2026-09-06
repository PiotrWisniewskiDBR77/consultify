/**
 * R3 — BASELINE HARMONOGRAMU I REGUŁA RE-BASELINE.
 *
 * Plan: `docs/program/PROGRAM_NAPRAWCZY_20260905/1_12_REALIZACJA_PLAN.md` §C4/R3
 * oraz odpowiedź właściciela na pytanie C5.3: „pierwsze przesunięcie swobodne,
 * kolejne przez decyzję".
 *
 * DLACZEGO TO JEST W WARSTWIE SERWERA, A NIE W INTERFEJSIE
 * --------------------------------------------------------
 * Zabezpieczenie, które da się obejść wywołaniem `PUT /api/initiatives/:id`
 * z konsoli, nie jest zabezpieczeniem — a cała wartość baseline'u polega na
 * tym, że terminu NIE DA SIĘ po cichu dopasować do rzeczywistości. Dlatego
 * decyzja o dopuszczeniu przesunięcia zapada tutaj, a kontroler tylko wykonuje
 * werdykt (i zapisuje ślad w `initiative_rebaseline_log`).
 *
 * Moduł jest CZYSTY (zero SQL, zero req/res), żeby regułę dało się przetestować
 * bez bazy i bez HTTP.
 */

export const DAY_MS = 86_400_000;

/** Kod odmowy — jawny, stabilny, testowalny. Nie zmieniać bez decyzji. */
export const REBASELINE_DECISION_REQUIRED = 'REBASELINE_DECISION_REQUIRED';
/** Decyzja podana, ale bez zatwierdzającego = brak decyzji. */
export const REBASELINE_APPROVER_REQUIRED = 'REBASELINE_APPROVER_REQUIRED';

export interface RebaselineDecisionInput {
  /** Identyfikator decyzji (rekord w `decisions`) — opcjonalny, ale zalecany. */
  decisionId?: string | null;
  /** KTO zatwierdził. Bez tego decyzja nie istnieje. */
  approvedBy?: string | null;
  reason?: string | null;
  /**
   * `true` = zamrażamy NOWĄ datę jako baseline (odchylenie wraca do zera,
   * ale zostaje ślad w logu i rośnie `baseline_version`).
   * `false`/brak = data się przesuwa, baseline zostaje — odchylenie rośnie.
   */
  resetBaseline?: boolean;
}

export type ScheduleShiftVerdict =
  | { allowed: true; shiftIndex: number; requiresDecision: boolean }
  | { allowed: false; status: number; code: string; error: string; shiftIndex: number };

/**
 * Czy wolno przesunąć zamrożoną datę.
 *
 * @param currentShiftCount liczba przesunięć DOTYCHCZAS wykonanych (0 = plan
 *        jeszcze nie ruszony od zamrożenia baseline'u)
 * @param decision treść decyzji podana w żądaniu (albo jej brak)
 */
export function evaluateScheduleShift(
  currentShiftCount: number,
  decision?: RebaselineDecisionInput | null
): ScheduleShiftVerdict {
  const done = Number.isFinite(currentShiftCount) ? Math.max(0, Math.trunc(currentShiftCount)) : 0;
  const shiftIndex = done + 1;
  // Pierwsze przesunięcie — wolno wprost (odpowiedź właściciela, C5.3).
  if (done === 0) return { allowed: true, shiftIndex, requiresDecision: false };

  const approver = String(decision?.approvedBy ?? '').trim();
  const hasDecisionEnvelope =
    decision != null && (decision.decisionId != null || decision.approvedBy != null);

  if (!hasDecisionEnvelope) {
    return {
      allowed: false,
      status: 409,
      code: REBASELINE_DECISION_REQUIRED,
      error:
        'Second and further schedule shifts require a re-baseline decision with a named approver.',
      shiftIndex,
    };
  }
  if (!approver) {
    return {
      allowed: false,
      status: 409,
      code: REBASELINE_APPROVER_REQUIRED,
      error: 'Re-baseline decision must name the approver (approvedBy).',
      shiftIndex,
    };
  }
  return { allowed: true, shiftIndex, requiresDecision: true };
}

const toTime = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
};

/** Czy dwie daty (ISO albo `Date`) oznaczają ten sam dzień kalendarzowy. */
export function isSameScheduledDay(a: unknown, b: unknown): boolean {
  const ta = toTime(a);
  const tb = toTime(b);
  if (ta == null && tb == null) return true;
  if (ta == null || tb == null) return false;
  return new Date(ta).toISOString().slice(0, 10) === new Date(tb).toISOString().slice(0, 10);
}

export interface DeviationInput {
  /** Data planowana ZAMROŻONA. Brak = nie ma od czego liczyć. */
  baselineDate: unknown;
  /** Data planowana AKTUALNA (dzisiejsza prognoza). */
  currentDate: unknown;
  /** FAKT — data faktycznego zamknięcia, jeśli już nastąpiło. */
  actualDate?: unknown;
  now?: number;
}

/**
 * ODCHYLENIE W DNIACH OD BASELINE'U (dodatnie = później niż zobowiązanie).
 *
 * Reguła, świadomie w tej kolejności:
 *   1. jest FAKT  → odchylenie = fakt − baseline (sprawa zamknięta, nie rośnie);
 *   2. nie ma faktu → punktem odniesienia jest PÓŹNIEJSZA z dwóch dat:
 *      aktualny plan i DZIŚ. Bez `max(…, dziś)` termin, który minął, a rzecz
 *      nie jest zrobiona, pokazywałby zamrożone odchylenie z dnia terminu —
 *      opóźnienie przestałoby rosnąć dokładnie wtedy, kiedy zaczyna boleć;
 *   3. brak baseline'u → `null` („—"), nigdy zero. Zero znaczy „zgodnie
 *      z zobowiązaniem" i nie wolno go zmyślać z braku danych.
 */
export function deviationDaysFromBaseline(input: DeviationInput): number | null {
  const baseline = toTime(input.baselineDate);
  if (baseline == null) return null;
  const actual = toTime(input.actualDate);
  if (actual != null) return Math.round((actual - baseline) / DAY_MS);
  const now = input.now ?? Date.now();
  const current = toTime(input.currentDate);
  const reference = current == null ? now : Math.max(current, now);
  return Math.round((reference - baseline) / DAY_MS);
}
