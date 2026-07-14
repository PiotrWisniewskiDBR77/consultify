/**
 * generateReadback — client-side semantic readback (process traversal) for
 * Process Flow.
 *
 * Replaces the dead `GET /api/v8/process-flow/:id/readback` call (DP-7: the
 * V8 mirror was cut). Builds the same `ReadbackStep` tree structure that
 * ReadbackPanel expects, entirely from the in-memory graph (nodes/edges +
 * lanes from extensions.processFlow).
 *
 * Traversal rules:
 *  - Start from nodes with no incoming edges, preferring shape 'start' /
 *    'bpmn_event' as the canonical entry points.
 *  - Walk `source -> target` edges in order.
 *  - Decision/gateway nodes ('decision' | 'bpmn_gateway') fan out into
 *    labeled branches (edge data.label / conditionType).
 *  - Cycles are detected via a visited-set per traversal path; on revisiting
 *    an already-visited node the branch is closed with a "back to X" step.
 *  - Nodes never reached from any start node are reported separately as
 *    unreachable.
 */
import type { Edge, Node } from 'reactflow';

export interface ReadbackStep {
  type: 'step' | 'decision' | 'parallel_split' | 'parallel_join' | 'start' | 'end';
  label: string;
  object_id: string;
  branches?: ReadbackStep[][];
}

export interface ReadbackResult {
  paths: ReadbackStep[];
  warnings: string[];
}

export interface LaneLike {
  id: string;
  label: string;
  color?: string;
}

const START_SHAPES = new Set(['start', 'bpmn_event', 'auto_trigger']);
const END_SHAPES = new Set(['end']);
const DECISION_SHAPES = new Set(['decision', 'bpmn_gateway', 'auto_condition', 'org_handoff']);

function nodeShape(node: Node): string {
  return String(node.data?.shape || node.type || '');
}

function nodeLabel(node: Node, lanes: LaneLike[], isPl: boolean): string {
  const baseLabel = String(node.data?.label || node.id);
  const laneId = node.data?.laneId as string | undefined;
  const lane = laneId ? lanes.find((l) => l.id === laneId) : undefined;
  if (lane?.label) {
    return isPl ? `${baseLabel} (${lane.label})` : `${baseLabel} (${lane.label})`;
  }
  return baseLabel;
}

function stepTypeForNode(node: Node): ReadbackStep['type'] {
  const shape = nodeShape(node);
  if (START_SHAPES.has(shape)) return 'start';
  if (END_SHAPES.has(shape)) return 'end';
  if (DECISION_SHAPES.has(shape)) return 'decision';
  return 'step';
}

function edgeLabel(edge: Edge): string {
  const label = edge.data?.label ?? edge.label;
  if (label) return String(label);
  const conditionType = edge.data?.conditionType;
  if (conditionType) return String(conditionType);
  return '';
}

/**
 * Build a traversal tree starting at `startNode`. `visited` tracks nodes
 * already visited *on the current path* so cycles are detected and closed
 * cleanly instead of recursing forever.
 */
function traverse(
  nodeId: string,
  nodesById: Map<string, Node>,
  outgoingByNode: Map<string, Edge[]>,
  lanes: LaneLike[],
  isPl: boolean,
  visited: Set<string>,
  globalVisited: Set<string>
): ReadbackStep | null {
  const node = nodesById.get(nodeId);
  if (!node) return null;

  globalVisited.add(nodeId);

  if (visited.has(nodeId)) {
    // Cycle: close the branch here rather than recursing again.
    return {
      type: 'step',
      label: isPl
        ? `Powrót do: ${nodeLabel(node, lanes, isPl)}`
        : `Back to: ${nodeLabel(node, lanes, isPl)}`,
      object_id: `cycle-${nodeId}-${Math.random().toString(36).slice(2, 6)}`,
    };
  }

  const nextVisited = new Set(visited);
  nextVisited.add(nodeId);

  const step: ReadbackStep = {
    type: stepTypeForNode(node),
    label: nodeLabel(node, lanes, isPl),
    object_id: nodeId,
  };

  const outgoing = outgoingByNode.get(nodeId) || [];

  if (outgoing.length === 0 || stepTypeForNode(node) === 'end') {
    return step;
  }

  if (step.type === 'decision' || outgoing.length > 1) {
    // Fan out into labeled branches, one per outgoing edge.
    const branches: ReadbackStep[][] = [];
    for (const edge of outgoing) {
      const branchSteps: ReadbackStep[] = [];
      const label = edgeLabel(edge);
      if (label) {
        branchSteps.push({
          type: 'step',
          label: isPl ? `Gałąź: ${label}` : `Branch: ${label}`,
          object_id: `branch-label-${edge.id}`,
        });
      }
      const childStep = traverse(
        edge.target,
        nodesById,
        outgoingByNode,
        lanes,
        isPl,
        nextVisited,
        globalVisited
      );
      if (childStep) branchSteps.push(childStep);
      branches.push(branchSteps);
    }
    step.branches = branches;
    return step;
  }

  // Single linear continuation: flatten as a branch with one path so the
  // panel's recursive renderer (which reads `branches`) still shows it.
  const only = outgoing[0];
  const childStep = traverse(
    only.target,
    nodesById,
    outgoingByNode,
    lanes,
    isPl,
    nextVisited,
    globalVisited
  );
  if (childStep) {
    step.branches = [[childStep]];
  }
  return step;
}

