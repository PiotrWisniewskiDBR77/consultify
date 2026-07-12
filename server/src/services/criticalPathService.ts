/**
 * Critical Path Service
 * V4-TASK-04: CPM (Critical Path Method) implementation
 *
 * Supports FS/SS/FF/SF dependency types with lag.
 */

export interface CriticalPathTask {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  durationDays: number;
  status: string;
  dependencies: Array<{ fromTaskId: string; type: string; lagDays: number }>;
  /** Optional passthrough so callers (e.g. project-wide CPM queries spanning
   *  multiple initiatives) can roll task-level criticality up to the initiative
   *  it belongs to. Not used by the CPM algorithm itself. */
  initiativeId?: string | null;
}

export interface CriticalPathResultTask extends CriticalPathTask {
  earlyStart: number;
  earlyFinish: number;
  lateStart: number;
  lateFinish: number;
  slack: number;
  isCritical: boolean;
}

export interface CriticalPathResult {
  criticalPath: string[];
  totalDuration: number;
  tasks: CriticalPathResultTask[];
}

function topologicalSort(ids: string[], adjList: Map<string, string[]>): string[] | null {
  const inDegree = new Map<string, number>();
  for (const id of ids) inDegree.set(id, 0);

  for (const [, successors] of adjList) {
    for (const s of successors) {
      inDegree.set(s, (inDegree.get(s) ?? 0) + 1);
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const s of adjList.get(node) ?? []) {
      const newDeg = (inDegree.get(s) ?? 1) - 1;
      inDegree.set(s, newDeg);
      if (newDeg === 0) queue.push(s);
    }
  }

  return sorted.length === ids.length ? sorted : null;
}

/**
 * Given a dependency type and the predecessor/successor durations,
 * compute the minimum start/finish constraint the predecessor imposes
 * on the successor.
 *
 * Returns the earliest value the successor's relevant metric can take.
 *   FS: successor ES >= predecessor EF + lag
 *   SS: successor ES >= predecessor ES + lag
 *   FF: successor EF >= predecessor EF + lag  →  successor ES >= predecessor EF + lag - successorDuration
 *   SF: successor EF >= predecessor ES + lag  →  successor ES >= predecessor ES + lag - successorDuration
 */
function forwardConstraint(
  type: string,
  predES: number,
  predEF: number,
  successorDuration: number,
  lag: number
): number {
  switch (type) {
    case 'FS':
      return predEF + lag;
    case 'SS':
      return predES + lag;
    case 'FF':
      return predEF + lag - successorDuration;
    case 'SF':
      return predES + lag - successorDuration;
    default:
      return predEF + lag;
  }
}

/**
 * Backward pass constraint: given dependency type, compute the latest
 * the predecessor can finish/start without delaying the successor.
 *
 *   FS: predecessor LF <= successor LS - lag
 *   SS: predecessor LS <= successor LS - lag  →  predecessor LF <= successor LS - lag + predDuration
 *   FF: predecessor LF <= successor LF - lag
 *   SF: predecessor LS <= successor LF - lag  →  predecessor LF <= successor LF - lag + predDuration
 */
function backwardConstraint(
  type: string,
  succLS: number,
  succLF: number,
  predDuration: number,
  lag: number
): number {
  switch (type) {
    case 'FS':
      return succLS - lag;
    case 'SS':
      return succLS - lag + predDuration;
    case 'FF':
      return succLF - lag;
    case 'SF':
      return succLF - lag + predDuration;
    default:
      return succLS - lag;
  }
}

