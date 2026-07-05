/**
 * driverTreeService — driver-based FP&A planning tree (M16/5.3).
 *
 * Pure functions only: no I/O, no DB, no side effects. This is the foundation
 * for the Driver-Tree Planner — a model where business outcomes (e.g. Revenue)
 * are decomposed into the operational drivers that produce them
 * (e.g. Revenue = Customers × ARPU × Retention).
 *
 * A tree is expressed as a flat list of {@link DriverNode}. Leaf nodes are
 * `input` (carry a raw `value`); `formula` nodes are derived from their
 * operands via an arithmetic `op`. Evaluation is topological — leaves first,
 * propagating upward — and cycles are detected and rejected.
 */

/** Supported reducer operations for formula nodes. */
export type DriverOp = '+' | '-' | '*' | '/' | 'sum' | 'product';

/** A single node in a driver tree. */
export interface DriverNode {
  /** Stable unique identifier, referenced by other nodes' `operands`. */
  id: string;
  /** Human-readable label, e.g. "Revenue". */
  label: string;
  /** `input` = raw leaf value; `formula` = derived from operands. */
  kind: 'input' | 'formula';
  /** Raw value for `input` nodes. Ignored for `formula` nodes. */
  value?: number;
  /** Optional human-readable formula string, e.g. "Customers × ARPU". */
  formula?: string;
  /** Ids of operand nodes (only meaningful for `formula` nodes). */
  operands?: string[];
  /** How operands are combined (only meaningful for `formula` nodes). */
  op?: DriverOp;
}

/** Result of {@link evaluateTree}. */
export interface EvaluateResult {
  /** Computed numeric value per node id. */
  values: Record<string, number>;
  /** Topological evaluation order (leaves → roots). */
  order: string[];
}

/** Recursive chart shape consumed by the DriverTree component. */
export interface DriverChartNode {
  id: string;
  label: string;
  value: number;
  formula?: string;
  op?: DriverOp;
  children: DriverChartNode[];
}

/** Result of {@link treeToChartData}. */
export interface ChartData {
  root: DriverChartNode;
}

/** Thrown when the driver tree contains a dependency cycle. */
export class DriverTreeCycleError extends Error {
  /** The node ids participating in (or feeding into) the cycle. */
  readonly cycle: string[];
  constructor(cycle: string[]) {
    super(`Driver tree contains a cycle involving: ${cycle.join(' -> ')}`);
    this.name = 'DriverTreeCycleError';
    this.cycle = cycle;
  }
}

/** Build an id → node lookup, rejecting duplicate ids. */
function indexNodes(nodes: DriverNode[]): Map<string, DriverNode> {
  const map = new Map<string, DriverNode>();
  for (const node of nodes) {
    if (map.has(node.id)) {
      throw new Error(`Duplicate driver node id: "${node.id}"`);
    }
    map.set(node.id, node);
  }
  return map;
}

/**
 * Reduce a list of operand values using the given operation.
 * For binary ops ('+','-','*','/') operands are folded left-to-right.
 */
function applyOp(op: DriverOp, operandValues: number[]): number {
  switch (op) {
    case 'sum':
    case '+':
      return operandValues.reduce((acc, v) => acc + v, 0);
    case 'product':
    case '*':
      return operandValues.reduce((acc, v) => acc * v, 1);
    case '-':
      if (operandValues.length === 0) return 0;
      return operandValues.slice(1).reduce((acc, v) => acc - v, operandValues[0]);
    case '/':
      if (operandValues.length === 0) return 0;
      return operandValues.slice(1).reduce((acc, v) => {
        if (v === 0) return NaN; // explicit: division by zero → NaN, not Infinity
        return acc / v;
      }, operandValues[0]);
    default: {
      // Exhaustiveness guard.
      const _never: never = op;
      throw new Error(`Unknown driver op: ${String(_never)}`);
    }
  }
}

/**
 * Topologically order node ids so that every node appears after all of its
 * operands. Detects cycles via DFS coloring (white/grey/black).
 *
 * @throws {DriverTreeCycleError} when a cycle is found.
 */
function topoOrder(index: Map<string, DriverNode>): string[] {
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const order: string[] = [];
  // Track the active DFS path so we can report a useful cycle.
  const path: string[] = [];

  for (const id of index.keys()) color.set(id, WHITE);

  const visit = (id: string): void => {
    color.set(id, GREY);
    path.push(id);
    const node = index.get(id);
    if (node && node.kind === 'formula' && node.operands) {
      for (const dep of node.operands) {
        if (!index.has(dep)) {
          throw new Error(
            `Driver node "${id}" references unknown operand "${dep}"`,
          );
        }
        const c = color.get(dep);
        if (c === GREY) {
          // Found a back-edge → cycle. Report the cycle slice.
          const start = path.indexOf(dep);
          const cycle = path.slice(start).concat(dep);
          throw new DriverTreeCycleError(cycle);
        }
        if (c === WHITE) visit(dep);
      }
    }
    path.pop();
    color.set(id, BLACK);
    order.push(id);
  };

  for (const id of index.keys()) {
    if (color.get(id) === WHITE) visit(id);
  }
  // `order` is leaves-first because a node is pushed only after its deps.
  return order;
}

