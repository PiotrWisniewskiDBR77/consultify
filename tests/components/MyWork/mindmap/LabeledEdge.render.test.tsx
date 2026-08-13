/**
 * Regression guard for the E02-N5-EDGE ledger bug: "Change line style" showed
 * a success toast but never visually changed the line, because the mutation
 * (useMindMapQuickActions.ts's mm_edge_cycle_style) wrote
 * `style.strokeDasharray` while the renderer (`mindmap/LabeledEdge.tsx`)
 * computed strokeDasharray purely from `data.edgeStyle`.
 *
 * The bus-receiver tests in `useMindMapQuickActions.edgeBus.test.tsx` only
 * assert the mutated *data object* — they would pass even if the renderer
 * still ignored it. This file closes that gap by rendering the REAL
 * `LabeledEdge` component and reading the actual `<path>` SVG attribute the
 * browser would paint, for every edge shape the mutation can now produce
 * (and for the legacy pre-fix shape already-saved maps may still carry).
 */
import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@reactflow/core', () => ({
  getSmoothStepPath: () => ['M0,0 L10,10', 5, 5],
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { LabeledEdge } from '../../../../src/components/MyWork/mindmap/LabeledEdge';

const baseProps = {
  id: 'edge-under-test',
  sourceX: 0,
  sourceY: 0,
  targetX: 10,
  targetY: 10,
  sourcePosition: 'right' as any,
  targetPosition: 'left' as any,
  markerEnd: undefined,
  selected: false,
};

/** Renders LabeledEdge inside an <svg> (required host for <path>/<defs>) and
 * returns the main visible stroke path — the second <path> in DOM order
 * (first is the invisible wide hit-area for right-click). */
function renderMainPath(data: Record<string, unknown>, style: Record<string, unknown> = {}) {
  const { container } = render(
    <svg>
      <LabeledEdge {...(baseProps as any)} data={data} style={style} />
    </svg>
  );
  const paths = container.querySelectorAll('path');
  // paths[0] = invisible hit area, paths[1] = the actual drawn stroke.
  return paths[1] as SVGPathElement;
}

describe('LabeledEdge (Mind Map) — renders what mm_edge_cycle_style actually writes', () => {
  it('data.edgeStyle: "dashed" draws a dashed stroke (8 4)', () => {
    const path = renderMainPath({ edgeStyle: 'dashed' });
    expect(path.getAttribute('stroke-dasharray')).toBe('8 4');
  });

  it('data.edgeStyle: "dotted" draws a dotted stroke (2 4)', () => {
    const path = renderMainPath({ edgeStyle: 'dotted' });
    expect(path.getAttribute('stroke-dasharray')).toBe('2 4');
  });

  it('data.edgeStyle: "solid" (or absent) draws a solid stroke — no dasharray attribute', () => {
    expect(renderMainPath({ edgeStyle: 'solid' }).getAttribute('stroke-dasharray')).toBeNull();
    expect(renderMainPath({}).getAttribute('stroke-dasharray')).toBeNull();
  });

  it('full cycle solid → dashed → dotted → solid each visibly changes the drawn stroke', () => {
    const solid = renderMainPath({ edgeStyle: 'solid' }).getAttribute('stroke-dasharray');
    const dashed = renderMainPath({ edgeStyle: 'dashed' }).getAttribute('stroke-dasharray');
    const dotted = renderMainPath({ edgeStyle: 'dotted' }).getAttribute('stroke-dasharray');
    const backToSolid = renderMainPath({ edgeStyle: 'solid' }).getAttribute('stroke-dasharray');
    expect([solid, dashed, dotted]).toEqual([null, '8 4', '2 4']);
    expect(backToSolid).toBe(solid);
  });

  it('migration fallback: an edge persisted with only legacy style.strokeDasharray "5 5" still renders dashed', () => {
    const path = renderMainPath({}, { strokeDasharray: '5 5' });
    expect(path.getAttribute('stroke-dasharray')).toBe('8 4');
  });

  it('migration fallback: legacy style.strokeDasharray "2 2" still renders dotted', () => {
    const path = renderMainPath({}, { strokeDasharray: '2 2' });
    expect(path.getAttribute('stroke-dasharray')).toBe('2 4');
  });

  it('data.edgeStyle wins over a stale legacy style.strokeDasharray when both are present', () => {
    const path = renderMainPath({ edgeStyle: 'dotted' }, { strokeDasharray: '5 5' });
    expect(path.getAttribute('stroke-dasharray')).toBe('2 4');
  });
});
