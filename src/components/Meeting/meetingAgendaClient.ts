/**
 * MTG-1 rework etap 1 / DEC-596 — odczyt agendy spotkania z trwałej tabeli
 * `meeting_agenda_items` (migracja 20262301) dla karty spotkania.
 *
 * `src/services/api.ts` nie jest plikiem tego zlecenia, więc klient żyje przy
 * karcie i woła `GET /api/meeting/:id/agenda` bezpośrednio — ten sam wzorzec
 * co surowy `fetch` w `MeetingObjectPage` (tworzenie zadania z działania).
 * Błąd niesie `.status`, żeby karta rozróżniła 403/404 (brak dostępu) od
 * awarii, identycznie jak `handleResponse` w api.ts.
 */

export type MeetingAgendaPurpose = 'information' | 'discussion' | 'decision';

export interface MeetingAgendaItemDto {
  id: string;
  organizationId: string;
  meetingId: string;
  position: number;
  title: string;
  durationMinutes: number;
  purpose: MeetingAgendaPurpose;
  leadUserId: string | null;
  preRead: string[];
  initiativeId: string | null;
  decisionId: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingAgendaApiError extends Error {
  status?: number;
}

export const MEETING_AGENDA_PURPOSE_LABEL_KEY: Record<MeetingAgendaPurpose, string> = {
  information: 'meeting.agendaAxis.purposeInformation',
  discussion: 'meeting.agendaAxis.purposeDiscussion',
  decision: 'meeting.agendaAxis.purposeDecision',
};

/** Drabina semantyczna celu punktu: informacja neutralna, dyskusja = info,
 *  decyzja = warning (punkt wymaga rozstrzygnięcia). Zero karmazynu. */
export const MEETING_AGENDA_PURPOSE_TONE: Record<
  MeetingAgendaPurpose,
  'neutral' | 'info' | 'warning'
> = {
  information: 'neutral',
  discussion: 'info',
  decision: 'warning',
};

export function isMeetingAgendaPurpose(value: unknown): value is MeetingAgendaPurpose {
  return value === 'information' || value === 'discussion' || value === 'decision';
}

export async function fetchMeetingAgendaItems(
  meetingId: string
): Promise<MeetingAgendaItemDto[]> {
  const response = await fetch(`/api/meeting/${encodeURIComponent(meetingId)}/agenda`, {
    credentials: 'include',
  });
  if (!response.ok) {
    const error: MeetingAgendaApiError = new Error(`HTTP_${response.status}`);
    error.status = response.status;
    throw error;
  }
  const payload = (await response.json()) as { agendaItems?: unknown };
  const rows = Array.isArray(payload?.agendaItems) ? payload.agendaItems : [];
  return (rows as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id || ''),
    organizationId: String(row.organizationId || ''),
    meetingId: String(row.meetingId || ''),
    position: Number(row.position || 0),
    title: String(row.title || ''),
    durationMinutes: Number(row.durationMinutes || 0),
    purpose: isMeetingAgendaPurpose(row.purpose) ? row.purpose : 'information',
    leadUserId: row.leadUserId ? String(row.leadUserId) : null,
    preRead: Array.isArray(row.preRead) ? row.preRead.map((item) => String(item)) : [],
    initiativeId: row.initiativeId ? String(row.initiativeId) : null,
    decisionId: row.decisionId ? String(row.decisionId) : null,
    notes: typeof row.notes === 'string' ? row.notes : '',
    createdAt: String(row.createdAt || ''),
    updatedAt: String(row.updatedAt || ''),
  }));
}

/**
 * Godzina startu punktu = start spotkania + suma czasów wcześniejszych punktów
 * (kolejność serwera: `position ASC, id ASC`) — dokładnie reguła z makiety
 * mtg-rework-20260917. Zły/brak startu spotkania = `null`, nigdy wymyślona
 * godzina.
 */
export function agendaItemStartAt(
  meetingStartAt: string,
  orderedItems: MeetingAgendaItemDto[],
  index: number
): Date | null {
  const start = new Date(meetingStartAt).getTime();
  if (!Number.isFinite(start)) return null;
  const offsetMinutes = orderedItems
    .slice(0, index)
    .reduce((total, item) => total + (Number(item.durationMinutes) || 0), 0);
  return new Date(start + offsetMinutes * 60_000);
}

export function formatAgendaTime(date: Date, isPolish: boolean): string {
  return date.toLocaleTimeString(isPolish ? 'pl-PL' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Zmiana stanu cyklu życia spotkania — `PATCH /api/meeting/:id/lifecycle`
 * z ciałem `{ nextState }` (kontrakt serwera: `meeting.routes.ts:1501`).
 * Serwer zwraca 200 `{ lifecycleState }`, 400 (nieznany stan) albo 409
 * (niedozwolone przejście). Błąd niesie `.status`, żeby karta odróżniła 409
 * „to przejście jest niedozwolone" od awarii sieci i nie odświeżała stanu
 * po odrzuceniu — SSOT pozostaje serwer, front nigdy nie zgaduje przejścia.
 */
export async function patchMeetingLifecycle(
  meetingId: string,
  nextState: string
): Promise<string> {
  const response = await fetch(`/api/meeting/${encodeURIComponent(meetingId)}/lifecycle`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nextState }),
  });
  if (!response.ok) {
    const error: MeetingAgendaApiError = new Error(`HTTP_${response.status}`);
    error.status = response.status;
    throw error;
  }
  const payload = (await response.json()) as { lifecycleState?: unknown };
  return typeof payload?.lifecycleState === 'string' ? payload.lifecycleState : nextState;
}
