/**
 * N5 kontynuacja (2026-08-09) — `PaneContextMenu.tsx`'s 13 menu items now each
 * have a registry entry (`idea.view.*`/`idea.ai.suggest_nodes`,
 * `tests/components/MyWork/useMindMapQuickActions.edgeBus.test.tsx` is the
 * template this file follows). Unlike the edge menu (which dropped `onAction`
 * entirely), the pane menu keeps `ctx.params.run` as the human-click path
 * (`IdeaRecommendationMap.handlePaneContextAction`, untouched) — the registry
 * only adds a SECOND path for Teresa (`ctx.source === 'teresa'`, no `run`),
 * reusing existing `useMindMapQuickActions.ts` receivers for 9 of 13 items
 * (one, `mm_select_all`, is newly added by this same change) and honestly
 * declining for the 3 clipboard items.
 *
 * This file proves the Teresa path for real: a caller with no menu instance
 * and no component closure — just `runIdeaAction(id, teresaCtx)` — reaches
 * the actual mutation/read through the `idea-workspace-quick-action` bus.
 */
import { act, render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { runIdeaAction, type ActionContext } from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';

import { useMindMapQuickActions } from '../../../src/components/MyWork/mindmap/useMindMapQuickActions';

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
  const fitView = vi.fn();

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
      handlers: { pushUndo, fitView } as any,
      setters: { setEdges, setNodes } as any,
    });
    return null;
  };

  return {
    Harness,
    setEdges,
    setNodes,
    pushUndo,
    fitView,
    getEdges: () => edges,
    getNodes: () => nodes,
  };
}

function teresaCtx(overrides?: Partial<ActionContext>): ActionContext {
  return {
    ideaId: 'idea-1',
    tool: 'mindmap',
    selection: EMPTY_SELECTION,
    surface: 'context',
    source: 'teresa',
    ...overrides,
  };
}

describe('Mind Map pane (background) actions — real dispatch-bus receiver (N5)', () => {
  it('idea.view.select_all: no menu, no component closure — selects every node and calls setNodes (NEW receiver, mm_select_all)', async () => {
    const h = makeHarness();
    render(
      <h.Harness
        initialEdges={[]}
        initialNodes={[
          { id: 'root', selected: false, position: { x: 0, y: 0 } },
          { id: 'n1', selected: false, position: { x: 100, y: 0 } },
          { id: 'n2', selected: false, position: { x: 200, y: 0 } },
        ]}
      />
    );

    const result = await act(async () => runIdeaAction('idea.view.select_all', teresaCtx()));

    expect(result.ok).toBe(true);
    expect((result.data as any)?.runtime).toBe('mm_select_all');
    expect(h.setNodes).toHaveBeenCalledTimes(1);
    expect(h.getNodes().every((n: any) => n.selected === true)).toBe(true);
  });

  it('idea.view.fit_view: reuses the existing mm_fit_view receiver and calls handlers.fitView', async () => {
    const h = makeHarness();
    render(<h.Harness initialEdges={[]} initialNodes={[]} />);

    const result = await act(async () => runIdeaAction('idea.view.fit_view', teresaCtx()));

    expect(result.ok).toBe(true);
    expect((result.data as any)?.runtime).toBe('mm_fit_view');
    expect(h.fitView).toHaveBeenCalledTimes(1);
    expect(h.fitView).toHaveBeenCalledWith({ padding: 0.3, duration: 400 });
  });

  it('idea.view.auto_cluster: reuses the existing mm_auto_cluster receiver, groups orphan nodes into clusters, and calls pushUndo', async () => {
    const h = makeHarness();
    render(
      <h.Harness
        initialEdges={[
          { id: 'e-root-a', source: 'root', target: 'risk-1', data: {} },
          { id: 'e-root-b', source: 'root', target: 'action-1', data: {} },
        ]}
        initialNodes={[
          { id: 'root', type: 'idea', position: { x: 0, y: 0 }, data: { label: 'Root' } },
          {
            id: 'risk-1',
            type: 'idea',
            position: { x: 100, y: 0 },
            data: { label: 'Budget risk' },
          },
          {
            id: 'action-1',
            type: 'idea',
            position: { x: 200, y: 0 },
            data: { label: 'Ship the action item' },
          },
        ]}
      />
    );

    const result = await act(async () => runIdeaAction('idea.view.auto_cluster', teresaCtx()));

    expect(result.ok).toBe(true);
    expect((result.data as any)?.runtime).toBe('mm_auto_cluster');
    expect(h.pushUndo).toHaveBeenCalledTimes(1);
    // Two new branch nodes (risks/actions), on top of the 3 originals.
    expect(h.getNodes().filter((n: any) => n.type === 'branch')).toHaveLength(2);
  });

  it('idea.view.copy_selection: declines with a clear, honest message — no UI `run` closure and no bus receiver exists (clipboard is browser-local state)', async () => {
    const h = makeHarness();
    render(<h.Harness initialEdges={[]} initialNodes={[]} />);

    const result = await act(async () => runIdeaAction('idea.view.copy_selection', teresaCtx()));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/menu kontekstowego|prawy klik/i);
    expect(h.setNodes).not.toHaveBeenCalled();
    expect(h.setEdges).not.toHaveBeenCalled();
  });

  it('idea.view.fit_view: a UI click (ctx.params.run present) takes the human click-path instead of the bus, unchanged from before the migration', async () => {
    const h = makeHarness();
    render(<h.Harness initialEdges={[]} initialNodes={[]} />);
    const run = vi.fn();

    const result = await act(async () =>
      runIdeaAction('idea.view.fit_view', {
        ideaId: '',
        tool: 'mindmap',
        selection: EMPTY_SELECTION,
        surface: 'context',
        source: 'ui',
        params: { run },
      })
    );

    expect(result.ok).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    // The bus/hook receiver must NOT have fired — the click path is exclusive.
    expect(h.fitView).not.toHaveBeenCalled();
  });
});
