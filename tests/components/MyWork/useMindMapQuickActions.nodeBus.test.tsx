/**
 * N5 kontynuacja, druga fala (2026-08-09) — `NodeContextMenu.tsx`'s Edit +
 * Structure + Delete groups (15 of ~44-45 items; AI/Convert/Convert branch/
 * Style & data groups untouched, separate future passes) now have a
 * corresponding `idea.node.mm_*` action registry entry
 * (`tests/components/MyWork/useMindMapQuickActions.paneBus.test.tsx` is the
 * template this file follows).
 *
 * Unlike the pane menu (where every one of the 13 items reused a pre-existing
 * or trivially-added receiver), three of these — `mm_connect_nodes`,
 * `mm_detach_branch`, `mm_duplicate_branch` — are BRAND NEW receivers added by
 * this same change, and `mm_toggle_collapse` had an honest correctness fix
 * (it now prefers an explicit target nodeId over whatever happens to be
 * selected). This file proves the Teresa path for real: a caller with no menu
 * instance and no component closure — just `runIdeaAction(id, teresaCtx)` —
 * reaches the actual mutation/read through the `idea-workspace-quick-action`
 * bus.
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
  const addChildNode = vi.fn();
  const toggleCollapse = vi.fn();
  const getSelectedNode = vi.fn(() => undefined as any);
  const detachBranch = vi.fn();
  const duplicateBranch = vi.fn();

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
      handlers: {
        pushUndo,
        addChildNode,
        toggleCollapse,
        getSelectedNode,
        detachBranch,
        duplicateBranch,
      } as any,
      setters: { setEdges, setNodes } as any,
    });
    return null;
  };

  return {
    Harness,
    setEdges,
    setNodes,
    pushUndo,
    addChildNode,
    toggleCollapse,
    getSelectedNode,
    detachBranch,
    duplicateBranch,
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

describe('Mind Map node (right-click) actions — real dispatch-bus receiver (N5, druga fala)', () => {
  it('idea.node.mm_add_child: no menu, no component closure — reaches handlers.addChildNode with the given nodeId/label', async () => {
    const h = makeHarness();
    render(<h.Harness initialEdges={[]} initialNodes={[]} />);

    const result = await act(async () =>
      runIdeaAction(
        'idea.node.mm_add_child',
        teresaCtx({ params: { nodeId: 'n1', label: 'New child' } })
      )
    );

    expect(result.ok).toBe(true);
    expect((result.data as any)?.runtime).toBe('mm_add_child');
    expect(h.addChildNode).toHaveBeenCalledTimes(1);
    expect(h.addChildNode).toHaveBeenCalledWith('n1', 'New child');
  });

  it('idea.node.mm_toggle_collapse: honest fix — prefers the explicit nodeId over getSelectedNode()', async () => {
    const h = makeHarness();
    // Selected node is 'wrong' — proves the receiver no longer blindly
    // defers to selection when an explicit target is given.
    h.getSelectedNode.mockReturnValue({ id: 'wrong-node' } as any);
    render(<h.Harness initialEdges={[]} initialNodes={[]} />);

    const result = await act(async () =>
      runIdeaAction('idea.node.mm_toggle_collapse', teresaCtx({ params: { nodeId: 'n1' } }))
    );

    expect(result.ok).toBe(true);
    expect(h.toggleCollapse).toHaveBeenCalledTimes(1);
    expect(h.toggleCollapse).toHaveBeenCalledWith('n1');
  });

  it('idea.node.mm_toggle_collapse: falls back to getSelectedNode() when no explicit nodeId is given', async () => {
    const h = makeHarness();
    h.getSelectedNode.mockReturnValue({ id: 'sel-1' } as any);
    render(<h.Harness initialEdges={[]} initialNodes={[]} />);

    await act(async () => runIdeaAction('idea.node.mm_toggle_collapse', teresaCtx()));

    expect(h.toggleCollapse).toHaveBeenCalledWith('sel-1');
  });

  it('idea.node.mm_connect_to_selected: NEW receiver — creates a relation edge between nodeId and targetNodeId, and calls pushUndo', async () => {
    const h = makeHarness();
    render(
      <h.Harness
        initialEdges={[]}
        initialNodes={[
          { id: 'n1', position: { x: 0, y: 0 } },
          { id: 'n2', position: { x: 100, y: 0 } },
        ]}
      />
    );

    const result = await act(async () =>
      runIdeaAction(
        'idea.node.mm_connect_to_selected',
        teresaCtx({ params: { nodeId: 'n1', targetNodeId: 'n2' } })
      )
    );

    expect(result.ok).toBe(true);
    expect((result.data as any)?.runtime).toBe('mm_connect_nodes');
    expect(h.pushUndo).toHaveBeenCalledTimes(1);
    expect(h.setEdges).toHaveBeenCalledTimes(1);
    const created = h.getEdges();
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      source: 'n1',
      target: 'n2',
      type: 'labeled',
      data: { userCreated: true, edgeRole: 'relation', relation: 'related' },
    });
  });

  it('idea.node.mm_connect_to_selected: declines silently (no mutation) when the target node does not exist', async () => {
    const h = makeHarness();
    render(<h.Harness initialEdges={[]} initialNodes={[{ id: 'n1', position: { x: 0, y: 0 } }]} />);

    await act(async () =>
      runIdeaAction(
        'idea.node.mm_connect_to_selected',
        teresaCtx({ params: { nodeId: 'n1', targetNodeId: 'does-not-exist' } })
      )
    );

    expect(h.pushUndo).not.toHaveBeenCalled();
    expect(h.setEdges).not.toHaveBeenCalled();
  });

  it('idea.node.mm_detach_branch: NEW receiver — forwards to handlers.detachBranch with the given nodeId', async () => {
    const h = makeHarness();
    render(<h.Harness initialEdges={[]} initialNodes={[]} />);

    const result = await act(async () =>
      runIdeaAction('idea.node.mm_detach_branch', teresaCtx({ params: { nodeId: 'n1' } }))
    );

    expect(result.ok).toBe(true);
    expect((result.data as any)?.runtime).toBe('mm_detach_branch');
    expect(h.detachBranch).toHaveBeenCalledTimes(1);
    expect(h.detachBranch).toHaveBeenCalledWith('n1');
  });

  it('idea.node.mm_duplicate_branch: NEW receiver — forwards to handlers.duplicateBranch with the given nodeId', async () => {
    const h = makeHarness();
    render(<h.Harness initialEdges={[]} initialNodes={[]} />);

    const result = await act(async () =>
      runIdeaAction('idea.node.mm_duplicate_branch', teresaCtx({ params: { nodeId: 'n1' } }))
    );

    expect(result.ok).toBe(true);
    expect((result.data as any)?.runtime).toBe('mm_duplicate_branch');
    expect(h.duplicateBranch).toHaveBeenCalledTimes(1);
    expect(h.duplicateBranch).toHaveBeenCalledWith('n1');
  });

  it('idea.node.mm_copy: declines with a clear, honest message — no UI `run` closure and no bus receiver exists (clipboard is browser-local state)', async () => {
    const h = makeHarness();
    render(<h.Harness initialEdges={[]} initialNodes={[]} />);

    const result = await act(async () => runIdeaAction('idea.node.mm_copy', teresaCtx()));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/menu kontekstowego|prawy klik/i);
    expect(h.setNodes).not.toHaveBeenCalled();
    expect(h.setEdges).not.toHaveBeenCalled();
  });

  it('idea.node.mm_add_child: a UI click (ctx.params.run present) takes the human click-path instead of the bus, unchanged from before the migration', async () => {
    const h = makeHarness();
    render(<h.Harness initialEdges={[]} initialNodes={[]} />);
    const run = vi.fn();

    const result = await act(async () =>
      runIdeaAction('idea.node.mm_add_child', {
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
    expect(h.addChildNode).not.toHaveBeenCalled();
  });
});
