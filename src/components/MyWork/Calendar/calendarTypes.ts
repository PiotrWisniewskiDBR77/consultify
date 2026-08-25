export type CalendarEventSource =
  | 'event'
  | 'task'
  | 'initiative'
  | 'decision'
  | 'google'
  | 'outlook'
  | 'consultify';

export type CalendarViewMode = 'month' | 'week' | 'day' | 'list';

export type VisibilityClass = 'free_busy_only' | 'details';
export type EditAuthority = 'none' | 'local_only' | 'remote_owner' | 'delegate';
export type SyncState = 'in_sync' | 'pending' | 'conflict' | 'blocked' | 'stale';
export type PermissionGradient = 'free_busy' | 'read' | 'write' | 'delegate';
export type SourceLifecycleState =
  | 'connected'
  | 'degraded'
  | 'requires_action'
  | 'blocked'
  | 'recoverable';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  source: CalendarEventSource;
  sourceId?: string;
  color?: string;
  description?: string;
  status?: string;
  priority?: string;
  visibilityClass?: VisibilityClass;
  editAuthority?: EditAuthority;
  syncState?: SyncState;
  permissionGradient?: PermissionGradient;
  etag?: string;
  recurrenceRule?: string;
  recurrenceSourceId?: string;
  projectId?: string | null;
  projectName?: string | null;
  provider?: 'internal' | 'google' | 'microsoft';
  version?: string;
}

export interface CalendarFilter {
  sources: CalendarEventSource[];
  projectId?: string;
  ownership?: 'any' | 'assignee' | 'owner';
}

export const PERMISSION_UI_RULES: Record<
  PermissionGradient,
  { canSeeDetails: boolean; canEdit: boolean; label: string }
> = {
  free_busy: { canSeeDetails: false, canEdit: false, label: 'Free/busy blocks only — no details' },
  read: { canSeeDetails: true, canEdit: false, label: 'Details visible — editing disabled' },
  write: { canSeeDetails: true, canEdit: true, label: 'Edit allowed for owned items only' },
  delegate: {
    canSeeDetails: true,
    canEdit: true,
    label: 'Delegate — "on behalf of" context shown',
  },
};

export const LIFECYCLE_LABELS: Record<
  SourceLifecycleState,
  { label: string; variant: 'success' | 'warning' | 'error' | 'info' }
> = {
  connected: { label: 'Connected', variant: 'success' },
  degraded: { label: 'Degraded', variant: 'warning' },
  requires_action: { label: 'Requires Action', variant: 'error' },
  blocked: { label: 'Blocked', variant: 'error' },
  recoverable: { label: 'Recovering', variant: 'info' },
};

export const LIFECYCLE_RECOVERY: Record<SourceLifecycleState, string> = {
  connected: '',
  degraded: 'Sync may be slow. The system will retry automatically.',
  requires_action: 'Action needed: reconnect or re-authorize this calendar in Integrations.',
  blocked: 'This source is blocked. Contact your administrator.',
  recoverable: 'Auto-recovery in progress. Data may be stale until sync completes.',
};

export const SOURCE_COLORS: Record<CalendarEventSource, string> = {
  event: '#475569',
  task: '#2563eb',
  initiative: '#A51C30',
  decision: '#d97706',
  google: '#059669',
  outlook: '#5566b8',
  consultify: '#D42B3D',
};

export const SOURCE_LABELS: Record<CalendarEventSource, { en: string; pl: string }> = {
  event: { en: 'Own events', pl: 'Wydarzenia własne' },
  task: { en: 'Tasks', pl: 'Zadania' },
  initiative: { en: 'Initiatives', pl: 'Inicjatywy' },
  decision: { en: 'Decisions', pl: 'Decyzje' },
  google: { en: 'Google Calendar', pl: 'Google Calendar' },
  outlook: { en: 'Outlook', pl: 'Outlook' },
  consultify: { en: 'Consultify', pl: 'Consultify' },
};
