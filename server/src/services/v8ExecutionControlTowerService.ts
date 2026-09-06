/**
 * V8 execution control tower — canonical five-queue read model + drill-down
 * (P03-B). Delegates delay heuristics to delayDetectionService; adds blocked,
 * overloaded, stale from org-scoped execution graph.
 */

import { all as dbAll } from '../utils/DbPromise.js';
import { type DelaySignal, detectDelaySignals } from './delayDetectionService.js';
import {
  getOverloadAlerts,
  type OverloadAlert,
  type OverloadWindow,
} from './workloadCapacityService.js';

export const V8_EXECUTION_CONTROL_TOWER_CONTRACT = 'execution_control_tower_v1';

const STALE_DAYS = 14;
const MS_DAY = 86400000;

export type ControlTowerQueue = 'late' | 'at_risk' | 'blocked' | 'overloaded' | 'stale';

export interface ControlTowerWhy {
  kind: 'dependency' | 'workload' | 'baseline_forecast' | 'estimate' | 'stale' | 'status' | 'delay';
  detail: string;
}

export interface ControlTowerWhatNext {
  action: 'reassign' | 'smooth' | 'replan' | 'escalate';
  detail: string;
  readbackHint: string;
}

export interface ControlTowerAffectsNext {
  entityType: 'INITIATIVE' | 'TASK';
  entityId: string;
  label: string;
}

export interface ControlTowerItem {
  entityType: 'INITIATIVE' | 'TASK';
  entityId: string;
  name: string;
  initiativeId?: string | null;
  projectId?: string | null;
  severity?: 'critical' | 'warning';
  why: ControlTowerWhy[];
  whatNext: ControlTowerWhatNext[];
  affectsNext: ControlTowerAffectsNext[];
}

export interface ControlTowerQueuesResult {
  generatedAt: string;
  contract: typeof V8_EXECUTION_CONTROL_TOWER_CONTRACT;
  projectId?: string;
  queues: Record<ControlTowerQueue, ControlTowerItem[]>;
  counts: Record<ControlTowerQueue, number>;
}

// DEC-424 (P12-int-c): DONE -> CLOSED, CANCELLED -> REJECTED; ARCHIVED is now a flag, not a status.
const INIT_TERMINAL = new Set(['CLOSED', 'REJECTED', 'DRAFT']);
const TASK_TERMINAL = new Set(['DONE', 'CANCELLED', 'COMPLETED', 'VALIDATED']);

function normStatus(s: string | null | undefined): string {
  return String(s || '')
    .trim()
    .toUpperCase();
}

function isInitTerminal(status: string | null | undefined): boolean {
  return INIT_TERMINAL.has(normStatus(status));
}

function isTaskTerminal(status: string | null | undefined): boolean {
  const u = normStatus(status);
  return TASK_TERMINAL.has(u) || u === 'CANCELLED';
}

function dayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function parseDay(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : dayStart(new Date(t));
}

function defaultWhatNextForQueue(queue: ControlTowerQueue): ControlTowerWhatNext[] {
  switch (queue) {
    case 'late':
      return [
        {
          action: 'replan',
          detail: 'Aktualizuj datę końca / forecast w inicjatywie lub zadaniu.',
          readbackHint:
            'Po zapisie kolejka „late” i variancja baseline powinny odświeżyć się w tej samej sesji.',
        },
        {
          action: 'escalate',
          detail: 'Utwórz lub podepnij rekord RAID / decyzję blokującą opóźnienie.',
          readbackHint: 'Drill-down powinien pokazać jawny „needs decision / blocked”.',
        },
      ];
    case 'at_risk':
      return [
        {
          action: 'smooth',
          detail: 'Przesuń terminy lub alokację zadań w oknie (bez pełnego redesignu planu).',
          readbackHint: 'Powinien spaść sygnał przeciążenia / ryzyka terminu po zapisie.',
        },
        {
          action: 'replan',
          detail: 'Zaktualizuj forecast effort / milestone przy zachowaniu baseline.',
          readbackHint: 'Wariancja forecast vs baseline musi być czytelna po mutacji.',
        },
      ];
    case 'blocked':
      return [
        {
          action: 'escalate',
          detail: 'Rozwiąż blokadę (zależność, decyzja) lub przypisz właściciela eskalacji.',
          readbackHint: 'Kolejka „blocked” i „blocked by” w drill-down muszą być spójne.',
        },
      ];
    case 'overloaded':
      return [
        {
          action: 'reassign',
          detail: 'Przepisz część zadań na innego assignee.',
          readbackHint:
            'Kolejka „overloaded” i capacity readback odświeżą się po zmianie właściciela.',
        },
        {
          action: 'smooth',
          detail: 'Odsuń niskopriorytetowe terminy, by pracować w limicie tygodnia.',
          readbackHint: 'Alokacja godzin vs capacity powinna spaść poniżej progu overload.',
        },
      ];
    case 'stale':
      return [
        {
          action: 'replan',
          detail: 'Oznacz postęp, zaktualizuj status lub zamknij nieaktualne pozycje.',
          readbackHint: 'Znacznik „stale aging” powinien zniknąć po sensownym ruchu `updated_at`.',
        },
      ];
    default:
      return [];
  }
}

