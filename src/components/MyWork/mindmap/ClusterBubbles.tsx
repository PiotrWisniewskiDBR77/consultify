/**
 * ClusterBubbles — Semi-transparent background bubbles grouping branches.
 * Rendered as an SVG overlay behind nodes.
 */
import React, { useMemo } from 'react';

const BUBBLE_COLORS: Record<string, string> = {
  problem: 'rgba(251, 113, 133, 0.06)',
  goal: 'rgba(52, 211, 153, 0.06)',
  options: 'rgba(251, 191, 36, 0.06)',
  evidence: 'rgba(56, 189, 248, 0.06)',
  risks: 'rgba(167, 139, 250, 0.06)',
  experiments: 'rgba(34, 211, 238, 0.06)',
  plan: 'rgba(96, 165, 250, 0.06)',
  strengths: 'rgba(52, 211, 153, 0.06)',
  weaknesses: 'rgba(251, 113, 133, 0.06)',
  opportunities: 'rgba(251, 191, 36, 0.06)',
  threats: 'rgba(167, 139, 250, 0.06)',
};

const BUBBLE_STROKE: Record<string, string> = {
  problem: 'rgba(251, 113, 133, 0.12)',
  goal: 'rgba(52, 211, 153, 0.12)',
  options: 'rgba(251, 191, 36, 0.12)',
  evidence: 'rgba(56, 189, 248, 0.12)',
  risks: 'rgba(167, 139, 250, 0.12)',
  experiments: 'rgba(34, 211, 238, 0.12)',
  plan: 'rgba(96, 165, 250, 0.12)',
  strengths: 'rgba(52, 211, 153, 0.12)',
  weaknesses: 'rgba(251, 113, 133, 0.12)',
  opportunities: 'rgba(251, 191, 36, 0.12)',
  threats: 'rgba(167, 139, 250, 0.12)',
};

interface ClusterBubblesProps {
  nodes: Array<{ id: string; position: { x: number; y: number }; data: any }>;
  edges: Array<{ source: string; target: string }>;
  enabled: boolean;
}

interface Cluster {
  branchKey: string;
  cx: number;
  cy: number;
  radius: number;
}

export const ClusterBubbles: React.FC<ClusterBubblesProps> = ({ nodes, edges, enabled }) => {
  const clusters = useMemo((): Cluster[] => {
    if (!enabled) return [];

    const branchNodes = nodes.filter((n) => n.id.startsWith('branch-'));
    const result: Cluster[] = [];

    for (const bn of branchNodes) {
      const bk = bn.data?.branchKey || '';
      const childIds = edges.filter((e) => e.source === bn.id).map((e) => e.target);
      const childNodes = nodes.filter((n) => childIds.includes(n.id));

      if (childNodes.length === 0) continue;

      const allNodes = [bn, ...childNodes];
      const xs = allNodes.map((n) => n.position.x);
      const ys = allNodes.map((n) => n.position.y);

      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const maxDist = Math.max(
        ...allNodes.map((n) => Math.sqrt((n.position.x - cx) ** 2 + (n.position.y - cy) ** 2))
      );
      const radius = Math.max(80, maxDist + 60);

      result.push({ branchKey: bk, cx, cy, radius });
    }

    return result;
  }, [edges, enabled, nodes]);

  if (!enabled || clusters.length === 0) return null;

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: -1 }}>
      {clusters.map((c) => (
        <ellipse
          key={c.branchKey}
          cx={c.cx}
          cy={c.cy}
          rx={c.radius}
          ry={c.radius * 0.8}
          fill={BUBBLE_COLORS[c.branchKey] || 'rgba(148, 163, 184, 0.04)'}
          stroke={BUBBLE_STROKE[c.branchKey] || 'rgba(148, 163, 184, 0.08)'}
          strokeWidth={1}
          className="transition-all duration-500"
        />
      ))}
    </svg>
  );
};

export default ClusterBubbles;
