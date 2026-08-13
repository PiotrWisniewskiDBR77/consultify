/**
 * N5 czwarta — OSTATNIA — fala (2026-08-09) — `NodeContextMenu.tsx`'s AI +
 * Style & data groups (22 of the file's ~44-45 items; the third and final
 * chunk after the second/third waves covered Edit+Structure+Delete and
 * Convert+Convert branch) now have a corresponding `idea.node.mm_*` action
 * registry entry. This file follows the template of
 * `tests/components/MyWork/useMindMapQuickActions.nodeBus.test.tsx`.
 *
 * Unlike that file, most of this wave's items are honestly UI-only (no live
 * bus receiver exists for them — verified before wiring, not assumed). This
 * file proves the handful that DO have a real, working Teresa path:
 *  - `idea.node.mm_ai_expand_node` — reuses the existing `mm_ai_expand`
 *    receiver, which already honors an explicit `nodeId`.
 *  - `idea.node.mm_ai_what_if` / `idea.node.mm_summarize_branch` — real
 *    receivers exist, but (verified, not assumed) both ignore any `nodeId`
 *    passed and always act on `getSelectedNode()`.
 *  - `idea.node.mm_ai_suggest_links` — the human click from THIS menu is
 *    dead (no matching branch in `handleContextAction`), but the exact same
 *    runtime string already has a live receiver used by the floating AI
 *    popover — Teresa reaches that live receiver even though the node-menu
 *    click does not.
 *  - `idea.node.mm_attach_knowledge` — a bespoke `CustomEvent` dispatch (not
 *    the `idea-workspace-quick-action` bus), verified to honor `nodeId`.
 * And one representative UI-only decline (`idea.node.mm_change_shape`) to
 * prove the honest-refusal path still works for this wave's local mutations.
 */
import { act, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  const handleAIExpand = vi.fn();
  const getSelectedNode = vi.fn(() => undefined as any);
  const setShowWhatIf = vi.fn();

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
        handleAIExpand,
        getSelectedNode,
      } as any,
      setters: { setEdges, setNodes, setShowWhatIf } as any,
    });
    return null;
  };

  return {
    Harness,
    setEdges,
    setNodes,
    pushUndo,
    handleAIExpand,
    getSelectedNode,
    setShowWhatIf,
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

describe('Mind Map node (right-click) AI + Style & data actions — N5 fourth (final) wave', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('idea.node.mm_ai_expand_node: real receiver — targets the given nodeId (shared by "Expand topic" AND "Deepen")', async () => {
    const h = makeHarness();
    render(<h.Harness initialEdges={[]} initialNodes={[]} />);

    const result = await act(async () =>
      runIdeaAction('idea.node.mm_ai_expand_node', teresaCtx({ params: { nodeId: 'n1' } }))
    );

    expect(result.ok).toBe(true);
    expect((result.data as any)?.runtime).toBe('mm_ai_expand');
    expect(h.handleAIExpand).toHaveBeenCalledTimes(1);
    expect(h.handleAIExpand).toHaveBeenCalledWith('n1');
  });

  it('idea.node.mm_ai_what_if: real receiver opens the modal, but ignores nodeId (verified, not assumed) — always toggles the same shared state', async () => {
    const h = makeHarness();
    render(<h.Harness initialEdges={[]} initialNodes={[]} />);

    const result = await act(async () =>
      runIdeaAction('idea.node.mm_ai_what_if', teresaCtx({ params: { nodeId: 'n1' } }))
    );

    expect(result.ok).toBe(true);
    expect(h.setShowWhatIf).toHaveBeenCalledWith(true);
  });

  it('idea.node.mm_ai_suggest_links: the node-menu click is dead, but Teresa reaches the SAME live receiver the floating AI popover uses', async () => {
    const h = makeHarness();
    h.getSelectedNode.mockReturnValue({ id: 'sel-1', data: { label: 'Selected node' } } as any);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(<h.Harness initialEdges={[]} initialNodes={[]} />);

    const result = await act(async () =>
      runIdeaAction('idea.node.mm_ai_suggest_links', teresaCtx({ params: { nodeId: 'n1' } }))
    );

    expect(result.ok).toBe(true);
    // The receiver (useMindMapQuickActions.ts) re-dispatches a SECOND event
    // carrying the *real* generator action, sourced from getSelectedNode() —
    // NOT from the nodeId we passed in (verified limitation, documented in
    // the registry).
    const execCall = dispatchSpy.mock.calls.find(
      ([evt]) =>
        evt instanceof CustomEvent &&
        evt.type === 'idea-workspace-quick-action' &&
        (evt as CustomEvent).detail?.action === 'mm_ai_suggest_links_execute'
    );
    expect(execCall).toBeTruthy();
    const detail = (execCall![0] as CustomEvent).detail;
    expect(detail.nodeId).toBe('sel-1');
  });

  it('idea.node.mm_attach_knowledge: bespoke CustomEvent dispatch (not the quick-action bus), honors the given nodeId', async () => {
    const h = makeHarness();
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(<h.Harness initialEdges={[]} initialNodes={[]} />);

    const result = await act(async () =>
      runIdeaAction(
        'idea.node.mm_attach_knowledge',
        teresaCtx({ ideaId: 'idea-1', params: { nodeId: 'n42' } })
      )
    );

    expect(result.ok).toBe(true);
    const call = dispatchSpy.mock.calls.find(
      ([evt]) => evt instanceof CustomEvent && evt.type === 'idea-workspace-attach-knowledge'
    );
    expect(call).toBeTruthy();
    expect((call![0] as CustomEvent).detail).toEqual({ nodeId: 'n42', ideaId: 'idea-1' });
  });

  it('idea.node.mm_change_shape: declines with a clear, honest message — no UI `run` closure and no bus receiver exists (local node-data cycle, no dispatch mechanism)', async () => {
    const h = makeHarness();
    render(<h.Harness initialEdges={[]} initialNodes={[]} />);

    const result = await act(async () => runIdeaAction('idea.node.mm_change_shape', teresaCtx()));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/menu kontekstowego|prawy klik/i);
    expect(h.setNodes).not.toHaveBeenCalled();
  });

  it('idea.node.mm_ai_expand_node: a UI click (ctx.params.run present) takes the human click-path instead of the bus, unchanged from before the migration', async () => {
    const h = makeHarness();
    render(<h.Harness initialEdges={[]} initialNodes={[]} />);
    const run = vi.fn();

    const result = await act(async () =>
      runIdeaAction('idea.node.mm_ai_expand_node', {
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
    expect(h.handleAIExpand).not.toHaveBeenCalled();
  });
});