function signalToWhy(sig: DelaySignal): ControlTowerWhy[] {
  const out: ControlTowerWhy[] = [
    {
      kind: 'delay',
      detail: `${sig.deviationType}: ${sig.daysDeviation} d. (plan: ${sig.plannedDate || '—'})`,
    },
  ];
  for (const w of sig.whySlipReasons || []) {
    const kind: ControlTowerWhy['kind'] =
      w.reason === 'CAPACITY_OVERLOAD'
        ? 'workload'
        : w.reason === 'DEPENDENCY_NOT_DONE' || w.reason === 'BLOCKED'
          ? 'dependency'
          : w.reason === 'NO_TASKS_PLANNED'
            ? 'estimate'
            : 'delay';
    out.push({ kind, detail: `${w.reason}: ${w.detail}` });
  }
  return out;
}

function deviationLate(sig: DelaySignal): boolean {
  return sig.deviationType === 'OVERDUE';
}

function deviationAtRisk(sig: DelaySignal): boolean {
  return (
    sig.deviationType === 'LATE_FINISH_RISK' ||
    sig.deviationType === 'DEADLINE_RISK' ||
    sig.deviationType === 'LATE_START'
  );
}

function itemKey(entityType: 'INITIATIVE' | 'TASK', entityId: string): string {
  return `${entityType}:${entityId}`;
}

interface InitRow {
  id: string;
  name: string;
  status: string;
  project_id: string | null;
  planned_end_date: string | null;
  forecast_end_date: string | null;
  sla_deadline: string | null;
  updated_at: string | null;
  blocked_reason: string | null;
  blocked_at: string | null;
  on_hold: boolean | null;
  end_date: string | null;
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  initiative_id: string | null;
  project_id: string | null;
  due_date: string | null;
  assignee_id: string | null;
  estimated_hours: number | null;
  updated_at: string | null;
  blocked_reason: string | null;
}

async function loadActiveInitiatives(
  organizationId: string,
  projectId?: string
): Promise<InitRow[]> {
  let q = `
    SELECT id, name, status, project_id, planned_end_date, forecast_end_date,
           end_date as sla_deadline, updated_at,
           NULL as blocked_reason, NULL as blocked_at, on_hold
    FROM initiatives
    WHERE organization_id = ?
      -- DEC-424 (P12-int-c): DONE -> CLOSED, CANCELLED -> REJECTED; ARCHIVED is now a flag.
      AND UPPER(COALESCE(status,'')) NOT IN ('CLOSED', 'REJECTED', 'DRAFT')
  `;
  const p: unknown[] = [organizationId];
  if (projectId) {
    q += ' AND project_id = ?';
    p.push(projectId);
  }
  return ((await dbAll(q, p)) || []) as InitRow[];
}

