/**
 * IdeaSmartLayout — Intelligent layout algorithms for canvas tools.
 *
 * Supports: auto-arrange, force-directed, grid snap, spacing equalization,
 * radial layout, tree layout. Works with ReactFlow Node/Edge arrays.
 */
import type { Node, Edge } from 'reactflow';

export type LayoutAlgorithm = 'auto' | 'force' | 'grid' | 'radial' | 'tree' | 'horizontal' | 'vertical';

interface LayoutOptions {
  algorithm: LayoutAlgorithm;
  spacing?: number;
  gridSize?: number;
  centerX?: number;
  centerY?: number;
  animate?: boolean;
}

interface LayoutResult {
  nodes: Node[];
  changed: boolean;
}

const DEFAULT_SPACING = 200;
const DEFAULT_GRID_SIZE = 24;

function buildAdjacency(nodes: Node[], edges: Edge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) {
    adj.get(e.source)?.push(e.target);
    adj.get(e.target)?.push(e.source);
  }
  return adj;
}

function findRoot(nodes: Node[], edges: Edge[]): string {
  const targets = new Set(edges.map((e) => e.target));
  const root = nodes.find((n) => !targets.has(n.id));
  return root?.id || nodes[0]?.id || '';
}

function treeLayout(nodes: Node[], edges: Edge[], spacing: number): Node[] {
  const adj = buildAdjacency(nodes, edges);
  const rootId = findRoot(nodes, edges);
  const positions = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();

  let leafIndex = 0;

  function dfs(nodeId: string, depth: number): { minX: number; maxX: number } {
    if (visited.has(nodeId)) return { minX: leafIndex * spacing, maxX: leafIndex * spacing };
    visited.add(nodeId);

    const children = (adj.get(nodeId) || []).filter((c) => !visited.has(c));

    if (children.length === 0) {
      const x = leafIndex * spacing;
      positions.set(nodeId, { x, y: depth * (spacing * 0.8) });
      leafIndex++;
      return { minX: x, maxX: x };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    for (const child of children) {
      const { minX: cMin, maxX: cMax } = dfs(child, depth + 1);
      minX = Math.min(minX, cMin);
      maxX = Math.max(maxX, cMax);
    }

    const x = (minX + maxX) / 2;
    positions.set(nodeId, { x, y: depth * (spacing * 0.8) });
    return { minX, maxX };
  }

  if (rootId) dfs(rootId, 0);

  for (const n of nodes) {
    if (!positions.has(n.id)) {
      positions.set(n.id, { x: leafIndex * spacing, y: 0 });
      leafIndex++;
    }
  }

  return nodes.map((n) => ({
    ...n,
    position: positions.get(n.id) || n.position,
  }));
}

function radialLayout(nodes: Node[], edges: Edge[], spacing: number, cx: number, cy: number): Node[] {
  const adj = buildAdjacency(nodes, edges);
  const rootId = findRoot(nodes, edges);
  const positions = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();

  positions.set(rootId, { x: cx, y: cy });
  visited.add(rootId);

  const queue: Array<{ id: string; depth: number; startAngle: number; endAngle: number }> = [];
  const rootChildren = (adj.get(rootId) || []).filter((c) => !visited.has(c));
  const angleStep = (2 * Math.PI) / Math.max(1, rootChildren.length);

  rootChildren.forEach((childId, i) => {
    visited.add(childId);
    queue.push({ id: childId, depth: 1, startAngle: i * angleStep, endAngle: (i + 1) * angleStep });
  });

  while (queue.length > 0) {
    const { id, depth, startAngle, endAngle } = queue.shift()!;
    const angle = (startAngle + endAngle) / 2;
    const radius = depth * spacing;
    positions.set(id, { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });

    const children = (adj.get(id) || []).filter((c) => !visited.has(c));
    const childAngleStep = (endAngle - startAngle) / Math.max(1, children.length);
    children.forEach((childId, i) => {
      visited.add(childId);
      queue.push({
        id: childId,
        depth: depth + 1,
        startAngle: startAngle + i * childAngleStep,
        endAngle: startAngle + (i + 1) * childAngleStep,
      });
    });
  }

  for (const n of nodes) {
    if (!positions.has(n.id)) {
      positions.set(n.id, n.position);
    }
  }

  return nodes.map((n) => ({
    ...n,
    position: positions.get(n.id) || n.position,
  }));
}

function forceDirectedLayout(nodes: Node[], edges: Edge[], spacing: number, iterations = 50): Node[] {
  const positions = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    positions.set(n.id, { ...n.position });
  }

  const edgeSet = edges.map((e) => ({ source: e.source, target: e.target }));
  const k = spacing;
  const kSquared = k * k;

  for (let iter = 0; iter < iterations; iter++) {
    const displacement = new Map<string, { dx: number; dy: number }>();
    for (const n of nodes) displacement.set(n.id, { dx: 0, dy: 0 });

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const pi = positions.get(nodes[i].id)!;
        const pj = positions.get(nodes[j].id)!;
        const dx = pi.x - pj.x;
        const dy = pi.y - pj.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = kSquared / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        displacement.get(nodes[i].id)!.dx += fx;
        displacement.get(nodes[i].id)!.dy += fy;
        displacement.get(nodes[j].id)!.dx -= fx;
        displacement.get(nodes[j].id)!.dy -= fy;
      }
    }

    for (const edge of edgeSet) {
      const ps = positions.get(edge.source);
      const pt = positions.get(edge.target);
      if (!ps || !pt) continue;
      const dx = ps.x - pt.x;
      const dy = ps.y - pt.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      displacement.get(edge.source)!.dx -= fx;
      displacement.get(edge.source)!.dy -= fy;
      displacement.get(edge.target)!.dx += fx;
      displacement.get(edge.target)!.dy += fy;
    }

    const temp = Math.max(1, spacing * (1 - iter / iterations));
    for (const n of nodes) {
      const d = displacement.get(n.id)!;
      const dist = Math.max(1, Math.sqrt(d.dx * d.dx + d.dy * d.dy));
      const pos = positions.get(n.id)!;
      pos.x += (d.dx / dist) * Math.min(dist, temp);
      pos.y += (d.dy / dist) * Math.min(dist, temp);
    }
  }

  return nodes.map((n) => ({
    ...n,
    position: positions.get(n.id) || n.position,
  }));
}

