/**
 * E02 rozszerzenie na Mapę myśli (2026-08-09) — `EdgeContextMenu.tsx`'s 7 menu
 * items now go through the `idea.edge.*` action registry
 * (`getActionsForSurface`/`runIdeaAction`), mirroring the Whiteboard edge
 * pilot (`tests/components/MyWork/useWhiteboardQuickActions.edgeBus.test.tsx`
 * — read as the template for this file). Six of the seven items previously
 * had NO bus receiver at all (mutation logic lived in a closure inside
 * `IdeaRecommendationMap.tsx`'s `handleEdgeContextAction`, now deleted); one
 * (`edge_arrow_direction` → `mm_edge_arrow`) already had a real receiver
 * since 2026-07-28 and is REUSED here, not duplicated.
 *
 * Unlike Whiteboard, Mind Map's hook (`useMindMapQuickActions.ts`) has direct
 * access to raw `edges`/`nodes`/`setEdges`/`setNodes` — so there is no
 * `ctx.params.run` UI-passthrough here: BOTH a human click (via
 * `EdgeContextMenu.tsx`) and a Teresa call reach the mutation the same way,
 * addressed by `edgeId` alone. This file proves exactly that: a caller with
 * ONLY an edge id (no menu instance, no component closure) reaches the real
 * mutation through `runIdeaAction` → the `idea-workspace-quick-action` bus →
 * `useMindMapQuickActions.ts`.
 */