export function generateReadback(
  nodes: Node[],
  edges: Edge[],
  lanes: LaneLike[] = [],
  isPl = false
): ReadbackResult {
  const flowNodes = nodes.filter((n) => n.type !== undefined);
  const nodesById = new Map(flowNodes.map((n) => [n.id, n]));
  const outgoingByNode = new Map<string, Edge[]>();
  const hasIncoming = new Set<string>();

  for (const edge of edges) {
    if (!nodesById.has(edge.source) || !nodesById.has(edge.target)) continue;
    const list = outgoingByNode.get(edge.source) || [];
    list.push(edge);
    outgoingByNode.set(edge.source, list);
    hasIncoming.add(edge.target);
  }

  const warnings: string[] = [];

  // Candidate start nodes: no incoming edges. Prefer canonical start shapes.
  const noIncoming = flowNodes.filter((n) => !hasIncoming.has(n.id));
  const startCandidates = noIncoming.filter((n) => START_SHAPES.has(nodeShape(n)));
  const rootsInOrder = startCandidates.length > 0 ? startCandidates : noIncoming;

  const globalVisited = new Set<string>();
  const paths: ReadbackStep[] = [];

  for (const root of rootsInOrder) {
    const step = traverse(
      root.id,
      nodesById,
      outgoingByNode,
      lanes,
      isPl,
      new Set(),
      globalVisited
    );
    if (step) paths.push(step);
  }

  // Nodes never reached (e.g. isolated islands, or nodes with only incoming
  // edges from other unreached nodes) — surface as an "unreachable" section.
  const unreachable = flowNodes.filter((n) => !globalVisited.has(n.id));
  if (unreachable.length > 0) {
    warnings.push(
      isPl
        ? `${unreachable.length} węzeł/węzły nieosiągalne z punktu startowego`
        : `${unreachable.length} node(s) unreachable from any start node`
    );
    for (const node of unreachable) {
      paths.push({
        type: 'step',
        label: isPl
          ? `Nieosiągalny: ${nodeLabel(node, lanes, isPl)}`
          : `Unreachable: ${nodeLabel(node, lanes, isPl)}`,
        object_id: node.id,
      });
    }
  }

  if (rootsInOrder.length === 0 && flowNodes.length > 0) {
    warnings.push(isPl ? 'Nie znaleziono węzła startowego' : 'No start node found for traversal');
  }

  return { paths, warnings };
}

/**
 * Flatten a ReadbackResult into indented plain text — used by the export
 * "readback-text" format (Task 3).
 */
export function readbackToText(result: ReadbackResult, isPl = false): string {
  const lines: string[] = [];
  const title = isPl ? 'Odczyt semantyczny procesu' : 'Process Semantic Readback';
  lines.push(title);
  lines.push('='.repeat(title.length));
  lines.push('');

  function walk(step: ReadbackStep, depth: number) {
    const indent = '  '.repeat(depth);
    lines.push(`${indent}- [${step.type}] ${step.label} (${step.object_id})`);
    if (step.branches && step.branches.length > 0) {
      step.branches.forEach((branch, i) => {
        if (step.branches!.length > 1) {
          lines.push(`${'  '.repeat(depth + 1)}${isPl ? 'Gałąź' : 'Branch'} ${i + 1}:`);
        }
        branch.forEach((child) => walk(child, depth + (step.branches!.length > 1 ? 2 : 1)));
      });
    }
  }

  for (const step of result.paths) {
    walk(step, 0);
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push(isPl ? 'Ostrzeżenia:' : 'Warnings:');
    for (const w of result.warnings) lines.push(`  - ${w}`);
  }

  return lines.join('\n');
}