async function loadActiveTasks(organizationId: string, projectId?: string): Promise<TaskRow[]> {
  let q = `
    SELECT t.id, t.title, t.status, t.initiative_id, t.project_id, t.due_date, t.assignee_id,
           t.estimated_hours, t.updated_at, t.blocked_reason
    FROM tasks t
    JOIN initiatives i ON i.id = t.initiative_id
    WHERE i.organization_id = ?
      AND UPPER(COALESCE(t.status,'')) NOT IN ('DONE', 'CANCELLED', 'COMPLETED', 'VALIDATED')
  `;
  const p: unknown[] = [organizationId];
  if (projectId) {
    q += ' AND i.project_id = ?';
    p.push(projectId);
  }
  return ((await dbAll(q, p)) || []) as TaskRow[];
}

async function loadInitiativeDownstream(
  organizationId: string,
  fromInitiativeIds: string[]
): Promise<Map<string, ControlTowerAffectsNext[]>> {
  const map = new Map<string, ControlTowerAffectsNext[]>();
  if (fromInitiativeIds.length === 0) return map;
  const ph = fromInitiativeIds.map(() => '?').join(',');
  const rows = ((await dbAll(
    `SELECT id.from_initiative_id as from_id, id.to_initiative_id as to_id,
            COALESCE(i.name, id.to_initiative_id) as label
     FROM initiative_dependencies id
     JOIN initiatives i ON i.id = id.to_initiative_id AND i.organization_id = id.organization_id
     WHERE id.organization_id = ?
       AND id.from_initiative_id IN (${ph})`,
    [organizationId, ...fromInitiativeIds]
  )) || []) as Array<{ from_id: string; to_id: string; label: string }>;

  for (const r of rows) {
    const list = map.get(r.from_id) || [];
    list.push({
      entityType: 'INITIATIVE',
      entityId: r.to_id,
      label: String(r.label || r.to_id),
    });
    map.set(r.from_id, list);
  }
  return map;
}

async function loadTaskDownstream(
  organizationId: string,
  fromTaskIds: string[]
): Promise<Map<string, ControlTowerAffectsNext[]>> {
  const map = new Map<string, ControlTowerAffectsNext[]>();
  if (fromTaskIds.length === 0) return map;
  const ph = fromTaskIds.map(() => '?').join(',');
  const rows = ((await dbAll(
    `SELECT td.from_task_id as from_id, td.to_task_id as to_id, tt.title as label
     FROM task_dependencies td
     JOIN tasks tt ON tt.id = td.to_task_id AND tt.organization_id = ?
     WHERE td.from_task_id IN (${ph})`,
    [organizationId, ...fromTaskIds]
  )) || []) as Array<{ from_id: string; to_id: string; label: string | null }>;

  for (const r of rows) {
    const list = map.get(r.from_id) || [];
    list.push({
      entityType: 'TASK',
      entityId: r.to_id,
      label: String(r.label || r.to_id),
    });
    map.set(r.from_id, list);
  }
  return map;
}

interface PredRow {
  to_initiative_id: string;
  pred_name: string;
  pred_status: string;
}

async function initiativesWithIncompletePred(
  organizationId: string,
  projectId: string | undefined,
  initiativeIds: string[]
): Promise<Map<string, PredRow[]>> {
  const map = new Map<string, PredRow[]>();
  if (initiativeIds.length === 0) return map;
  const ph = initiativeIds.map(() => '?').join(',');
  let q = `
    SELECT id.to_initiative_id, COALESCE(pi.name, pi.id) as pred_name, pi.status as pred_status
    FROM initiative_dependencies id
    JOIN initiatives pi ON pi.id = id.from_initiative_id
    JOIN initiatives ci ON ci.id = id.to_initiative_id
    WHERE id.organization_id = ?
      AND id.to_initiative_id IN (${ph})
      AND pi.status NOT IN ('CLOSED', 'REJECTED')  -- DEC-424 (P12-int-c)
  `;
  const p: unknown[] = [organizationId, ...initiativeIds];
  if (projectId) {
    q += ' AND ci.project_id = ?';
    p.push(projectId);
  }
  const rows = ((await dbAll(q, p)) || []) as PredRow[];
  for (const r of rows) {
    const list = map.get(r.to_initiative_id) || [];
    list.push(r);
    map.set(r.to_initiative_id, list);
  }
  return map;
}

interface TaskPredRow {
  to_task_id: string;
  pred_title: string;
  pred_status: string;
}