export function calculateCriticalPath(tasks: CriticalPathTask[]): CriticalPathResult {
  if (tasks.length === 0) {
    return { criticalPath: [], totalDuration: 0, tasks: [] };
  }

  const taskMap = new Map<string, CriticalPathTask>();
  for (const t of tasks) taskMap.set(t.id, t);

  const ids = tasks.map((t) => t.id);

  // Build adjacency list (predecessor → successors) based on dependencies
  const adjList = new Map<string, string[]>();
  for (const id of ids) adjList.set(id, []);

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (taskMap.has(dep.fromTaskId)) {
        const succs = adjList.get(dep.fromTaskId) ?? [];
        if (!succs.includes(task.id)) {
          succs.push(task.id);
          adjList.set(dep.fromTaskId, succs);
        }
      }
    }
  }

  const sorted = topologicalSort(ids, adjList);
  if (!sorted) {
    // Cycle detected — return all tasks with zero slack as fallback
    const resultTasks: CriticalPathResultTask[] = tasks.map((t) => ({
      ...t,
      earlyStart: 0,
      earlyFinish: t.durationDays,
      lateStart: 0,
      lateFinish: t.durationDays,
      slack: 0,
      isCritical: true,
    }));
    return {
      criticalPath: ids,
      totalDuration: Math.max(...tasks.map((t) => t.durationDays), 0),
      tasks: resultTasks,
    };
  }

  // Forward pass
  const es = new Map<string, number>();
  const ef = new Map<string, number>();

  for (const id of sorted) {
    const task = taskMap.get(id)!;
    let earliest = 0;

    for (const dep of task.dependencies) {
      if (!taskMap.has(dep.fromTaskId)) continue;
      const predES = es.get(dep.fromTaskId) ?? 0;
      const predEF = ef.get(dep.fromTaskId) ?? 0;
      const constraint = forwardConstraint(
        dep.type,
        predES,
        predEF,
        task.durationDays,
        dep.lagDays
      );
      earliest = Math.max(earliest, constraint);
    }

    es.set(id, Math.max(earliest, 0));
    ef.set(id, Math.max(earliest, 0) + task.durationDays);
  }

  const projectEnd = Math.max(...ids.map((id) => ef.get(id) ?? 0), 0);

  // Backward pass
  const ls = new Map<string, number>();
  const lf = new Map<string, number>();

  // Build reverse adjacency (successor → predecessors with dep info)
  const reverseAdj = new Map<string, Array<{ predId: string; type: string; lagDays: number }>>();
  for (const id of ids) reverseAdj.set(id, []);

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (taskMap.has(dep.fromTaskId)) {
        const preds = reverseAdj.get(task.id) ?? [];
        preds.push({ predId: dep.fromTaskId, type: dep.type, lagDays: dep.lagDays });
        reverseAdj.set(task.id, preds);
      }
    }
  }

  // Build successor map for backward pass (pred → list of {succId, type, lag})
  const succMap = new Map<string, Array<{ succId: string; type: string; lagDays: number }>>();
  for (const id of ids) succMap.set(id, []);

  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (taskMap.has(dep.fromTaskId)) {
        const succs = succMap.get(dep.fromTaskId) ?? [];
        succs.push({ succId: task.id, type: dep.type, lagDays: dep.lagDays });
        succMap.set(dep.fromTaskId, succs);
      }
    }
  }

  for (const id of [...sorted].reverse()) {
    const task = taskMap.get(id)!;
    const successors = succMap.get(id) ?? [];

    if (successors.length === 0) {
      lf.set(id, projectEnd);
      ls.set(id, projectEnd - task.durationDays);
    } else {
      let latestFinish = Infinity;
      for (const succ of successors) {
        const succLSVal = ls.get(succ.succId) ?? projectEnd;
        const succLFVal = lf.get(succ.succId) ?? projectEnd;
        const constraint = backwardConstraint(
          succ.type,
          succLSVal,
          succLFVal,
          task.durationDays,
          succ.lagDays
        );
        latestFinish = Math.min(latestFinish, constraint);
      }
      lf.set(id, latestFinish);
      ls.set(id, latestFinish - task.durationDays);
    }
  }

  const resultTasks: CriticalPathResultTask[] = sorted.map((id) => {
    const task = taskMap.get(id)!;
    const earlyStart = es.get(id) ?? 0;
    const earlyFinish = ef.get(id) ?? 0;
    const lateStart = ls.get(id) ?? 0;
    const lateFinish = lf.get(id) ?? 0;
    const slack = Math.round((lateStart - earlyStart) * 100) / 100;
    return {
      ...task,
      earlyStart,
      earlyFinish,
      lateStart,
      lateFinish,
      slack,
      isCritical: Math.abs(slack) < 0.001,
    };
  });

  const criticalPath = resultTasks.filter((t) => t.isCritical).map((t) => t.id);

  return {
    criticalPath,
    totalDuration: projectEnd,
    tasks: resultTasks,
  };
}

export default { calculateCriticalPath };