/**
 * Evaluate a driver tree.
 *
 * Inputs contribute their `value` (default 0). Formula nodes are computed from
 * already-evaluated operands. Returns the computed value per node plus the
 * topological order used (leaves → roots).
 *
 * @throws {DriverTreeCycleError} when the tree contains a cycle.
 */
export function evaluateTree(nodes: DriverNode[]): EvaluateResult {
  const index = indexNodes(nodes);
  const order = topoOrder(index);
  const values: Record<string, number> = {};

  for (const id of order) {
    const node = index.get(id)!;
    if (node.kind === 'input') {
      values[id] = typeof node.value === 'number' ? node.value : 0;
    } else {
      const operands = node.operands ?? [];
      const op = node.op ?? 'sum';
      const operandValues = operands.map((opId) => values[opId] ?? 0);
      values[id] = applyOp(op, operandValues);
    }
  }

  return { values, order };
}

/**
 * Change a single input node's value, recompute the whole tree, and report the
 * per-node delta. Only nodes whose value actually changed appear in `delta`.
 *
 * @param nodes      The driver tree.
 * @param changedId  Id of the input node to change.
 * @param newValue   The new value for that input.
 * @throws {Error} when `changedId` is unknown or is not an input node.
 * @throws {DriverTreeCycleError} when the tree contains a cycle.
 */
export function propagateChange(
  nodes: DriverNode[],
  changedId: string,
  newValue: number,
): { before: Record<string, number>; after: Record<string, number>; delta: Record<string, number> } {
  const index = indexNodes(nodes);
  const target = index.get(changedId);
  if (!target) {
    throw new Error(`Cannot propagate change: unknown node "${changedId}"`);
  }
  if (target.kind !== 'input') {
    throw new Error(
      `Cannot propagate change: node "${changedId}" is a formula, not an input`,
    );
  }

  const before = evaluateTree(nodes).values;

  // Apply the change to a shallow-cloned node list (no mutation of inputs).
  const mutated = nodes.map((n) =>
    n.id === changedId ? { ...n, value: newValue } : n,
  );
  const after = evaluateTree(mutated).values;

  const delta: Record<string, number> = {};
  for (const id of Object.keys(after)) {
    const d = (after[id] ?? 0) - (before[id] ?? 0);
    if (d !== 0 || Number.isNaN(after[id]) !== Number.isNaN(before[id])) {
      delta[id] = d;
    }
  }

  return { before, after, delta };
}

/**
 * Build a recursive chart shape for the DriverTree component.
 *
 * The tree may have multiple roots (nodes that nothing depends on). When there
 * is exactly one root it becomes `root`. When there are zero or several roots a
 * synthetic root labelled "Drivers" wraps them, so the consumer always gets a
 * single entry point.
 *
 * @param values Optional precomputed values; falls back to {@link evaluateTree}.
 */
export function treeToChartData(
  nodes: DriverNode[],
  values?: Record<string, number>,
): ChartData {
  const index = indexNodes(nodes);
  const resolved = values ?? evaluateTree(nodes).values;

  // A node is a root if no other node lists it as an operand.
  const referenced = new Set<string>();
  for (const node of nodes) {
    if (node.kind === 'formula' && node.operands) {
      for (const dep of node.operands) referenced.add(dep);
    }
  }
  const rootIds = nodes.map((n) => n.id).filter((id) => !referenced.has(id));

  // Guard against the chart recursion re-entering a cycle.
  const buildNode = (id: string, seen: Set<string>): DriverChartNode => {
    const node = index.get(id)!;
    const childIds =
      node.kind === 'formula' && node.operands ? node.operands : [];
    const nextSeen = new Set(seen).add(id);
    const children = childIds
      .filter((childId) => !seen.has(childId) && index.has(childId))
      .map((childId) => buildNode(childId, nextSeen));
    const chartNode: DriverChartNode = {
      id: node.id,
      label: node.label,
      value: resolved[id] ?? 0,
      children,
    };
    if (node.formula !== undefined) chartNode.formula = node.formula;
    if (node.kind === 'formula' && node.op !== undefined) chartNode.op = node.op;
    return chartNode;
  };

  if (rootIds.length === 1) {
    return { root: buildNode(rootIds[0], new Set()) };
  }

  const children = rootIds.map((id) => buildNode(id, new Set()));
  const totalValue = children.reduce((acc, c) => acc + (c.value ?? 0), 0);
  return {
    root: {
      id: '__root__',
      label: 'Drivers',
      value: totalValue,
      children,
    },
  };
}
