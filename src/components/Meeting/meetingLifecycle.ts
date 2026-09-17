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
