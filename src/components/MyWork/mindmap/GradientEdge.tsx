/**
 * GradientEdge — Custom React Flow edge with gradient colors between branches.
 * Supports particle flow animation and neon glow in dark mode.
 */
import React, { useMemo } from 'react';
import { type EdgeProps } from 'reactflow';
// @ts-ignore reactflow version mismatch
import { getBezierPath } from '@reactflow/core';

const BRANCH_EDGE_COLORS: Record<string, string> = {
  problem: '#fb7185',
  goal: '#34d399',
  options: '#fbbf24',
  evidence: '#38bdf8',
  risks: '#a78bfa',
  experiments: '#22d3ee',
  plan: '#60a5fa',
  strengths: '#34d399',
  weaknesses: '#fb7185',
  opportunities: '#fbbf24',
  threats: '#a78bfa',
  uncategorized: '#94a3b8',
};

function getColor(branchKey?: string): string {
  return BRANCH_EDGE_COLORS[branchKey || ''] || '#94a3b8';
}

export const GradientEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  markerEnd,
}) => {
  const sourceBranch = data?.sourceBranch || data?.branchKey || '';
  const targetBranch = data?.targetBranch || data?.branchKey || '';
  const sourceColor = getColor(sourceBranch);
  const targetColor = getColor(targetBranch);
  const isAnimated = data?.animated !== false;
  const showParticles = data?.showParticles;

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const gradientId = `gradient-${id}`;
  const filterId = `glow-${id}`;

  return (
    <>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={sourceColor} stopOpacity={0.8} />
          <stop offset="100%" stopColor={targetColor} stopOpacity={0.8} />
        </linearGradient>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Glow layer (dark mode neon effect) */}
      <path
        d={edgePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={(style?.strokeWidth as number) || 2}
        strokeOpacity={0.3}
        filter={`url(#${filterId})`}
        className="dark:opacity-60 opacity-0 transition-opacity"
      />

      {/* Main edge */}
      <path
        d={edgePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={(style?.strokeWidth as number) || 2}
        strokeOpacity={style?.opacity as number || 0.7}
        strokeLinecap="round"
        markerEnd={markerEnd}
        className="transition-all duration-300"
      />

      {/* Animated dash for flow direction */}
      {isAnimated && (
        <path
          d={edgePath}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={((style?.strokeWidth as number) || 2) + 1}
          strokeOpacity={0.3}
          strokeDasharray="6 12"
          strokeLinecap="round"
          className="animate-dash"
        />
      )}

      {/* Particle dots along the path */}
      {showParticles && (
        <>
          <circle r="2.5" fill={sourceColor} opacity={0.8}>
            <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} />
          </circle>
          <circle r="2" fill={targetColor} opacity={0.6}>
            <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} begin="1.5s" />
          </circle>
        </>
      )}
    </>
  );
};

export default GradientEdge;
