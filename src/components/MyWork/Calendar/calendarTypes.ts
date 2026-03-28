export type CalendarEventSource =
  | 'task'
  | 'initiative'
  | 'decision'
  | 'google'
  | 'outlook'
  | 'consultify';

export type CalendarViewMode = 'month' | 'week' | 'day' | 'list';

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
}

export interface CalendarFilter {
  sources: CalendarEventSource[];
  projectId?: string;
}

export const SOURCE_COLORS: Record<CalendarEventSource, string> = {
  task: '#2563eb',
  initiative: '#7c3aed',
  decision: '#d97706',
  google: '#059669',
  outlook: '#4f46e5',
  consultify: '#6d28d9',
};

export const SOURCE_LABELS: Record<CalendarEventSource, { en: string; pl: string }> = {
  task: { en: 'Tasks', pl: 'Zadania' },
  initiative: { en: 'Initiatives', pl: 'Inicjatywy' },
  decision: { en: 'Decisions', pl: 'Decyzje' },
  google: { en: 'Google Calendar', pl: 'Google Calendar' },
  outlook: { en: 'Outlook', pl: 'Outlook' },
  consultify: { en: 'Consultify', pl: 'Consultify' },
};
