/**
 * StructureLayouts — Layout algorithms for map structure types:
 * org_chart (top-down), tree_right (left-to-right), fishbone (Ishikawa),
 * and timeline (horizontal).
 *
 * All layouts only reposition nodes — they never modify graph structure.
 * Tree traversal uses the edge list to build parent→children adjacency.
 */
import type { Edge, Node } from 'reactflow';

import type { MapStructureType } from '../ideaSelectionTypes';
import { applyForceLayout } from './ForceDirectedLayout';
import { applyRadialLayout } from './RadialTreeLayout';

// ── Shared helpers ──────────────────────────────────────────────────────

function buildAdjacency(edges: Edge[]): { adj: Map<string, string[]>; hasParent: Set<string> } {
  const adj = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const edge of edges) {
    const children = adj.get(edge.source) || [];
    children.push(edge.target);
    adj.set(edge.source, children);
    hasParent.add(edge.target);
  }
  return { adj, hasParent };
}

function findRoot(nodes: Node[], hasParent: Set<string>): string | undefined {
  const rootNode = nodes.find((n) => n.id === 'root');
  return rootNode ? 'root' : nodes.find((n) => !hasParent.has(n.id))?.id;
}

function placeOrphans(
  nodes: Node[],
  positions: Map<string, { x: number; y: number }>,
  nodeWidth: number,
  nodeHeight: number
): void {
  const orphans = nodes.filter((n) => !positions.has(n.id));
  if (orphans.length === 0) return;
  const maxY =
    positions.size > 0 ? Math.max(...Array.from(positions.values()).map((p) => p.y)) + 100 : 0;
  orphans.forEach((orphan, idx) => {
    const col = idx % 4;
    const row = Math.floor(idx / 4);
    positions.set(orphan.id, {
      x: col * (nodeWidth + 20),
      y: maxY + row * (nodeHeight + 20),
    });
  });
}

function applyPositions(nodes: Node[], positions: Map<string, { x: number; y: number }>): Node[] {
  return nodes.map((n) => {
    const pos = positions.get(n.id);
    if (!pos) return n;
    return { ...n, position: { x: pos.x, y: pos.y } };
  });
}

// ── Org Chart: top-down tree ────────────────────────────────────────────

const ORG_H_GAP = 200;
const ORG_V_GAP = 120;

function orgChartSubtree(
  nodeId: string,
  xStart: number,
  y: number,
  adj: Map<string, string[]>,
  positions: Map<string, { x: number; y: number }>,
  visited: Set<string>
): number {
  if (visited.has(nodeId)) return xStart;
  visited.add(nodeId);

  const children = adj.get(nodeId) || [];
  if (children.length === 0) {
    positions.set(nodeId, { x: xStart, y });
    return xStart + ORG_H_GAP;
  }

  const childY = y + ORG_V_GAP;
  let xNext = xStart;
  for (const childId of children) {
    xNext = orgChartSubtree(childId, xNext, childY, adj, positions, visited);
  }

  const firstX = positions.get(children[0])?.x ?? xStart;
  const lastX = positions.get(children[children.length - 1])?.x ?? xStart;
  positions.set(nodeId, { x: (firstX + lastX) / 2, y });

  return xNext;
}

export function applyOrgChartLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;
  const { adj, hasParent } = buildAdjacency(edges);
  const rootId = findRoot(nodes, hasParent);
  if (!rootId) return nodes;

  const positions = new Map<string, { x: number; y: number }>();
  orgChartSubtree(rootId, 0, 0, adj, positions, new Set());
  placeOrphans(nodes, positions, 180, 60);
  return applyPositions(nodes, positions);
}

// ── Tree Right: left-to-right (same as existing useAutoLayout) ──────────

const TR_H_GAP = 220;
const TR_V_GAP = 70;

