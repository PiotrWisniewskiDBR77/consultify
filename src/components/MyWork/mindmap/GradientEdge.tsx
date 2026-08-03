/**
 * GradientEdge — V5-IDEA-44 Living edge with gradient colors, selection pulse,
 * hover thickness, directional particles, and dark-mode neon glow.
 */
// @ts-ignore reactflow version mismatch
import { getBezierPath } from '@reactflow/core';
import React from 'react';
import { type EdgeProps } from 'reactflow';

import {
  arrowMarkerAttrs,
  EdgeArrowMarkers,
  resolveArrowDirection,
} from '../canvas/edgeArrowMarkers';

// Branch edge colors = DATA (categorical). Mapped onto the canonical identity
// palette (--c-tag-1..12) + status tokens so edges stay on-brand and theme-aware.
// CSS-var strings resolve in SVG stroke / gradient stop-color attributes.
const BRANCH_EDGE_COLORS: Record<string, string> = {
  problem: 'var(--c-danger)',
  goal: 'var(--c-success)',
  options: 'var(--c-warning)',
  evidence: 'var(--c-tag-1)',
  risks: 'var(--c-tag-3)',
  experiments: 'var(--c-tag-6)',
  plan: 'var(--c-tag-10)',
  strengths: 'var(--c-success)',
  weaknesses: 'var(--c-danger)',
  opportunities: 'var(--c-warning)',
  threats: 'var(--c-tag-3)',
  uncategorized: 'var(--c-tag-8)',
};

function getColor(branchKey?: string): string {
  return BRANCH_EDGE_COLORS[branchKey || ''] || 'var(--c-tag-8)';
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
  selected,
}) => {
  const sourceBranch = data?.sourceBranch || data?.branchKey || '';
  const targetBranch = data?.targetBranch || data?.branchKey || '';
  const sourceColor = getColor(sourceBranch);
  const targetColor = getColor(targetBranch);
  // Strzałka kierunku przepływu (wspólny model z Przepływem procesu — patrz
  // canvas/edgeArrowMarkers.tsx). Domyślnie 'none': mapa myśli to hierarchia,
  // strzałki są świadomym wyborem użytkownika, nie stanem startowym.
  const arrowDirection = resolveArrowDirection(data?.arrowDirection, 'none');
  const arrowAttrs = arrowMarkerAttrs(id, arrowDirection);
  const isAnimated = data?.animated !== false;
  const showParticles = data?.showParticles;

  const baseWidth = (style?.strokeWidth as number) || 2;
  const activeWidth = selected ? baseWidth + 1.5 : baseWidth;
  const baseOpacity = (style?.opacity as number) || 0.7;
  const activeOpacity = selected ? Math.min(baseOpacity + 0.2, 1) : baseOpacity;

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
  const pulseId = `pulse-${id}`;

  return (
    <g className="group/edge">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={sourceColor} stopOpacity={0.8} />
          <stop offset="100%" stopColor={targetColor} stopOpacity={0.8} />
        </linearGradient>
        <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={selected ? 3 : 2} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Groty kierunku — osobne `<defs>`, bo kolor grotu bierze literalny
          token gałęzi (gradient `url(#…)` nie jest dozwolony jako `fill`
          markera i dawałby czarny trójkąt). Koniec = kolor celu, początek =
          kolor źródła, więc grot zawsze zgadza się z barwą swojego końca. */}
      <EdgeArrowMarkers
        edgeId={id}
        direction={arrowDirection}
        color={targetColor}
        colorStart={sourceColor}
      />

      {/* Invisible wide hit area for hover + right-click */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          window.dispatchEvent(
            new CustomEvent('mindmap-edge-contextmenu', {
              detail: {
                edgeId: id,
                isUserCreated: !!data?.userCreated,
                x: e.clientX,
                y: e.clientY,
              },
            })
          );
        }}
      />

      {/* Glow layer */}
      <path
        d={edgePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={activeWidth}
        strokeOpacity={selected ? 0.5 : 0.3}
        filter={`url(#${filterId})`}
        className="dark:opacity-60 opacity-0 transition-opacity duration-200 group-hover/edge:opacity-40 dark:group-hover/edge:opacity-70"
      />

      {/* Selection pulse ring */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={activeWidth + 4}
          strokeLinecap="round"
          className="animate-pulse"
          strokeOpacity={0.15}
        />
      )}

      {/* Main edge */}
      <path
        d={edgePath}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={activeWidth}
        strokeOpacity={activeOpacity}
        strokeLinecap="round"
        markerStart={arrowAttrs.markerStart}
        markerEnd={arrowAttrs.markerEnd ?? markerEnd}
        className="transition-all duration-200 group-hover/edge:[stroke-width:var(--hover-w)]"
        style={{ '--hover-w': `${activeWidth + 1}px` } as React.CSSProperties}
      />

      {/* Animated directional dash */}
      {isAnimated && (
        <path
          d={edgePath}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={activeWidth + 1}
          strokeOpacity={selected ? 0.45 : 0.3}
          strokeDasharray="6 12"
          strokeLinecap="round"
          className="animate-dash"
        />
      )}

      {/* Particle dots */}
      {showParticles && (
        <>
          <circle r={selected ? 3 : 2.5} fill={sourceColor} opacity={0.8}>
            <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} />
          </circle>
          <circle r={selected ? 2.5 : 2} fill={targetColor} opacity={0.6}>
            <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} begin="1.5s" />
          </circle>
        </>
      )}
    </g>
  );
};

export default GradientEdge;
