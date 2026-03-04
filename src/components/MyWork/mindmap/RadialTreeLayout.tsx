/**
 * RadialTreeLayout — Alternative layout mode that arranges nodes
 * in concentric circles radiating from the center.
 */
import type { Edge, Node } from 'reactflow';

interface RadialConfig {
  centerX?: number;
  centerY?: number;
  levelSpacing?: number;
  minAngle?: number;
}

export function applyRadialLayout(
  nodes: Node[],
  edges: Edge[],
  config: RadialConfig = {}
): Node[] {
  const { centerX = 0, centerY = 0, levelSpacing = 220, minAngle = 0.15 } = config;

  const root = nodes.find((n) => n.id === 'root');
  if (!root) return nodes;

  const childrenMap = new Map<string, string[]>();
  for (const e of edges) {
    if (!childrenMap.has(e.source)) childrenMap.set(e.source, []);
    childrenMap.get(e.source)!.push(e.target);
  }

  const positions = new Map<string, { x: number; y: number }>();
  positions.set('root', { x: centerX, y: centerY });

  function layoutSubtree(
    nodeId: string,
    startAngle: number,
    endAngle: number,
    level: number
  ) {
    const children = childrenMap.get(nodeId) || [];
    if (children.length === 0) return;

    const radius = levelSpacing * level;
    const angleSpan = endAngle - startAngle;
    const anglePerChild = angleSpan / Math.max(children.length, 1);

    children.forEach((childId, idx) => {
      const angle = startAngle + anglePerChild * (idx + 0.5);
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      positions.set(childId, { x, y });

      const childStart = startAngle + anglePerChild * idx;
      const childEnd = childStart + anglePerChild;
      layoutSubtree(childId, childStart, childEnd, level + 1);
    });
  }

  layoutSubtree('root', 0, 2 * Math.PI, 1);

  return nodes.map((n) => {
    const pos = positions.get(n.id);
    if (!pos) return n;
    return { ...n, position: { x: pos.x, y: pos.y } };
  });
}