function treeRightSubtree(
  nodeId: string,
  x: number,
  yStart: number,
  adj: Map<string, string[]>,
  positions: Map<string, { x: number; y: number }>,
  visited: Set<string>
): number {
  if (visited.has(nodeId)) return yStart;
  visited.add(nodeId);

  const children = adj.get(nodeId) || [];
  if (children.length === 0) {
    positions.set(nodeId, { x, y: yStart });
    return yStart + TR_V_GAP;
  }

  const childX = x + TR_H_GAP;
  let yNext = yStart;
  for (const childId of children) {
    yNext = treeRightSubtree(childId, childX, yNext, adj, positions, visited);
  }

  const firstY = positions.get(children[0])?.y ?? yStart;
  const lastY = positions.get(children[children.length - 1])?.y ?? yStart;
  positions.set(nodeId, { x, y: (firstY + lastY) / 2 });

  return yNext;
}

export function applyTreeRightLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;
  const { adj, hasParent } = buildAdjacency(edges);
  const rootId = findRoot(nodes, hasParent);
  if (!rootId) return nodes;

  const positions = new Map<string, { x: number; y: number }>();
  treeRightSubtree(rootId, 0, 0, adj, positions, new Set());
  placeOrphans(nodes, positions, 180, 60);
  return applyPositions(nodes, positions);
}

// ── Fishbone (Ishikawa): cause-and-effect diagram ───────────────────────

const SPINE_SEGMENT = 280;
const BRANCH_LENGTH = 200;
const SUB_BRANCH_OFFSET = 100;
const SUB_BRANCH_STEP = 60;
const FISHBONE_ANGLE = Math.PI / 4; // 45 degrees

export function applyFishboneLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;
  const { adj, hasParent } = buildAdjacency(edges);
  const rootId = findRoot(nodes, hasParent);
  if (!rootId) return nodes;

  const positions = new Map<string, { x: number; y: number }>();
  const branches = adj.get(rootId) || [];

  const spineLength = Math.max(branches.length, 1) * SPINE_SEGMENT;
  positions.set(rootId, { x: spineLength + 100, y: 0 });

  branches.forEach((branchId, idx) => {
    const spineX = spineLength - (idx + 1) * SPINE_SEGMENT + SPINE_SEGMENT / 2;
    const above = idx % 2 === 0;
    const sign = above ? -1 : 1;

    const bx = spineX + Math.cos(FISHBONE_ANGLE) * BRANCH_LENGTH * (above ? 1 : 1);
    const by = sign * Math.sin(FISHBONE_ANGLE) * BRANCH_LENGTH;
    positions.set(branchId, { x: bx, y: by });

    const subBranches = adj.get(branchId) || [];
    subBranches.forEach((subId, subIdx) => {
      const offset = SUB_BRANCH_OFFSET + subIdx * SUB_BRANCH_STEP;
      const sx = bx + Math.cos(FISHBONE_ANGLE) * offset * 0.3;
      const sy = by + sign * offset * 0.6;
      positions.set(subId, { x: sx, y: sy });

      const leafs = adj.get(subId) || [];
      leafs.forEach((leafId, leafIdx) => {
        positions.set(leafId, {
          x: sx + 120 + leafIdx * 30,
          y: sy + sign * (40 + leafIdx * 35),
        });
      });
    });
  });

  placeOrphans(nodes, positions, 180, 60);
  return applyPositions(nodes, positions);
}

// ── Timeline: horizontal arrangement ────────────────────────────────────

const TL_H_GAP = 250;
const TL_V_GAP = 80;
const TL_CHILD_V_OFFSET = 100;

export function applyTimelineLayout(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length === 0) return nodes;
  const { adj, hasParent } = buildAdjacency(edges);
  const rootId = findRoot(nodes, hasParent);
  if (!rootId) return nodes;

  const positions = new Map<string, { x: number; y: number }>();
  positions.set(rootId, { x: 0, y: 0 });

  const topLevel = adj.get(rootId) || [];

  topLevel.forEach((nodeId, idx) => {
    const x = (idx + 1) * TL_H_GAP;
    positions.set(nodeId, { x, y: 0 });

    const children = adj.get(nodeId) || [];
    children.forEach((childId, childIdx) => {
      positions.set(childId, {
        x,
        y: TL_CHILD_V_OFFSET + childIdx * TL_V_GAP,
      });

      const grandchildren = adj.get(childId) || [];
      grandchildren.forEach((gcId, gcIdx) => {
        positions.set(gcId, {
          x: x + 120,
          y: TL_CHILD_V_OFFSET + childIdx * TL_V_GAP + (gcIdx + 1) * 50,
        });
      });
    });
  });

  placeOrphans(nodes, positions, 180, 60);
  return applyPositions(nodes, positions);
}

