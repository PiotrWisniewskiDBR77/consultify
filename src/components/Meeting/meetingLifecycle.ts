/**
 * DEC-596 / MTG-1 rework — pięć stanów cyklu życia spotkania (Menu 3 listy i
 * nagłówek karty). Źródłem prawdy jest `meetings.lifecycle_state` z migracji
 * 20262301. `resolveMeetingLifecycleState` odtwarza regułę backfillu tej
 * migracji, gdy API nie zwróci stanu (środowisko sprzed migracji): status
 * `completed` = `closed`, każdy inny = `scheduled` — lista nigdy nie renderuje
 * stanu spoza zbioru.
 */

export const MEETING_LIFECYCLE_STATES = [
  'scheduled',
  'in_progress',
  'minutes_to_approve',
  'needs_actions',
  'closed',
] as const;

export type MeetingLifecycleStateValue = (typeof MEETING_LIFECYCLE_STATES)[number];

export const MEETING_LIFECYCLE_LABEL_KEY: Record<MeetingLifecycleStateValue, string> = {
  scheduled: 'meeting.lifecycle.scheduled',
  in_progress: 'meeting.lifecycle.inProgress',
  minutes_to_approve: 'meeting.lifecycle.minutesToApprove',
  needs_actions: 'meeting.lifecycle.needsActions',
  closed: 'meeting.lifecycle.closed',
};

/** Zwarte etykiety stanów dla wąskiej kolumny Status listy: columnFit fasady
 *  dociska kolumnę do podłogi typu `status` (160 px), więc pełne brzmienia
 *  („Protokół do akceptacji") nie mieszczą się w pigułce. Menu 3, podgląd
 *  i karta zostają przy pełnych etykietach. */
export const MEETING_LIFECYCLE_SHORT_LABEL_KEY: Record<MeetingLifecycleStateValue, string> = {
  scheduled: 'meeting.lifecycle.short.scheduled',
  in_progress: 'meeting.lifecycle.short.inProgress',
  minutes_to_approve: 'meeting.lifecycle.short.minutesToApprove',
  needs_actions: 'meeting.lifecycle.short.needsActions',
  closed: 'meeting.lifecycle.short.closed',
};

/**
 * Kropki Menu 3 — wyłącznie tokeny semantyczne w kolejności makiety
 * (draft/review/warn/ok). Karmazynowy token marki jest zarezerwowany dla
 * brandu i semantyki krytycznej, więc celowo nie występuje w tej palecie.
 */
export const MEETING_LIFECYCLE_DOT_CLASS: Record<MeetingLifecycleStateValue, string> = {
  scheduled: 'bg-slate-400 dark:bg-slate-500',
  in_progress: 'bg-[var(--c-info)]',
  minutes_to_approve: 'bg-[var(--c-warning)]',
  needs_actions: 'bg-[var(--c-danger)]',
  closed: 'bg-[var(--c-success)]',
};

/**
 * Kropka chipa „All" — kolorowa połowa kanonicznego `MENU_3_ALL_DOT_CLASS`
 * (geometrię `h-1.5 w-1.5 rounded-full` dokłada sam renderer chipów fasady).
 */
export const MEETING_LIFECYCLE_ALL_DOT_CLASS = 'bg-slate-400 dark:bg-slate-500';

/** StatusChip w karcie (wiersz „Status" we Właściwościach) — te same pięć
 *  semantyk co kropki Menu 3, żeby lista i karta mówiły jednym kolorem. */
export const MEETING_LIFECYCLE_CHIP_TONE: Record<
  MeetingLifecycleStateValue,
  'success' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  scheduled: 'neutral',
  in_progress: 'info',
  minutes_to_approve: 'warning',
  needs_actions: 'danger',
  closed: 'success',
};

/** Pigułka statusu w Menu 1 powłoki artefaktu (zbiór tonów `NModeHeader`). */
export const MEETING_LIFECYCLE_PILL_TONE: Record<
  MeetingLifecycleStateValue,
  'draft' | 'review' | 'approved' | 'rejected' | 'neutral'
> = {
  scheduled: 'draft',
  in_progress: 'review',
  minutes_to_approve: 'review',
  needs_actions: 'review',
  closed: 'approved',
};

export function isMeetingLifecycleStateValue(value: unknown): value is MeetingLifecycleStateValue {
  return (
    typeof value === 'string' &&
    (MEETING_LIFECYCLE_STATES as readonly string[]).includes(value)
  );
}

export function resolveMeetingLifecycleState(meeting: {
  lifecycleState?: unknown;
  status?: unknown;
}): MeetingLifecycleStateValue {
  if (isMeetingLifecycleStateValue(meeting.lifecycleState)) return meeting.lifecycleState;
  return meeting.status === 'completed' ? 'closed' : 'scheduled';
}

/**
 * Dozwolone przejścia cyklu życia — LUSTRO serwera
 * (`server/src/services/meeting/meetingAgendaService.ts`
 * `MEETING_LIFECYCLE_TRANSITIONS`). Karta rysuje z niego przyciski „przejdź do"
 * w panelu Akcje, ale to serwer jest źródłem prawdy: `PATCH /:id/lifecycle`
 * i tak odrzuci niedozwolone przejście (409), więc frontowa mapa tylko NIE
 * POKAZUJE przejść, których backend nie przyjmie — nigdy nie decyduje sama.
 * `closed` jest terminalny (brak przycisków).
 */
export const MEETING_LIFECYCLE_TRANSITIONS: Readonly<
  Record<MeetingLifecycleStateValue, readonly MeetingLifecycleStateValue[]>
> = Object.freeze({
  scheduled: Object.freeze(['in_progress'] as const),
  in_progress: Object.freeze(['minutes_to_approve'] as const),
  minutes_to_approve: Object.freeze(['needs_actions', 'closed'] as const),
  needs_actions: Object.freeze(['closed'] as const),
  closed: Object.freeze([] as const),
});

export function meetingLifecycleNextStates(
  state: MeetingLifecycleStateValue
): readonly MeetingLifecycleStateValue[] {
  return MEETING_LIFECYCLE_TRANSITIONS[state] ?? [];
}