import { act, render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { runIdeaAction, type ActionContext } from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';

import { useMindMapQuickActions } from '../../../src/components/MyWork/mindmap/useMindMapQuickActions';

function relationEdge(id: string, overrides?: Record<string, unknown>) {
  return {
    id,
    source: 'n1',
    target: 'n2',
    sourceHandle: 'a',
    targetHandle: 'b',
    data: { edgeRole: 'relation', label: 'old-label', ...((overrides as any)?.data || {}) },
    ...overrides,
  };
}

function structuralEdge(id: string) {
  return { id, source: 'n1', target: 'n2', data: {} };
}

function makeHarness() {
  let edges: any[] = [];
  let nodes: any[] = [];
  const setEdges = vi.fn((updater: any) => {
    edges = typeof updater === 'function' ? updater(edges) : updater;
  });
  const setNodes = vi.fn((updater: any) => {
    nodes = typeof updater === 'function' ? updater(nodes) : updater;
  });
  const pushUndo = vi.fn();

  const Harness: React.FC<{ initialEdges: any[]; initialNodes?: any[] }> = ({
    initialEdges,
    initialNodes = [],
  }) => {
    edges = initialEdges;
    nodes = initialNodes;
    useMindMapQuickActions({
      ideaId: 'idea-1',
      ideaTitle: 'Test idea',
      isPolish: false,
      locked: false,
      nodes,
      edges,
      layoutMode: 'tree',
      handlers: { pushUndo } as any,
      setters: { setEdges, setNodes } as any,
    });
    return null;
  };

  return { Harness, setEdges, setNodes, pushUndo, getEdges: () => edges, getNodes: () => nodes };
}

function teresaCtx(overrides?: Partial<ActionContext>): ActionContext {
  return {
    ideaId: 'idea-1',
    tool: 'mindmap',
    selection: EMPTY_SELECTION,
    surface: 'panel',
    source: 'teresa',
    ...overrides,
  };
}

describe('Mind Map edge actions — real dispatch-bus receiver (E02 mindmap extension)', () => {
  it('idea.edge.reverse: edgeId alone (no menu, no component closure) reverses a relation edge and calls pushUndo', async () => {
    const h = makeHarness();
    render(<h.Harness initialEdges={[relationEdge('edge-1')]} />);

    const result = await act(async () =>
      runIdeaAction('idea.edge.reverse', teresaCtx({ params: { edgeId: 'edge-1' } }))
    );

    expect(result.ok).toBe(true);
    expect(h.pushUndo).toHaveBeenCalledTimes(1);
    const edge = h.getEdges().find((e: any) => e.id === 'edge-1');
    expect(edge.source).toBe('n2');
    expect(edge.target).toBe('n1');
  });

  it('idea.edge.reverse: silently no-ops on a structural (non-relation) edge — same gate as the pre-migration menu', async () => {
    const h = makeHarness();
    render(<h.Harness initialEdges={[structuralEdge('edge-2')]} />);

    const result = await act(async () =>
      runIdeaAction('idea.edge.reverse', teresaCtx({ params: { edgeId: 'edge-2' } }))
    );

    expect(result.ok).toBe(true);
    expect(h.pushUndo).not.toHaveBeenCalled();
    expect(h.setEdges).not.toHaveBeenCalled();
  });

  it('idea.edge.delete: edgeId alone removes a relation edge and calls pushUndo', async () => {
    const h = makeHarness();
    render(<h.Harness initialEdges={[relationEdge('edge-3'), relationEdge('edge-4')]} />);

    const result = await act(async () =>
      runIdeaAction('idea.edge.delete', teresaCtx({ params: { edgeId: 'edge-3' } }))
    );

    expect(result.ok).toBe(true);
    expect(h.pushUndo).toHaveBeenCalledTimes(1);
    expect(h.getEdges().map((e: any) => e.id)).toEqual(['edge-4']);
  });

  it('idea.edge.cycle_style: edgeId alone cycles solid → dashed and calls pushUndo (no relation gate — applies to any edge)', async () => {
    // Regression guard for the "Change line style" bug (E02-N5-EDGE ledger
    // entry): the mutation used to write style.strokeDasharray, but
    // LabeledEdge.tsx renders strokeDasharray purely from data.edgeStyle —
    // so the toast said "Style: dashed" but the line never visually
    // changed. Canonical representation is now data.edgeStyle; assert THAT
    // field, not the dead style.strokeDasharray one, so this test would have
    // caught the original bug.
    const h = makeHarness();
    render(<h.Harness initialEdges={[structuralEdge('edge-5')]} />);

    const result = await act(async () =>
      runIdeaAction('idea.edge.cycle_style', teresaCtx({ params: { edgeId: 'edge-5' } }))
    );

    expect(result.ok).toBe(true);
    expect(h.pushUndo).toHaveBeenCalledTimes(1);
    expect(h.getEdges()[0].data.edgeStyle).toBe('dashed');
  });

  it('idea.edge.cycle_style: full solid → dashed → dotted → solid cycle updates data.edgeStyle each step', async () => {
    const h = makeHarness();
    // The harness closes over `edges` at each render, and the hook's event
    // listener reads the latest `edges` via a ref reassigned every render
    // (quickActionRef.current, see useMindMapQuickActions.ts:233) — so each
    // subsequent action needs a `rerender` with the just-mutated edges fed
    // back in, the same way the real IdeaRecommendationMap re-render would.
    const { rerender } = render(<h.Harness initialEdges={[structuralEdge('edge-5b')]} />);

    await act(async () =>
      runIdeaAction('idea.edge.cycle_style', teresaCtx({ params: { edgeId: 'edge-5b' } }))
    );
    expect(h.getEdges()[0].data.edgeStyle).toBe('dashed');

    rerender(<h.Harness initialEdges={h.getEdges()} />);
    await act(async () =>
      runIdeaAction('idea.edge.cycle_style', teresaCtx({ params: { edgeId: 'edge-5b' } }))
    );
    expect(h.getEdges()[0].data.edgeStyle).toBe('dotted');

    rerender(<h.Harness initialEdges={h.getEdges()} />);
    await act(async () =>
      runIdeaAction('idea.edge.cycle_style', teresaCtx({ params: { edgeId: 'edge-5b' } }))
    );
    expect(h.getEdges()[0].data.edgeStyle).toBe('solid');
  });

  it('idea.edge.cycle_style: migration-safe — an edge persisted with only the legacy style.strokeDasharray shape still cycles from its real current state', async () => {
    // Simulates an already-saved map from before this fix: the mutation had
    // written style.strokeDasharray: '5 5' (dashed) but data.edgeStyle was
    // never set. Cycling must read the legacy shape as "dashed" and advance
    // to "dotted", not treat the edge as solid and restart the cycle.
    const h = makeHarness();
    render(
      <h.Harness
        initialEdges={[{ ...structuralEdge('edge-5c'), style: { strokeDasharray: '5 5' } }]}
      />
    );

    const result = await act(async () =>
      runIdeaAction('idea.edge.cycle_style', teresaCtx({ params: { edgeId: 'edge-5c' } }))
    );

    expect(result.ok).toBe(true);
    expect(h.getEdges()[0].data.edgeStyle).toBe('dotted');
  });

  it('idea.edge.edit_label: explicit `label` param (Teresa-style) skips window.prompt, sets the label, and calls pushUndo', async () => {
    const h = makeHarness();
    const promptSpy = vi.spyOn(window, 'prompt');
    render(<h.Harness initialEdges={[relationEdge('edge-6')]} />);

    const result = await act(async () =>
      runIdeaAction(
        'idea.edge.edit_label',
        teresaCtx({ params: { edgeId: 'edge-6', label: 'depends on' } })
      )
    );

    expect(result.ok).toBe(true);
    expect(promptSpy).not.toHaveBeenCalled();
    expect(h.pushUndo).toHaveBeenCalledTimes(1);
    expect(h.getEdges()[0].data.label).toBe('depends on');
    promptSpy.mockRestore();
  });

  it('idea.edge.edit_relation: explicit `relation` param sets data.relation+label on a relation edge and calls pushUndo (mindmap-only action)', async () => {
    const h = makeHarness();
    const promptSpy = vi.spyOn(window, 'prompt');
    render(<h.Harness initialEdges={[relationEdge('edge-7')]} />);

    const result = await act(async () =>
      runIdeaAction(
        'idea.edge.edit_relation',
        teresaCtx({ params: { edgeId: 'edge-7', relation: 'blocks' } })
      )
    );

    expect(result.ok).toBe(true);
    expect(promptSpy).not.toHaveBeenCalled();
    expect(h.pushUndo).toHaveBeenCalledTimes(1);
    expect(h.getEdges()[0].data.relation).toBe('blocks');
    expect(h.getEdges()[0].data.label).toBe('blocks');
    promptSpy.mockRestore();
  });

  it('idea.edge.insert_node: edgeId alone splits a relation edge into two and adds a node, calling pushUndo (mindmap-only action)', async () => {
    const h = makeHarness();
    render(
      <h.Harness
        initialEdges={[relationEdge('edge-8')]}
        initialNodes={[
          { id: 'n1', position: { x: 0, y: 0 } },
          { id: 'n2', position: { x: 100, y: 100 } },
        ]}
      />
    );

    const result = await act(async () =>
      runIdeaAction('idea.edge.insert_node', teresaCtx({ params: { edgeId: 'edge-8' } }))
    );

    expect(result.ok).toBe(true);
    expect(h.pushUndo).toHaveBeenCalledTimes(1);
    expect(h.getEdges()).toHaveLength(2);
    expect(h.getEdges().find((e: any) => e.id === 'edge-8')).toBeUndefined();
    expect(h.getNodes()).toHaveLength(3);
  });

  it('idea.edge.cycle_arrow: reuses the existing mm_edge_arrow receiver (no new event invented) and cycles the arrow via edgeId alone', async () => {
    const h = makeHarness();
    render(<h.Harness initialEdges={[relationEdge('edge-9')]} />);

    const result = await act(async () =>
      runIdeaAction('idea.edge.cycle_arrow', teresaCtx({ params: { edgeId: 'edge-9' } }))
    );

    expect(result.ok).toBe(true);
    expect((result.data as any)?.runtime).toBe('mm_edge_arrow');
    expect(h.getEdges()[0].data.arrowDirection).toBe('end');
  });

  it('declines with a clear message when neither ctx.params.edgeId nor a selected edge is available', async () => {
    const h = makeHarness();
    render(<h.Harness initialEdges={[relationEdge('edge-10')]} />);

    const result = await act(async () => runIdeaAction('idea.edge.reverse', teresaCtx()));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/połączeni/i);
    expect(h.pushUndo).not.toHaveBeenCalled();
  });
});
