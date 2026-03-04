import { useCallback } from 'react';
import type { Edge, Node } from 'reactflow';

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const BRANCH_NODE_WIDTH = 140;
const BRANCH_NODE_HEIGHT = 50;

interface LayoutNode {
  id: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

/**
 * Simple radial auto-layout that preserves the center+branch+idea hierarchy.
 * Does not require dagre — uses built-in radial positioning.
 */
export function useAutoLayout() {
  const autoLayout = useCallback(
    (nodes: Node[], edges: Edge[]): Node[] => {
      const centerNode = nodes.find((n) => n.id === 'root');
      const branchNodes = nodes.filter((n) => n.id.startsWith('branch-'));
      const ideaNodes = nodes.filter(
        (n) => n.id !== 'root' && !n.id.startsWith('branch-')
      );

      if (!centerNode) return nodes;

      const branchRadius = 320;
      const ideaRadius = 200;
      const branchCount = branchNodes.length;
      const angleStep = (2 * Math.PI) / Math.max(branchCount, 1);

      const positioned = new Map<string, { x: number; y: number }>();
      positioned.set('root', { x: 0, y: 0 });

      // Position branches in a circle
      branchNodes.forEach((bn, i) => {
        const angle = angleStep * i - Math.PI / 2;
        const x = Math.cos(angle) * branchRadius - BRANCH_NODE_WIDTH / 2;
        const y = Math.sin(angle) * branchRadius - BRANCH_NODE_HEIGHT / 2;
        positioned.set(bn.id, { x, y });
      });

      // Group ideas by their parent branch
      const branchChildren: Record<string, Node[]> = {};
      for (const idea of ideaNodes) {
        const parentEdge = edges.find(
          (e) => e.target === idea.id && e.source.startsWith('branch-')
        );
        const parentBranch = parentEdge?.source || 'branch-options';
        if (!branchChildren[parentBranch]) branchChildren[parentBranch] = [];
        branchChildren[parentBranch].push(idea);
      }

      // Position ideas radiating outward from their branch
      for (const [branchId, children] of Object.entries(branchChildren)) {
        const branchPos = positioned.get(branchId);
        if (!branchPos) continue;

        const branchIdx = branchNodes.findIndex((n) => n.id === branchId);
        const branchAngle = angleStep * branchIdx - Math.PI / 2;
        const count = children.length;
        const fanSpan = Math.min(Math.PI * 0.8, count * 0.4);

        children.forEach((child, idx) => {
          const childAngle =
            branchAngle +
            (idx - (count - 1) / 2) * (fanSpan / Math.max(count - 1, 1));
          const cx =
            branchPos.x +
            BRANCH_NODE_WIDTH / 2 +
            Math.cos(childAngle) * ideaRadius -
            NODE_WIDTH / 2;
          const cy =
            branchPos.y +
            BRANCH_NODE_HEIGHT / 2 +
            Math.sin(childAngle) * ideaRadius -
            NODE_HEIGHT / 2;
          positioned.set(child.id, { x: cx, y: cy });
        });
      }

      // Ideas not connected to any branch — place in a grid below
      const orphans = ideaNodes.filter(
        (n) => !positioned.has(n.id)
      );
      orphans.forEach((orphan, idx) => {
        const col = idx % 4;
        const row = Math.floor(idx / 4);
        positioned.set(orphan.id, {
          x: -300 + col * (NODE_WIDTH + 20),
          y: branchRadius + 200 + row * (NODE_HEIGHT + 20),
        });
      });

      return nodes.map((n) => {
        const pos = positioned.get(n.id);
        if (!pos) return n;
        return { ...n, position: { x: pos.x, y: pos.y } };
      });
    },
    []
  );

  return { autoLayout };
}
