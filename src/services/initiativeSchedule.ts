/**
 * Initiative schedule builder (M13 Depth · Seria R · R1).
 *
 * Pure transform from already-loaded document data (tasks + milestones +
 * timeline phases) into the normalized `ScheduleItem[]` consumed by the
 * Calendar (M13c) and the task-level Gantt (V1). Single source → no drift.
 * Tolerant of field-name variance across the codebase (tasks use `dueDate`,
 * milestones `milestoneDate`, phases `start`/`end`).
 */
import type { ScheduleItem, ScheduleSource } from '@/types/initiativeSchedule';

/** Coerce any date-ish value to an ISO `yyyy-mm-dd`, or null. */
export function toIsoDate(v: unknown): string | null {
  if (v == null || v === '') return null;
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function pick(o: any, keys: string[]): unknown {
  for (const k of keys) {
    const val = o?.[k];
    if (val != null && val !== '') return val;
  }
  return null;
}

export function buildScheduleItems(source: ScheduleSource): ScheduleItem[] {
  const items: ScheduleItem[] = [];

  for (const t of source.tasks ?? []) {
    const sid = t?.id != null ? String(t.id) : '';
    if (!sid) continue;
    const start = toIsoDate(pick(t, ['startDate', 'start', 'dueDate', 'due_date']));
    const end = toIsoDate(pick(t, ['endDate', 'end', 'dueDate', 'due_date'])) ?? start;
    items.push({
      id: `task:${sid}`,
      type: 'task',
      title: String(pick(t, ['title', 'name']) ?? 'Task'),
      start,
      end,
      status: (t?.status as string) ?? null,
      sourceId: sid,
      sourceKind: 'task',
    });
  }

  for (const m of source.milestones ?? []) {
    const sid = m?.id != null ? String(m.id) : '';
    if (!sid) continue;
    const date = toIsoDate(pick(m, ['milestoneDate', 'date', 'targetDate', 'dueDate']));
    items.push({
      id: `milestone:${sid}`,
      type: 'milestone',
      title: String(pick(m, ['title', 'name', 'label']) ?? 'Milestone'),
      start: date,
      end: date, // point milestone: start === end
      status: (m?.status as string) ?? null,
      sourceId: sid,
      sourceKind: 'milestone',
    });
  }

  for (const p of source.timeline ?? []) {
    const sid = p?.id != null ? String(p.id) : '';
    if (!sid) continue;
    const start = toIsoDate(pick(p, ['startDate', 'start']));
    const end = toIsoDate(pick(p, ['endDate', 'end'])) ?? start;
    items.push({
      id: `phase:${sid}`,
      type: 'phase',
      title: String(pick(p, ['title', 'name', 'label']) ?? 'Phase'),
      start,
      end,
      status: (p?.status as string) ?? null,
      sourceId: sid,
      sourceKind: 'phase',
    });
  }

  return items;
}
