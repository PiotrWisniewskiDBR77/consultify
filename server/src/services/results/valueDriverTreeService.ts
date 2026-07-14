/**
 * Value Driver Tree — model + roll-up (M15/W2 2.1+2.2).
 *
 * Doktryna McKinsey/BCG: cel finansowy → drivery → KPI → inicjatywy.
 * Wkład rolluje się z dołu do góry przez wagi krawędzi:
 *   inicjatywa → KPI → linia finansowa → cel.
 *
 * Czyste funkcje, zero DB.
 */

export type DriverNodeType = 'objective' | 'driver' | 'kpi' | 'initiative';

export interface DriverNode {
  id: string;
  type: DriverNodeType;
  label: string;
  baseline?: number | null;
  target?: number | null;
  current?: number | null;
  value?: number | null;
}

/** from = child contributes to to = parent. */
export interface DriverEdge {
  fromId: string;
  toId: string;
  weight?: number;
}

export interface ChildContribution {
  id: string;
  contribution: number;
}

export interface RolledDriverNode extends DriverNode {
  rolledUpValue: number;
  childContributions: ChildContribution[];
}

/** Coerce a maybe-null/undefined number to a finite number (default 0). */
function num(v: number | null | undefined): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** Effective edge weight (default 1). */
function edgeWeight(e: DriverEdge): number {
  return typeof e.weight === 'number' && Number.isFinite(e.weight) ? e.weight : 1;
}

/**
 * Roll up values from leaves to roots.
 *
 * For each node, rolledUpValue = sum over children of (child.rolledUpValue × edge.weight).
 * A node with no children (leaf) keeps its own `value` as its rolledUpValue.
 * Cycles are detected and broken safely (the back-edge is skipped).
 */