function gridLayout(nodes: Node[], spacing: number): Node[] {
  const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
  return nodes.map((n, i) => ({
    ...n,
    position: {
      x: (i % cols) * spacing,
      y: Math.floor(i / cols) * spacing,
    },
  }));
}

function horizontalLayout(nodes: Node[], edges: Edge[], spacing: number): Node[] {
  const adj = buildAdjacency(nodes, edges);
  const rootId = findRoot(nodes, edges);
  const positions = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();
  let yIndex = 0;

  function dfs(nodeId: string, depth: number) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    positions.set(nodeId, { x: depth * spacing, y: yIndex * (spacing * 0.6) });
    yIndex++;
    const children = (adj.get(nodeId) || []).filter((c) => !visited.has(c));
    for (const child of children) dfs(child, depth + 1);
  }

  if (rootId) dfs(rootId, 0);
  for (const n of nodes) {
    if (!positions.has(n.id)) {
      positions.set(n.id, { x: 0, y: yIndex * (spacing * 0.6) });
      yIndex++;
    }
  }

  return nodes.map((n) => ({
    ...n,
    position: positions.get(n.id) || n.position,
  }));
}

function snapToGrid(nodes: Node[], gridSize: number): Node[] {
  return nodes.map((n) => ({
    ...n,
    position: {
      x: Math.round(n.position.x / gridSize) * gridSize,
      y: Math.round(n.position.y / gridSize) * gridSize,
    },
  }));
}

export function equalizeSpacing(nodes: Node[], axis: 'x' | 'y'): Node[] {
  if (nodes.length < 3) return nodes;
  const sorted = [...nodes].sort((a, b) => a.position[axis] - b.position[axis]);
  const min = sorted[0].position[axis];
  const max = sorted[sorted.length - 1].position[axis];
  const step = (max - min) / (sorted.length - 1);

  const posMap = new Map<string, { x: number; y: number }>();
  sorted.forEach((n, i) => {
    posMap.set(n.id, {
      ...n.position,
      [axis]: min + i * step,
    });
  });

  return nodes.map((n) => ({
    ...n,
    position: posMap.get(n.id) || n.position,
  }));
}

export function applySmartLayout(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions
): LayoutResult {
  if (nodes.length === 0) return { nodes, changed: false };

  const spacing = options.spacing || DEFAULT_SPACING;
  const cx = options.centerX ?? 400;
  const cy = options.centerY ?? 300;
  let result: Node[];

  switch (options.algorithm) {
    case 'tree':
      result = treeLayout(nodes, edges, spacing);
      break;
    case 'radial':
      result = radialLayout(nodes, edges, spacing, cx, cy);
      break;
    case 'force':
      result = forceDirectedLayout(nodes, edges, spacing);
      break;
    case 'grid':
      result = gridLayout(nodes, spacing);
      break;
    case 'horizontal':
      result = horizontalLayout(nodes, edges, spacing);
      break;
    case 'vertical':
      result = treeLayout(nodes, edges, spacing);
      break;
    case 'auto': {
      const hasEdges = edges.length > 0;
      const ratio = nodes.length > 0 ? edges.length / nodes.length : 0;
      if (!hasEdges) {
        result = gridLayout(nodes, spacing);
      } else if (ratio > 0.8) {
        result = forceDirectedLayout(nodes, edges, spacing);
      } else {
        result = treeLayout(nodes, edges, spacing);
      }
      break;
    }
    default:
      result = nodes;
  }

  if (options.gridSize) {
    result = snapToGrid(result, options.gridSize);
  }

  return { nodes: result, changed: true };
}

export function snapNodesToGrid(nodes: Node[], gridSize = DEFAULT_GRID_SIZE): Node[] {
  return snapToGrid(nodes, gridSize);
}
