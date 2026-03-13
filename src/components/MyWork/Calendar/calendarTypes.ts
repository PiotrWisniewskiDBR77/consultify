export type CalendarEventSource = 'task' | 'initiative' | 'decision' | 'google' | 'outlook';

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
  task: '#3b82f6',
  initiative: '#8b5cf6',
  decision: '#f59e0b',
  google: '#10b981',
  outlook: '#6366f1',
};

export const SOURCE_LABELS: Record<CalendarEventSource, { en: string; pl: string }> = {
  task: { en: 'Tasks', pl: 'Zadania' },
  initiative: { en: 'Initiatives', pl: 'Inicjatywy' },
  decision: { en: 'Decisions', pl: 'Decyzje' },
  google: { en: 'Google Calendar', pl: 'Google Calendar' },
  outlook: { en: 'Outlook', pl: 'Outlook' },
};
