/**
 * ForceDirectedLayout — Pure JS force simulation for node positioning.
 * Implements repulsion between all nodes and attraction along edges.
 */
import type { Edge, Node } from 'reactflow';

interface ForceConfig {
  iterations?: number;
  repulsion?: number;
  attraction?: number;
  damping?: number;
  centerGravity?: number;
}

interface Vec2 {
  x: number;
  y: number;
}

export function applyForceLayout(
  nodes: Node[],
  edges: Edge[],
  config: ForceConfig = {}
): Node[] {
  const {
    iterations = 120,
    repulsion = 8000,
    attraction = 0.005,
    damping = 0.85,
    centerGravity = 0.01,
  } = config;

  if (nodes.length === 0) return nodes;

  const positions = new Map<string, Vec2>();
  const velocities = new Map<string, Vec2>();

  for (const n of nodes) {
    positions.set(n.id, { x: n.position.x, y: n.position.y });
    velocities.set(n.id, { x: 0, y: 0 });
  }

  const nodeIds = nodes.map((n) => n.id);

  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<string, Vec2>();
    for (const id of nodeIds) forces.set(id, { x: 0, y: 0 });

    // Repulsion between all pairs
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = positions.get(nodeIds[i])!;
        const b = positions.get(nodeIds[j])!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;

        const fa = forces.get(nodeIds[i])!;
        const fb = forces.get(nodeIds[j])!;
        fa.x -= fx;
        fa.y -= fy;
        fb.x += fx;
        fb.y += fy;
      }
    }

    // Attraction along edges
    for (const e of edges) {
      const a = positions.get(e.source);
      const b = positions.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const fx = dx * attraction;
      const fy = dy * attraction;

      const fa = forces.get(e.source);
      const fb = forces.get(e.target);
      if (fa) { fa.x += fx; fa.y += fy; }
      if (fb) { fb.x -= fx; fb.y -= fy; }
    }

    // Center gravity
    for (const id of nodeIds) {
      const pos = positions.get(id)!;
      const f = forces.get(id)!;
      f.x -= pos.x * centerGravity;
      f.y -= pos.y * centerGravity;
    }

    // Apply forces
    for (const id of nodeIds) {
      const vel = velocities.get(id)!;
      const f = forces.get(id)!;
      vel.x = (vel.x + f.x) * damping;
      vel.y = (vel.y + f.y) * damping;

      const pos = positions.get(id)!;
      pos.x += vel.x;
      pos.y += vel.y;
    }
  }

  return nodes.map((n) => {
    const pos = positions.get(n.id);
    if (!pos) return n;
    return { ...n, position: { x: Math.round(pos.x), y: Math.round(pos.y) } };
  });
}
