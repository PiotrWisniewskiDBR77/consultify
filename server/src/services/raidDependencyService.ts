/**
 * M14/F8 — dependency graph analytics (pure, no DB).
 *
 * Turns directed dependency edges (predecessor → successor) into a graph and
 * exposes the analyses the RAID Dependency register needs but never had: cycle
 * detection, topological order, cascade impact of a delay, and the critical
 * dependency chain (longest path). All pure functions, fully unit-tested.
 */

export interface DepEdge {
  /** predecessor (must finish first). */
  fromId: string;
  /** successor (depends on `fromId`). */
  toId: string;
}

/** Adjacency list: node → direct successors. */
export function buildAdjacency(edges: DepEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (!e || e.fromId == null || e.toId == null) continue;
    if (!adj.has(e.fromId)) adj.set(e.fromId, []);
    if (!adj.has(e.toId)) adj.set(e.toId, []);
    if (e.fromId !== e.toId) adj.get(e.fromId)!.push(e.toId);
  }
  return adj;
}

/**
 * Detect cycles via DFS with white/gray/black colouring. Returns one path per
 * detected back-edge (the cycle, ending where it re-enters the gray node).
 * Self-loops (A→A) are reported as `[A, A]`.
 */
export function detectCycles(edges: DepEdge[]): string[][] {
  const adj = buildAdjacency(edges);
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const n of adj.keys()) color.set(n, WHITE);
  const cycles: string[][] = [];
  const stack: string[] = [];

  // explicit self-loops first
  for (const e of edges) if (e && e.fromId === e.toId) cycles.push([e.fromId, e.fromId]);

  const dfs = (node: string): void => {
    color.set(node, GRAY);
    stack.push(node);
    for (const next of adj.get(node) || []) {
      if (color.get(next) === GRAY) {
        const idx = stack.indexOf(next);
        if (idx >= 0) cycles.push([...stack.slice(idx), next]);
      } else if (color.get(next) === WHITE) {
        dfs(next);
      }
    }
    stack.pop();
    color.set(node, BLACK);
  };

  for (const n of adj.keys()) if (color.get(n) === WHITE) dfs(n);
  return cycles;
}

/**
 * Topological order (Kahn). `hasCycle` is true when not every node could be
 * ordered (a cycle remained). `order` is a valid ordering of the acyclic part.
 */
export function topoOrder(edges: DepEdge[]): { order: string[]; hasCycle: boolean } {
  const adj = buildAdjacency(edges);
  const indeg = new Map<string, number>();
  for (const n of adj.keys()) indeg.set(n, 0);
  for (const [, succs] of adj) for (const s of succs) indeg.set(s, (indeg.get(s) || 0) + 1);
  const queue = [...indeg.entries()].filter(([, d]) => d === 0).map(([n]) => n);
  const order: string[] = [];
  while (queue.length) {
    const n = queue.shift()!;
    order.push(n);
    for (const s of adj.get(n) || []) {
      indeg.set(s, (indeg.get(s) || 0) - 1);
      if (indeg.get(s) === 0) queue.push(s);
    }
  }
  return { order, hasCycle: order.length !== adj.size };
}

/**
 * Cascade impact: every node reachable from any delayed node (its downstream
 * successors are all affected by the slip). Excludes the delayed nodes themselves.
 */
export function cascadeImpact(edges: DepEdge[], delayedIds: string[]): Set<string> {
  const adj = buildAdjacency(edges);
  const affected = new Set<string>();
  const visit = (node: string): void => {
    for (const s of adj.get(node) || []) {
      if (!affected.has(s)) {
        affected.add(s);
        visit(s);
      }
    }
  };
  for (const d of delayedIds) visit(d);
  for (const d of delayedIds) affected.delete(d);
  return affected;
}

/**
 * Critical dependency chain = longest-duration path through the DAG. Durations
 * are per-node (default 1). Returns the node ids on the longest chain; empty
 * when the graph has a cycle (undefined longest path).
 */
export function criticalDependencyChain(
  edges: DepEdge[],
  durations?: Map<string, number>
): string[] {
  const { order, hasCycle } = topoOrder(edges);
  if (hasCycle) return [];
  const adj = buildAdjacency(edges);
  const dur = (id: string): number => Math.max(1, durations?.get(id) ?? 1);
  const best = new Map<string, number>();
  const nextOf = new Map<string, string | null>();
  // process in reverse topo order so successors are resolved first
  for (let i = order.length - 1; i >= 0; i -= 1) {
    const n = order[i];
    let bestLen = dur(n);
    let bestNext: string | null = null;
    for (const s of adj.get(n) || []) {
      const cand = dur(n) + (best.get(s) || 0);
      if (cand > bestLen) {
        bestLen = cand;
        bestNext = s;
      }
    }
    best.set(n, bestLen);
    nextOf.set(n, bestNext);
  }
  // start = node with the max best length
  let start: string | null = null;
  let max = -Infinity;
  for (const [n, len] of best) {
    if (len > max) {
      max = len;
      start = n;
    }
  }
  const chain: string[] = [];
  let cur = start;
  const guard = new Set<string>();
  while (cur != null && !guard.has(cur)) {
    chain.push(cur);
    guard.add(cur);
    cur = nextOf.get(cur) ?? null;
  }
  return chain;
}