// ── Semantic: cluster nodes by semanticType / branchKey / tags ───────────

const SEM_CLUSTER_RADIUS = 400;
const SEM_NODE_V_GAP = 80;

export function applySemanticLayout(
  nodes: Node[],
  edges: Edge[],
  fallbackLayout: (n: Node[], e: Edge[]) => Node[]
): Node[] {
  if (nodes.length === 0) return nodes;

  const rootNode = nodes.find((n) => n.id === 'root');
  const nonRoot = nodes.filter((n) => n.id !== 'root');

  if (!rootNode || nonRoot.length === 0) {
    return fallbackLayout(nodes, edges);
  }

  const clusters = new Map<string, Node[]>();
  for (const node of nonRoot) {
    const semType: string = node.data?.semanticType || '';
    const branchKey: string = node.data?.branchKey || '';
    const tags: string[] = Array.isArray(node.data?.tags) ? node.data.tags : [];

    let clusterKey = 'uncategorized';
    if (semType) {
      clusterKey = semType;
    } else if (branchKey) {
      clusterKey = branchKey;
    } else if (tags.length > 0) {
      clusterKey = tags[0];
    }

    if (!clusters.has(clusterKey)) clusters.set(clusterKey, []);
    clusters.get(clusterKey)!.push(node);
  }

  const positions = new Map<string, { x: number; y: number }>();
  positions.set('root', { x: 0, y: 0 });

  const clusterEntries = Array.from(clusters.entries());
  const totalClusters = clusterEntries.length;

  clusterEntries.forEach(([, clusterNodes], clusterIndex) => {
    const angle = (clusterIndex / totalClusters) * 2 * Math.PI;
    const cx = Math.cos(angle) * SEM_CLUSTER_RADIUS;
    const cy = Math.sin(angle) * SEM_CLUSTER_RADIUS;

    const totalHeight = (clusterNodes.length - 1) * SEM_NODE_V_GAP;
    const startY = cy - totalHeight / 2;

    clusterNodes.forEach((node, nodeIndex) => {
      positions.set(node.id, {
        x: cx,
        y: startY + nodeIndex * SEM_NODE_V_GAP,
      });
    });
  });

  return applyPositions(nodes, positions);
}

// ── Dispatcher: apply layout by structure type ──────────────────────────

export function applyStructureLayout(
  structureType: MapStructureType,
  nodes: Node[],
  edges: Edge[],
  autoLayout: (n: Node[], e: Edge[]) => Node[]
): Node[] {
  switch (structureType) {
    case 'org_chart':
      return applyOrgChartLayout(nodes, edges);
    case 'tree_right':
      return applyTreeRightLayout(nodes, edges);
    case 'fishbone':
      return applyFishboneLayout(nodes, edges);
    case 'timeline':
      return applyTimelineLayout(nodes, edges);
    case 'semantic':
      return applySemanticLayout(nodes, edges, autoLayout);
    case 'mindmap':
    default:
      return autoLayout(nodes, edges);
  }
}

/**
 * Resolve which layout function to use given the current layoutMode + structureType.
 * layoutMode ('tree'|'radial'|'force') is the existing toggle;
 * structureType is the new GAP-3 structure.
 * When structureType is not 'mindmap', it takes precedence.
 */
export function resolveLayout(
  layoutMode: string,
  structureType: MapStructureType,
  nodes: Node[],
  edges: Edge[],
  autoLayout: (n: Node[], e: Edge[]) => Node[]
): Node[] {
  if (structureType !== 'mindmap') {
    return applyStructureLayout(structureType, nodes, edges, autoLayout);
  }
  switch (layoutMode) {
    case 'radial':
      return applyRadialLayout(nodes, edges);
    case 'force':
      return applyForceLayout(nodes, edges);
    default:
      return autoLayout(nodes, edges);
  }
}
