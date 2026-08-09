/**
 * Process Flow edge menu (2026-08-09) — `ProcessFlowContextMenu.tsx`'s
 * `getEdgeContextActions` (9 items) now has Action Registry entries in
 * `ideaActionRegistry.ts` (`idea.edge.reverse` extended + 8 new
 * `idea.edge.pf_*` ids). Mirrors `useWhiteboardQuickActions.edgeBus.test.tsx`
 * / `useMindMapQuickActions.edgeBus.test.tsx` as templates: proves a caller
 * with ONLY an edge id (no menu instance, no IdeaProcessFlowTool closure) can
 * still reach the real mutation, through `runIdeaAction` → the
 * `idea-workspace-quick-action` bus → `useProcessFlowQuickActions.ts`.
 *
 * Covers the 3 actions that needed a genuinely NEW runtime string
 * (`pf_edge_edit_props` / `pf_edge_reverse` / `pf_edge_set_condition`) plus
 * the 2 that REUSE existing receivers (`pf_insert_between` / `pf_delete`,
 * already wired for the floating toolbar and Menu 3/rail respectively) —
 * proving reuse didn't silently break under the new registry ids.
 */
import { act, render } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runIdeaAction, type ActionContext } from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';

import {
  useProcessFlowQuickActions,
  type ProcessFlowQuickActionHandlers,
} from '@/components/MyWork/processflow/useProcessFlowQuickActions';

function makeHandlers(): ProcessFlowQuickActionHandlers {
  return {
    addNode: vi.fn(),
    insertAutomationTrigger: vi.fn(),
    addLane: vi.fn(),
    insertBetween: vi.fn(),
    splitPath: vi.fn(),
    deleteSelected: vi.fn(),
    duplicateSelected: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    openMetricsEditor: vi.fn(),
    runSavingsAnalysis: vi.fn(),
    createFromPrompt: vi.fn(),
    runProcessCoach: vi.fn(),
    openEdgeStylePopover: vi.fn(),
    reverseEdge: vi.fn(),
    setEdgeCondition: vi.fn(),
  };
}

function makeSetters() {
  return {
    setFlowMode: vi.fn(),
    setSemanticKit: vi.fn(),
    setNodes: vi.fn(),
  };
}

const Harness: React.FC<{
  handlers: ProcessFlowQuickActionHandlers;
  setters: ReturnType<typeof makeSetters>;
}> = ({ handlers, setters }) => {
  useProcessFlowQuickActions({
    open: true,
    ideaId: 'idea-1',
    isPl: false,
    nodes: [],
    handlers,
    setters: setters as any,
  });
  return null;
};

function teresaCtx(overrides?: Partial<ActionContext>): ActionContext {
  return {
    ideaId: 'idea-1',
    tool: 'process_flow',
    selection: EMPTY_SELECTION,
    surface: 'panel',
    source: 'teresa',
    ...overrides,
  };
}

describe('Process Flow edge actions — real dispatch-bus receiver (edge menu wiring, 2026-08-09)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('idea.edge.reverse: edgeId alone (no ctx.params.run) dispatches pf_edge_reverse and the hook routes it to reverseEdge(edgeId) — extended from the existing whiteboard/mindmap action', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    const result = await act(async () =>
      runIdeaAction('idea.edge.reverse', teresaCtx({ params: { edgeId: 'edge-1' } }))
    );

    expect(result.ok).toBe(true);
    expect((result.data as any)?.runtime).toBe('pf_edge_reverse');
    expect(handlers.reverseEdge).toHaveBeenCalledTimes(1);
    expect(handlers.reverseEdge).toHaveBeenCalledWith('edge-1');
  });

  it('idea.edge.pf_edit_props: edgeId alone dispatches pf_edge_edit_props and the hook routes it to openEdgeStylePopover(edgeId) (new runtime, no prior receiver)', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    const result = await act(async () =>
      runIdeaAction('idea.edge.pf_edit_props', teresaCtx({ params: { edgeId: 'edge-2' } }))
    );

    expect(result.ok).toBe(true);
    expect(handlers.openEdgeStylePopover).toHaveBeenCalledTimes(1);
    expect(handlers.openEdgeStylePopover).toHaveBeenCalledWith('edge-2');
  });

  it('idea.edge.pf_condition_yes / _no: the condition value is baked into the registry id, not read from ctx.params — both reach setEdgeCondition(edgeId, condition) via the single pf_edge_set_condition runtime', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    await act(async () =>
      runIdeaAction('idea.edge.pf_condition_yes', teresaCtx({ params: { edgeId: 'edge-3' } }))
    );
    await act(async () =>
      runIdeaAction('idea.edge.pf_condition_no', teresaCtx({ params: { edgeId: 'edge-3' } }))
    );

    expect(handlers.setEdgeCondition).toHaveBeenNthCalledWith(1, 'edge-3', 'yes');
    expect(handlers.setEdgeCondition).toHaveBeenNthCalledWith(2, 'edge-3', 'no');
  });

  it('idea.edge.pf_condition_none: bakes the empty-string condition (clears the condition) correctly — not dropped as falsy', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    await act(async () =>
      runIdeaAction('idea.edge.pf_condition_none', teresaCtx({ params: { edgeId: 'edge-4' } }))
    );

    expect(handlers.setEdgeCondition).toHaveBeenCalledWith('edge-4', '');
  });

  it('idea.edge.pf_insert_node: reuses the existing pf_insert_between runtime (floating toolbar receiver), no new hook case needed', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    const result = await act(async () =>
      runIdeaAction('idea.edge.pf_insert_node', teresaCtx({ params: { edgeId: 'edge-5' } }))
    );

    expect(result.ok).toBe(true);
    expect((result.data as any)?.runtime).toBe('pf_insert_between');
    expect(handlers.insertBetween).toHaveBeenCalledTimes(1);
  });

  it('idea.edge.pf_delete: reuses the existing pf_delete runtime (Menu 3/rail receiver), no new hook case needed', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    const result = await act(async () =>
      runIdeaAction('idea.edge.pf_delete', teresaCtx({ params: { edgeId: 'edge-6' } }))
    );

    expect(result.ok).toBe(true);
    expect((result.data as any)?.runtime).toBe('pf_delete');
    expect(handlers.deleteSelected).toHaveBeenCalledTimes(1);
  });

  it('declines with a clear, Przepływ-labelled message when neither ctx.params.edgeId nor a selected edge is available', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    const result = await act(async () => runIdeaAction('idea.edge.reverse', teresaCtx()));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Przepływu/);
    expect(handlers.reverseEdge).not.toHaveBeenCalled();
  });

  it('the UI path (ctx.source "ui" + ctx.params.run) runs the local callback directly and never touches the bus', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);
    const run = vi.fn();

    const result = await act(async () =>
      runIdeaAction('idea.edge.pf_delete', {
        ideaId: 'idea-1',
        tool: 'process_flow',
        selection: EMPTY_SELECTION,
        surface: 'context',
        source: 'ui',
        params: { run },
      })
    );

    expect(result.ok).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(handlers.deleteSelected).not.toHaveBeenCalled();
  });
});
