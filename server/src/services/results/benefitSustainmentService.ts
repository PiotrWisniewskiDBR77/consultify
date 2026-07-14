/**
 * benefitSustainmentService — M15/W5 (5.7 + 5.8)
 *
 * Czyste funkcje domenowe do utrzymania korzyści (benefit sustainment):
 *  - harmonogram przeglądów wg kadencji (cadence review),
 *  - status utrzymania korzyści (governance / ownership),
 *  - kalendarz governance dla zbioru korzyści.
 *
 * UWAGA: serwis NIE używa argless `new Date()` ani `Date.now()`.
 * Czas „teraz” jest zawsze przekazywany jawnie jako `nowMs` (deterministyczne testy).
 */

export type SustainmentCadence = 'weekly' | 'monthly' | 'quarterly';

export type SustainmentStatus = 'sustained' | 'at-risk' | 'unowned' | 'overdue-review';

export interface SustainmentInput {
  ownershipTransferred?: boolean;
  lastReviewIso?: string | null;
  cadence?: string;
  realizationPct?: number;
}

export interface SustainmentResult {
  status: SustainmentStatus;
  reasons: string[];
}

export interface GovernanceCalendarItem {
  id: string;
  name?: string;
  cadence?: string;
  lastReviewIso?: string | null;
}

export interface GovernanceCalendarEntry {
  id: string;
  name?: string;
  nextReviewIso: string;
  due: boolean;
}

const AT_RISK_REALIZATION_THRESHOLD = 0.6;

/** Liczba dni w okresie danej kadencji. Nieznana kadencja → traktowana jak miesięczna. */
function cadenceDays(cadence: string | undefined | null): number {
  switch ((cadence ?? '').toLowerCase()) {
    case 'weekly':
      return 7;
    case 'quarterly':
      return 91; // 13 tygodni
    case 'monthly':
    default:
      return 30;
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Następna data przeglądu (ISO) liczona od ostatniego przeglądu + okres kadencji.
 * Gdy brak ostatniego przeglądu (`lastReviewIso == null`), bazą jest `nowMs`
 * (przegląd należy zaplanować od teraz).
 */
export function nextReviewDate(
  cadence: string,
  lastReviewIso: string | null,
  nowMs: number
): string {
  const baseMs = lastReviewIso ? Date.parse(lastReviewIso) : nowMs;
  const safeBaseMs = Number.isFinite(baseMs) ? baseMs : nowMs;
  const nextMs = safeBaseMs + cadenceDays(cadence) * DAY_MS;
  return new Date(nextMs).toISOString();
}

/**
 * Czy przegląd jest należny (przeterminowany lub dokładnie teraz).
 * Gdy nigdy nie przeprowadzono przeglądu → należny (true).
 */
export function reviewDue(cadence: string, lastReviewIso: string | null, nowMs: number): boolean {
  if (!lastReviewIso) return true;
  const nextMs = Date.parse(nextReviewDate(cadence, lastReviewIso, nowMs));
  return nowMs >= nextMs;
}

/**
 * Status utrzymania korzyści.
 * Priorytet reguł:
 *  1. brak transferu własności           → 'unowned'
 *  2. przegląd przeterminowany            → 'overdue-review'
 *  3. realizacja < 60%                    → 'at-risk'
 *  4. w innym wypadku                     → 'sustained'
 * Reasons gromadzą wszystkie wykryte sygnały (nie tylko zwycięski).
 */
export function sustainmentStatus(input: SustainmentInput, nowMs: number): SustainmentResult {
  const reasons: string[] = [];

  const unowned = input.ownershipTransferred !== true;
  if (unowned) {
    reasons.push('ownership-not-transferred');
  }

  const overdue = reviewDue(input.cadence ?? 'monthly', input.lastReviewIso ?? null, nowMs);
  if (overdue) {
    reasons.push('review-overdue');
  }

  const atRisk =
    typeof input.realizationPct === 'number' &&
    input.realizationPct < AT_RISK_REALIZATION_THRESHOLD;
  if (atRisk) {
    reasons.push('realization-below-threshold');
  }

  let status: SustainmentStatus;
  if (unowned) {
    status = 'unowned';
  } else if (overdue) {
    status = 'overdue-review';
  } else if (atRisk) {
    status = 'at-risk';
  } else {
    status = 'sustained';
    reasons.push('on-track');
  }

  return { status, reasons };
}

/**
 * Kalendarz governance — dla każdej korzyści wylicza najbliższy przegląd
 * i flagę `due`. Wynik posortowany po `nextReviewIso` rosnąco
 * (najpilniejsze przeglądy na górze). Sortowanie stabilne po `id` przy remisie.
 */
export function buildGovernanceCalendar(
  items: Array<GovernanceCalendarItem>,
  nowMs: number
): Array<GovernanceCalendarEntry> {
  return items
    .map((item) => {
      const cadence = item.cadence ?? 'monthly';
      const lastReviewIso = item.lastReviewIso ?? null;
      const entry: GovernanceCalendarEntry = {
        id: item.id,
        nextReviewIso: nextReviewDate(cadence, lastReviewIso, nowMs),
        due: reviewDue(cadence, lastReviewIso, nowMs),
      };
      if (item.name !== undefined) {
        entry.name = item.name;
      }
      return entry;
    })
    .sort((a, b) => {
      const byDate = Date.parse(a.nextReviewIso) - Date.parse(b.nextReviewIso);
      if (byDate !== 0) return byDate;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}
