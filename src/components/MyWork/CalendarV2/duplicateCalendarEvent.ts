import Api from '@/services/api';

export interface DuplicateEventInput {
  title: string;
  startAt: string;
  endAt: string;
  description?: string;
  location?: string;
  visibility?: 'private' | 'busy' | 'org';
  attendees?: string[];
}

export interface DuplicateEventResult {
  requestedDates: string[];
  created: Array<{ date: string; event: unknown }>;
  failed: Array<{ date: string; reason: string }>;
}

const shiftWeeks = (iso: string, weeks: number) => {
  const date = new Date(iso);
  date.setUTCDate(date.getUTCDate() + weeks * 7);
  return date.toISOString();
};

/** Creates four independent records; recurrence fields are intentionally absent. */
export async function duplicateCalendarEventFourWeeks(
  input: DuplicateEventInput
): Promise<DuplicateEventResult> {
  const requestedDates = [1, 2, 3, 4].map((week) => shiftWeeks(input.startAt, week));
  const result: DuplicateEventResult = { requestedDates, created: [], failed: [] };
  for (const [index, startAt] of requestedDates.entries()) {
    const endAt = shiftWeeks(input.endAt, index + 1);
    try {
      const event = await Api.createMyWorkCalendarEvent({
        ...input,
        startAt,
        endAt,
        source: 'event',
        allDay: false,
      });
      result.created.push({ date: startAt, event });
    } catch (cause) {
      result.failed.push({
        date: startAt,
        reason: cause instanceof Error ? cause.message : 'Unknown error',
      });
    }
  }
  return result;
}
