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

/**
 * Critical path = the longest-duration chain through the dependency DAG.
 * Returns the ScheduleItem.ids on that chain (empty when no edges).
 * Defensive against cycles; durations are inclusive day counts (min 1).
 */
export function computeCriticalPath(
  items: ScheduleItem[],
  edges: Array<{ fromId: string; toId: string }>
): string[] {
  if (!items.length || !edges.length) return [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const DAY = 24 * 60 * 60 * 1000;
  const dur = (id: string): number => {
    const it = byId.get(id);
    if (!it || !it.start) return 1;
    const s = new Date(it.start).getTime();
    const e = new Date(it.end || it.start).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) return 1;
    return Math.max(1, Math.round((e - s) / DAY) + 1);
  };
  const preds = new Map<string, string[]>();
  const nodes = new Set<string>();
  for (const e of edges) {
    if (!byId.has(e.fromId) || !byId.has(e.toId)) continue;
    nodes.add(e.fromId);
    nodes.add(e.toId);
    if (!preds.has(e.toId)) preds.set(e.toId, []);
    preds.get(e.toId)!.push(e.fromId);
  }
  if (nodes.size === 0) return [];
  const memo = new Map<string, { len: number; chain: string[] }>();
  const visiting = new Set<string>();
  const longestTo = (id: string): { len: number; chain: string[] } => {
    const cached = memo.get(id);
    if (cached) return cached;
    if (visiting.has(id)) return { len: dur(id), chain: [id] }; // cycle guard
    visiting.add(id);
    let best = { len: dur(id), chain: [id] };
    for (const p of preds.get(id) || []) {
      const sub = longestTo(p);
      if (sub.len + dur(id) > best.len) {
        best = { len: sub.len + dur(id), chain: [...sub.chain, id] };
      }
    }
    visiting.delete(id);
    memo.set(id, best);
    return best;
  };
  let overall = { len: 0, chain: [] as string[] };
  for (const id of nodes) {
    const r = longestTo(id);
    if (r.len > overall.len) overall = r;
  }
  return overall.chain;
}
