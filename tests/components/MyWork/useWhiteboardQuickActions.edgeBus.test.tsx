/**
 * E02 follow-up (2026-08-09) — Whiteboard edge actions get a real,
 * addressable dispatch-bus receiver, mirroring how Mind Map edges already
 * dispatch `mm_edge_arrow` to `useMindMapQuickActions.ts`.
 *
 * This proves the specific gap the pilot left open is closed: a caller with
 * ONLY an edge id (no direct component callback / `ctx.params.run`, i.e. no
 * human having right-clicked that edge's own menu instance) can still
 * trigger the same mutation. Two things are exercised together:
 *
 *  1. `runEdgeParamCallback` in `ideaActionRegistry.ts` — when there is no
 *     `ctx.params.run` (the UI-only path), it must dispatch a `wb_edge_*`
 *     CustomEvent with `edgeId` instead of declining.
 *  2. `useWhiteboardQuickActions` — must receive that event and call the
 *     matching handler with the edge id, exactly like the AI quick actions
 *     test above proves for `wb_ai_*`.
 */
import { act, render } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { runIdeaAction, type ActionContext } from '@/actions/ideaActionRegistry';
import {
  useWhiteboardQuickActions,
  type WhiteboardQuickActionHandlers,
} from '@/components/MyWork/whiteboard/useWhiteboardQuickActions';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';

function makeHandlers(): WhiteboardQuickActionHandlers {
  return {
    addElement: vi.fn(),
    deleteSelected: vi.fn(),
    duplicateSelected: vi.fn(),
    groupSelected: vi.fn(),
    ungroupSelected: vi.fn(),
    distributeNodes: vi.fn(),
    editEdgeLabel: vi.fn(),
    reverseEdge: vi.fn(),
    cycleEdgeArrow: vi.fn(),
    cycleEdgeStyle: vi.fn(),
    deleteEdge: vi.fn(),
  };
}

const Harness: React.FC<{ handlers: WhiteboardQuickActionHandlers }> = ({ handlers }) => {
  useWhiteboardQuickActions({ open: true, handlers });
  return null;
};

function teresaCtx(overrides?: Partial<ActionContext>): ActionContext {
  return {
    ideaId: 'idea-1',
    tool: 'whiteboard',
    selection: EMPTY_SELECTION,
    surface: 'panel',
    source: 'teresa',
    ...overrides,
  };
}

describe('Whiteboard edge actions — real dispatch-bus receiver (E02 follow-up)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('idea.edge.reverse: no ctx.params.run (non-UI caller) dispatches wb_edge_reverse with edgeId, and the hook routes it to reverseEdge(edgeId)', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} />);

    const result = await act(async () =>
      runIdeaAction('idea.edge.reverse', teresaCtx({ params: { edgeId: 'edge-42' } }))
    );

    expect(result.ok).toBe(true);
    expect(handlers.reverseEdge).toHaveBeenCalledTimes(1);
    expect(handlers.reverseEdge).toHaveBeenCalledWith('edge-42');
  });

  it('idea.edge.edit_label: forwards both edgeId and label from ctx.params through the bus', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} />);

    const result = await act(async () =>
      runIdeaAction(
        'idea.edge.edit_label',
        teresaCtx({ params: { edgeId: 'edge-7', label: 'depends on' } })
      )
    );

    expect(result.ok).toBe(true);
    expect(handlers.editEdgeLabel).toHaveBeenCalledWith('edge-7', 'depends on');
  });

  it('idea.edge.cycle_arrow / cycle_style / delete: all route by edgeId alone', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} />);

    await act(async () =>
      runIdeaAction('idea.edge.cycle_arrow', teresaCtx({ params: { edgeId: 'edge-9' } }))
    );
    await act(async () =>
      runIdeaAction('idea.edge.cycle_style', teresaCtx({ params: { edgeId: 'edge-9' } }))
    );
    await act(async () =>
      runIdeaAction('idea.edge.delete', teresaCtx({ params: { edgeId: 'edge-9' } }))
    );

    expect(handlers.cycleEdgeArrow).toHaveBeenCalledWith('edge-9');
    expect(handlers.cycleEdgeStyle).toHaveBeenCalledWith('edge-9');
    expect(handlers.deleteEdge).toHaveBeenCalledWith('edge-9');
  });

  it('falls back to ctx.selection (type "edge") when ctx.params.edgeId is absent', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} />);

    const result = await act(async () =>
      runIdeaAction(
        'idea.edge.reverse',
        teresaCtx({ selection: { type: 'edge', count: 1, ids: ['edge-sel'], primaryId: 'edge-sel' } })
      )
    );

    expect(result.ok).toBe(true);
    expect(handlers.reverseEdge).toHaveBeenCalledWith('edge-sel');
  });

  it('declines with a clear message when neither ctx.params.edgeId nor a selected edge is available', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} />);

    const result = await act(async () => runIdeaAction('idea.edge.reverse', teresaCtx()));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/połączeni/i);
    expect(handlers.reverseEdge).not.toHaveBeenCalled();
  });

  it('the UI path (ctx.source "ui" + ctx.params.run) still runs the local callback directly and never touches the bus', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} />);
    const run = vi.fn();

    const result = await act(async () =>
      runIdeaAction('idea.edge.delete', {
        ideaId: 'idea-1',
        tool: 'whiteboard',
        selection: EMPTY_SELECTION,
        surface: 'context',
        source: 'ui',
        params: { run },
      })
    );

    expect(result.ok).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    // Bus receiver must NOT also fire — the UI passthrough is unchanged/exclusive.
    expect(handlers.deleteEdge).not.toHaveBeenCalled();
  });
});