async function tasksWithIncompletePred(
  organizationId: string,
  taskIds: string[]
): Promise<Map<string, TaskPredRow[]>> {
  const map = new Map<string, TaskPredRow[]>();
  if (taskIds.length === 0) return map;
  const ph = taskIds.map(() => '?').join(',');
  const rows = ((await dbAll(
    `SELECT td.to_task_id as to_task_id, ft.title as pred_title, ft.status as pred_status
     FROM task_dependencies td
     JOIN tasks ft ON ft.id = td.from_task_id
     JOIN tasks tt ON tt.id = td.to_task_id
     WHERE tt.organization_id = ?
       AND td.to_task_id IN (${ph})
       AND lower(coalesce(ft.status,'')) NOT IN ('done','completed','validated','cancelled')`,
    [organizationId, ...taskIds]
  )) || []) as TaskPredRow[];
  for (const r of rows) {
    const list = map.get(r.to_task_id) || [];
    list.push(r);
    map.set(r.to_task_id, list);
  }
  return map;
}

function mergeItem(into: Map<string, ControlTowerItem>, item: ControlTowerItem): void {
  const k = itemKey(item.entityType, item.entityId);
  const prev = into.get(k);
  if (!prev) {
    into.set(k, item);
    return;
  }
  const whyKeys = new Set(prev.why.map((w) => `${w.kind}:${w.detail}`));
  for (const w of item.why) {
    const key = `${w.kind}:${w.detail}`;
    if (!whyKeys.has(key)) {
      prev.why.push(w);
      whyKeys.add(key);
    }
  }
  if (item.severity === 'critical' || prev.severity === 'critical') {
    prev.severity = 'critical';
  }
}