export function rollUpTree(nodes: DriverNode[], edges: DriverEdge[]): RolledDriverNode[] {
  const nodeById = new Map<string, DriverNode>();
  for (const n of nodes) nodeById.set(n.id, n);

  // parentId -> list of { childId, weight } (edge from=child, to=parent)
  const childrenOf = new Map<string, Array<{ childId: string; weight: number }>>();
  for (const e of edges) {
    if (!nodeById.has(e.fromId) || !nodeById.has(e.toId)) continue; // dangling edge
    if (e.fromId === e.toId) continue; // self-loop
    const list = childrenOf.get(e.toId) ?? [];
    list.push({ childId: e.fromId, weight: edgeWeight(e) });
    childrenOf.set(e.toId, list);
  }

  const rolled = new Map<string, number>();
  const contributions = new Map<string, ChildContribution[]>();
  const state = new Map<string, 'visiting' | 'done'>();

  function resolve(id: string): number {
    const cached = rolled.get(id);
    if (cached !== undefined) return cached;

    const node = nodeById.get(id);
    if (!node) return 0;

    const st = state.get(id);
    if (st === 'visiting') {
      // Cycle: break safely — fall back to the node's own value, don't recurse further.
      return num(node.value);
    }
    state.set(id, 'visiting');

    const children = childrenOf.get(id) ?? [];
    if (children.length === 0) {
      const leafValue = num(node.value);
      rolled.set(id, leafValue);
      contributions.set(id, []);
      state.set(id, 'done');
      return leafValue;
    }

    let sum = 0;
    const contribs: ChildContribution[] = [];
    for (const { childId, weight } of children) {
      const childState = state.get(childId);
      if (childState === 'visiting') {
        // Back-edge → would close a cycle. Skip it (contribution 0).
        contribs.push({ id: childId, contribution: 0 });
        continue;
      }
      const childValue = resolve(childId);
      const contribution = childValue * weight;
      sum += contribution;
      contribs.push({ id: childId, contribution });
    }

    rolled.set(id, sum);
    contributions.set(id, contribs);
    state.set(id, 'done');
    return sum;
  }

  for (const n of nodes) resolve(n.id);

  return nodes.map((n) => ({
    ...n,
    rolledUpValue: rolled.get(n.id) ?? num(n.value),
    childContributions: contributions.get(n.id) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// buildTreeFromMappings
// ---------------------------------------------------------------------------

export interface BuildTreeInput {
  objectives?: Array<{ id: string; label: string; value?: number | null }>;
  financialLines: Array<{ id: string; label: string; value?: number | null }>;
  kpis: Array<{
    id: string;
    name: string;
    baseline?: number | null;
    target?: number | null;
    current?: number | null;
  }>;
  kpiToFinancial: Array<{
    kpiId: string;
    statementLineId: string;
    multiplier?: number | null;
    direction?: 'POSITIVE' | 'NEGATIVE' | number | null;
  }>;
  initiativeToKpi: Array<{ initiativeId: string; kpiId: string; impactWeight?: number | null }>;
  initiatives: Array<{ id: string; name: string }>;
}

/** Normalize a direction into a +1 / -1 sign (default +1). */
function directionSign(direction: 'POSITIVE' | 'NEGATIVE' | number | null | undefined): number {
  if (direction === 'NEGATIVE') return -1;
  if (direction === 'POSITIVE') return 1;
  if (typeof direction === 'number' && Number.isFinite(direction)) {
    return direction < 0 ? -1 : 1;
  }
  return 1;
}

/**
 * Assemble the driver graph from cross-module mappings.
 *
 * Layers (child → parent):
 *   initiative → KPI         (weight = impactWeight)
 *   KPI        → financial   (weight = multiplier × directionSign)
 *   financial  → objective   (weight = 1; only when objectives are provided)
 *
 * KPI `value` defaults to current ?? target ?? baseline so the roll-up has a
 * sensible per-node base when there are no children below it.
 */
export function buildTreeFromMappings(input: BuildTreeInput): {
  nodes: DriverNode[];
  edges: DriverEdge[];
} {
  const nodes: DriverNode[] = [];
  const edges: DriverEdge[] = [];

  const objectives = input.objectives ?? [];
  const haveObjectives = objectives.length > 0;

  for (const o of objectives) {
    nodes.push({
      id: o.id,
      type: 'objective',
      label: o.label,
      value: o.value ?? null,
    });
  }

  for (const f of input.financialLines) {
    nodes.push({
      id: f.id,
      type: 'driver',
      label: f.label,
      value: f.value ?? null,
    });
  }

  for (const k of input.kpis) {
    const value = k.current ?? k.target ?? k.baseline ?? null;
    nodes.push({
      id: k.id,
      type: 'kpi',
      label: k.name,
      baseline: k.baseline ?? null,
      target: k.target ?? null,
      current: k.current ?? null,
      value,
    });
  }

  for (const i of input.initiatives) {
    nodes.push({
      id: i.id,
      type: 'initiative',
      label: i.name,
      value: null,
    });
  }

  const nodeIds = new Set(nodes.map((n) => n.id));

  // initiative → KPI
  for (const m of input.initiativeToKpi) {
    if (!nodeIds.has(m.initiativeId) || !nodeIds.has(m.kpiId)) continue;
    edges.push({
      fromId: m.initiativeId,
      toId: m.kpiId,
      weight:
        typeof m.impactWeight === 'number' && Number.isFinite(m.impactWeight) ? m.impactWeight : 1,
    });
  }

  // KPI → financial line
  for (const m of input.kpiToFinancial) {
    if (!nodeIds.has(m.kpiId) || !nodeIds.has(m.statementLineId)) continue;
    const multiplier =
      typeof m.multiplier === 'number' && Number.isFinite(m.multiplier) ? m.multiplier : 1;
    edges.push({
      fromId: m.kpiId,
      toId: m.statementLineId,
      weight: multiplier * directionSign(m.direction),
    });
  }

  // financial line → objective (only when objectives exist; fan all lines into each objective)
  if (haveObjectives) {
    for (const o of objectives) {
      for (const f of input.financialLines) {
        edges.push({ fromId: f.id, toId: o.id, weight: 1 });
      }
    }
  }

  return { nodes, edges };
}

// ---------------------------------------------------------------------------
// treeStats
// ---------------------------------------------------------------------------

export interface TreeStats {
  nodeCount: number;
  byType: Record<DriverNodeType, number>;
  rootValue: number;
}

/**
 * Summary statistics over a rolled tree.
 *
 * rootValue = sum of rolledUpValue over roots (nodes that are not a child of
 * any other node). With a single objective this is just that objective's value.
 */
export function treeStats(rolled: RolledDriverNode[]): TreeStats {
  const byType: Record<DriverNodeType, number> = {
    objective: 0,
    driver: 0,
    kpi: 0,
    initiative: 0,
  };
  for (const n of rolled) {
    byType[n.type] = (byType[n.type] ?? 0) + 1;
  }

  // A node is a child if it appears as a contributor somewhere.
  const childIds = new Set<string>();
  for (const n of rolled) {
    for (const c of n.childContributions) childIds.add(c.id);
  }

  let rootValue = 0;
  for (const n of rolled) {
    if (!childIds.has(n.id)) rootValue += n.rolledUpValue;
  }

  return {
    nodeCount: rolled.length,
    byType,
    rootValue,
  };
}