export async function getExecutionControlTowerQueues(
  organizationId: string,
  options?: {
    projectId?: string;
    queue?: ControlTowerQueue | 'all';
    overloadWindow?: OverloadWindow;
  }
): Promise<ControlTowerQueuesResult> {
  const projectId = options?.projectId;
  const queueFilter = options?.queue;
  const overloadWindow = options?.overloadWindow || 'week';

  const [delaySignals, overloadAlerts, initiatives, tasks] = await Promise.all([
    detectDelaySignals(organizationId, projectId, { maxSignals: 2000 }),
    getOverloadAlerts(organizationId, overloadWindow),
    loadActiveInitiatives(organizationId, projectId),
    loadActiveTasks(organizationId, projectId),
  ]);

  const overloadByUser = new Map<string, OverloadAlert>();
  for (const a of overloadAlerts) {
    overloadByUser.set(a.userId, a);
  }

  const initById = new Map(initiatives.map((i) => [i.id, i]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  const late = new Map<string, ControlTowerItem>();
  const atRisk = new Map<string, ControlTowerItem>();
  const blocked = new Map<string, ControlTowerItem>();
  const overloaded = new Map<string, ControlTowerItem>();
  const stale = new Map<string, ControlTowerItem>();

  const today = dayStart(new Date());
  const staleCut = today - STALE_DAYS * MS_DAY;

  for (const sig of delaySignals) {
    if (deviationLate(sig)) {
      mergeItem(late, {
        entityType: sig.entityType,
        entityId: sig.entityId,
        name: sig.entityName,
        initiativeId: sig.entityType === 'TASK' ? null : sig.entityId,
        projectId: sig.projectId,
        severity: sig.severity === 'CRITICAL' ? 'critical' : 'warning',
        why: signalToWhy(sig),
        whatNext: defaultWhatNextForQueue('late'),
        affectsNext: [],
      });
    } else if (deviationAtRisk(sig)) {
      mergeItem(atRisk, {
        entityType: sig.entityType,
        entityId: sig.entityId,
        name: sig.entityName,
        initiativeId: sig.entityType === 'TASK' ? undefined : sig.entityId,
        projectId: sig.projectId,
        severity: sig.severity === 'CRITICAL' ? 'critical' : 'warning',
        why: signalToWhy(sig),
        whatNext: defaultWhatNextForQueue('at_risk'),
        affectsNext: [],
      });
    }
  }

  for (const init of initiatives) {
    const effectiveEnd = init.forecast_end_date || init.planned_end_date || init.sla_deadline;
    const end = parseDay(effectiveEnd);
    if (end !== null && end < today && !isInitTerminal(init.status)) {
      mergeItem(late, {
        entityType: 'INITIATIVE',
        entityId: init.id,
        name: init.name,
        initiativeId: init.id,
        projectId: init.project_id,
        severity: today - end > 14 * MS_DAY ? 'critical' : 'warning',
        why: [
          {
            kind: 'baseline_forecast',
            detail: `Forecast/planowany koniec (${effectiveEnd}) jest w przeszłości.`,
          },
        ],
        whatNext: defaultWhatNextForQueue('late'),
        affectsNext: [],
      });
    }
  }

  for (const task of tasks) {
    const due = parseDay(task.due_date);
    if (due !== null && due < today) {
      mergeItem(late, {
        entityType: 'TASK',
        entityId: task.id,
        name: task.title,
        initiativeId: task.initiative_id,
        projectId: task.project_id,
        severity: today - due > 7 * MS_DAY ? 'critical' : 'warning',
        why: [
          {
            kind: 'baseline_forecast',
            detail: `Termin zadania (${task.due_date}) minął.`,
          },
        ],
        whatNext: defaultWhatNextForQueue('late'),
        affectsNext: [],
      });
    }
  }

  // DEC-424 (P12-int-c): BLOCKED -> IN_EXECUTION + flaga on_hold.
  const statusBlockedInits = initiatives.filter((i) => Boolean(i.on_hold));
  for (const init of statusBlockedInits) {
    mergeItem(blocked, {
      entityType: 'INITIATIVE',
      entityId: init.id,
      name: init.name,
      initiativeId: init.id,
      projectId: init.project_id,
      severity: 'warning',
      why: [
        {
          kind: 'status',
          detail: init.blocked_reason
            ? `Status BLOCKED: ${init.blocked_reason}`
            : 'Status BLOCKED (brak szczegółu).',
        },
      ],
      whatNext: defaultWhatNextForQueue('blocked'),
      affectsNext: [],
    });
  }

  const initIds = initiatives.map((i) => i.id);
  const predMap = await initiativesWithIncompletePred(organizationId, projectId, initIds);
  for (const [toId, preds] of predMap) {
    const init = initById.get(toId);
    if (!init) continue;
    mergeItem(blocked, {
      entityType: 'INITIATIVE',
      entityId: toId,
      name: init.name,
      initiativeId: toId,
      projectId: init.project_id,
      severity: 'warning',
      why: preds.map((p) => ({
        kind: 'dependency' as const,
        detail: `blocked by initiative ${p.pred_name} (${p.pred_status})`,
      })),
      whatNext: defaultWhatNextForQueue('blocked'),
      affectsNext: [],
    });
  }

  const taskIds = tasks.map((t) => t.id);
  const taskPredMap = await tasksWithIncompletePred(organizationId, taskIds);
  for (const task of tasks) {
    if (normStatus(task.status) === 'BLOCKED' || task.blocked_reason) {
      mergeItem(blocked, {
        entityType: 'TASK',
        entityId: task.id,
        name: task.title,
        initiativeId: task.initiative_id,
        projectId: task.project_id,
        severity: 'warning',
        why: [
          {
            kind: 'status',
            detail: task.blocked_reason
              ? `Zadanie zablokowane: ${task.blocked_reason}`
              : 'Status zadania wskazuje na blokadę.',
          },
        ],
        whatNext: defaultWhatNextForQueue('blocked'),
        affectsNext: [],
      });
    }
  }

  for (const [tid, preds] of taskPredMap) {
    const task = taskById.get(tid);
    if (!task) continue;
    mergeItem(blocked, {
      entityType: 'TASK',
      entityId: tid,
      name: task.title,
      initiativeId: task.initiative_id,
      projectId: task.project_id,
      severity: 'warning',
      why: preds.map((p) => ({
        kind: 'dependency' as const,
        detail: `blocked by task “${p.pred_title}” (${p.pred_status})`,
      })),
      whatNext: defaultWhatNextForQueue('blocked'),
      affectsNext: [],
    });
  }

  for (const task of tasks) {
    if (!task.assignee_id) continue;
    const alert = overloadByUser.get(task.assignee_id);
    if (!alert) continue;
    mergeItem(overloaded, {
      entityType: 'TASK',
      entityId: task.id,
      name: task.title,
      initiativeId: task.initiative_id,
      projectId: task.project_id,
      severity: alert.severity === 'critical' ? 'critical' : 'warning',
      why: [
        {
          kind: 'workload',
          detail: `${alert.name}: ${alert.suggestion} (${alert.overloadHours}h ponad kapas.)`,
        },
      ],
      whatNext: defaultWhatNextForQueue('overloaded'),
      affectsNext: [],
    });
    if (task.estimated_hours == null || Number(task.estimated_hours) <= 0) {
      const cur = overloaded.get(itemKey('TASK', task.id));
      if (cur) {
        cur.why.push({
          kind: 'estimate',
          detail: 'Brak wiarygodnego estimated_hours — overload może być niedoszacowany.',
        });
      }
    }
  }

  for (const init of initiatives) {
    if (!init.planned_end_date && !init.sla_deadline && !isInitTerminal(init.status)) {
      mergeItem(atRisk, {
        entityType: 'INITIATIVE',
        entityId: init.id,
        name: init.name,
        initiativeId: init.id,
        projectId: init.project_id,
        severity: 'warning',
        why: [
          {
            kind: 'baseline_forecast',
            detail: 'Missing baseline: brak planned_end_date / SLA dla aktywnej inicjatywy.',
          },
        ],
        whatNext: defaultWhatNextForQueue('at_risk'),
        affectsNext: [],
      });
    }
  }

  for (const init of initiatives) {
    if (!init.updated_at) continue;
    const u = new Date(init.updated_at).getTime();
    if (!isInitTerminal(init.status) && u < staleCut) {
      mergeItem(stale, {
        entityType: 'INITIATIVE',
        entityId: init.id,
        name: init.name,
        initiativeId: init.id,
        projectId: init.project_id,
        severity: 'warning',
        why: [
          {
            kind: 'stale',
            detail: `Brak ruchu stanu ≥ ${STALE_DAYS} d. (ostatnia zmiana: ${init.updated_at || '—'}).`,
          },
        ],
        whatNext: defaultWhatNextForQueue('stale'),
        affectsNext: [],
      });
    }
  }

  for (const task of tasks) {
    if (!task.updated_at) continue;
    const u = new Date(task.updated_at).getTime();
    if (!isTaskTerminal(task.status) && u < staleCut) {
      mergeItem(stale, {
        entityType: 'TASK',
        entityId: task.id,
        name: task.title,
        initiativeId: task.initiative_id,
        projectId: task.project_id,
        severity: 'warning',
        why: [
          {
            kind: 'stale',
            detail: `Zadanie bez aktualizacji ≥ ${STALE_DAYS} d. (${task.updated_at || '—'}).`,
          },
        ],
        whatNext: defaultWhatNextForQueue('stale'),
        affectsNext: [],
      });
    }
  }

  const lateIds = [...late.values()]
    .filter((i) => i.entityType === 'INITIATIVE')
    .map((i) => i.entityId);
  const blockedInitIds = [...blocked.values()]
    .filter((i) => i.entityType === 'INITIATIVE')
    .map((i) => i.entityId);
  const lateTaskIds = [...late.values()]
    .filter((i) => i.entityType === 'TASK')
    .map((i) => i.entityId);
  const blockedTaskIds = [...blocked.values()]
    .filter((i) => i.entityType === 'TASK')
    .map((i) => i.entityId);

  const downInit = await loadInitiativeDownstream(organizationId, [
    ...new Set([...lateIds, ...blockedInitIds]),
  ]);
  const downTask = await loadTaskDownstream(organizationId, [
    ...new Set([...lateTaskIds, ...blockedTaskIds]),
  ]);

  const applyDownstream = (m: Map<string, ControlTowerItem>) => {
    for (const it of m.values()) {
      it.affectsNext =
        it.entityType === 'INITIATIVE'
          ? downInit.get(it.entityId) || []
          : downTask.get(it.entityId) || [];
    }
  };
  applyDownstream(late);
  applyDownstream(blocked);

  const allQueues: Record<ControlTowerQueue, ControlTowerItem[]> = {
    late: [...late.values()],
    at_risk: [...atRisk.values()],
    blocked: [...blocked.values()],
    overloaded: [...overloaded.values()],
    stale: [...stale.values()],
  };

  const sortItems = (items: ControlTowerItem[]) =>
    items.sort((a, b) => {
      const sev = (s?: string) => (s === 'critical' ? 0 : 1);
      const c = sev(a.severity) - sev(b.severity);
      if (c !== 0) return c;
      return String(a.name).localeCompare(String(b.name));
    });

  (Object.keys(allQueues) as ControlTowerQueue[]).forEach((k) => sortItems(allQueues[k]));

  let queuesOut: Record<ControlTowerQueue, ControlTowerItem[]> = allQueues;
  if (queueFilter && queueFilter !== 'all') {
    queuesOut = {
      late: [],
      at_risk: [],
      blocked: [],
      overloaded: [],
      stale: [],
      [queueFilter]: allQueues[queueFilter],
    };
  }

  const counts = {
    late: allQueues.late.length,
    at_risk: allQueues.at_risk.length,
    blocked: allQueues.blocked.length,
    overloaded: allQueues.overloaded.length,
    stale: allQueues.stale.length,
  };

  return {
    generatedAt: new Date().toISOString(),
    contract: V8_EXECUTION_CONTROL_TOWER_CONTRACT,
    projectId,
    queues: queuesOut,
    counts,
  };
}

const QUEUE_ORDER: ControlTowerQueue[] = ['late', 'at_risk', 'blocked', 'overloaded', 'stale'];

export async function getExecutionControlTowerItemDetail(
  organizationId: string,
  entityType: 'INITIATIVE' | 'TASK',
  entityId: string,
  projectId?: string
): Promise<{
  entityType: 'INITIATIVE' | 'TASK';
  entityId: string;
  inQueues: ControlTowerQueue[];
  item: ControlTowerItem;
  contract: typeof V8_EXECUTION_CONTROL_TOWER_CONTRACT;
} | null> {
  const snapshot = await getExecutionControlTowerQueues(organizationId, {
    projectId,
    queue: 'all',
  });
  const hits: Partial<Record<ControlTowerQueue, ControlTowerItem>> = {};
  for (const q of QUEUE_ORDER) {
    const row = snapshot.queues[q].find(
      (i) => i.entityType === entityType && i.entityId === entityId
    );
    if (row) hits[q] = row;
  }
  const inQueues = QUEUE_ORDER.filter((q) => hits[q]);
  if (inQueues.length === 0) {
    return null;
  }

  const base = { ...hits[inQueues[0]!]! };
  const whyKeys = new Set(base.why.map((w) => `${w.kind}:${w.detail}`));
  const whatKeys = new Set(base.whatNext.map((w) => `${w.action}:${w.detail}`));
  const affectKeys = new Set(base.affectsNext.map((a) => itemKey(a.entityType, a.entityId)));

  for (const q of inQueues.slice(1)) {
    const h = hits[q]!;
    for (const w of h.why) {
      const key = `${w.kind}:${w.detail}`;
      if (!whyKeys.has(key)) {
        base.why.push(w);
        whyKeys.add(key);
      }
    }
    for (const w of h.whatNext) {
      const key = `${w.action}:${w.detail}`;
      if (!whatKeys.has(key)) {
        base.whatNext.push(w);
        whatKeys.add(key);
      }
    }
    for (const a of h.affectsNext || []) {
      const k = itemKey(a.entityType, a.entityId);
      if (!affectKeys.has(k)) {
        base.affectsNext.push(a);
        affectKeys.add(k);
      }
    }
    if (h.severity === 'critical') base.severity = 'critical';
  }

  return {
    entityType,
    entityId,
    inQueues,
    item: base,
    contract: V8_EXECUTION_CONTROL_TOWER_CONTRACT,
  };
}
