/**
 * Process Flow CANVAS (background) menu + LANE (tor) controls (2026-08-10,
 * N6.3) — `ProcessFlowContextMenu.tsx`'s `getCanvasContextActions` (4 items)
 * and `LaneSystem.tsx`'s always-visible header buttons (6 lane operations,
 * NO menu component to intercept — `scope: 'lane_frame'`, `surfaces:
 * ['inline']`) now have Action Registry entries in `ideaActionRegistry.ts`.
 *
 * Mirrors `useProcessFlowQuickActions.edgeBus.test.tsx`/`.nodeBus.test.tsx`
 * as a template: proves a caller with only a `laneId` (no component
 * instance) can reach the real lane mutation through `runIdeaAction`, that
 * `idea.view.pf_add_decision` reaches the pre-existing (previously
 * unconnected) `pf_add_decision` receiver, and that
 * `idea.view.pf_paste_at_point` declines cleanly for Teresa (local tool
 * clipboard, same honesty class as Mind Map's `idea.view.paste_at_point`).
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
    autoLayout: vi.fn(),
    renameLane: vi.fn(),
    moveLaneUp: vi.fn(),
    moveLaneDown: vi.fn(),
    setLaneColor: vi.fn(),
    toggleLaneCollapse: vi.fn(),
    deleteLane: vi.fn(),
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

describe('Process Flow LANE actions — real dispatch-bus receiver (lane control wiring, 2026-08-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('idea.lane.pf_rename: laneId + label dispatches pf_lane_rename and the hook routes it to renameLane(laneId, label)', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    const result = await act(async () =>
      runIdeaAction(
        'idea.lane.pf_rename',
        teresaCtx({ params: { laneId: 'lane-1', label: 'Intake' } })
      )
    );

    expect(result.ok).toBe(true);
    expect((result.data as any)?.runtime).toBe('pf_lane_rename');
    expect(handlers.renameLane).toHaveBeenCalledTimes(1);
    expect(handlers.renameLane).toHaveBeenCalledWith('lane-1', 'Intake');
  });

  it('idea.lane.pf_move_up / pf_move_down: laneId alone dispatches to moveLaneUp/moveLaneDown', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    await act(async () =>
      runIdeaAction('idea.lane.pf_move_up', teresaCtx({ params: { laneId: 'lane-2' } }))
    );
    await act(async () =>
      runIdeaAction('idea.lane.pf_move_down', teresaCtx({ params: { laneId: 'lane-2' } }))
    );

    expect(handlers.moveLaneUp).toHaveBeenCalledWith('lane-2');
    expect(handlers.moveLaneDown).toHaveBeenCalledWith('lane-2');
  });

  it('idea.lane.pf_color: laneId + color dispatches pf_lane_color and the hook routes it to setLaneColor(laneId, color)', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    const result = await act(async () =>
      runIdeaAction(
        'idea.lane.pf_color',
        teresaCtx({ params: { laneId: 'lane-3', color: '#dbeafe' } })
      )
    );

    expect(result.ok).toBe(true);
    expect(handlers.setLaneColor).toHaveBeenCalledWith('lane-3', '#dbeafe');
  });

  it('idea.lane.pf_toggle_collapse: laneId alone dispatches to toggleLaneCollapse', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    await act(async () =>
      runIdeaAction('idea.lane.pf_toggle_collapse', teresaCtx({ params: { laneId: 'lane-4' } }))
    );

    expect(handlers.toggleLaneCollapse).toHaveBeenCalledWith('lane-4');
  });

  it('idea.lane.pf_delete: laneId alone dispatches to deleteLane', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    const result = await act(async () =>
      runIdeaAction('idea.lane.pf_delete', teresaCtx({ params: { laneId: 'lane-5' } }))
    );

    expect(result.ok).toBe(true);
    expect(handlers.deleteLane).toHaveBeenCalledWith('lane-5');
  });

  it('declines with a clear, tor-labelled message when neither ctx.params.laneId nor a selected lane is available', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    const result = await act(async () => runIdeaAction('idea.lane.pf_delete', teresaCtx()));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/torze/);
    expect(handlers.deleteLane).not.toHaveBeenCalled();
  });

  it('idea.view.pf_add_decision: reuses the pre-existing (previously unconnected) pf_add_decision receiver — addNode("decision") without a position', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    const result = await act(async () => runIdeaAction('idea.view.pf_add_decision', teresaCtx()));

    expect(result.ok).toBe(true);
    expect((result.data as any)?.runtime).toBe('pf_add_decision');
    expect(handlers.addNode).toHaveBeenCalledWith('decision');
  });

  it('idea.view.pf_paste_at_point: declines cleanly for Teresa — local tool clipboard, no bus receiver (same honesty class as idea.node.pf_copy)', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    const result = await act(async () => runIdeaAction('idea.view.pf_paste_at_point', teresaCtx()));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/tła/);
    expect(handlers.addNode).not.toHaveBeenCalled();
  });

  it('the UI path (ctx.source "ui" + ctx.params.run) runs the local callback directly and never touches the bus', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);
    const run = vi.fn();

    const result = await act(async () =>
      runIdeaAction('idea.lane.pf_delete', {
        ideaId: 'idea-1',
        tool: 'process_flow',
        selection: EMPTY_SELECTION,
        surface: 'inline',
        source: 'ui',
        params: { run },
      })
    );

    expect(result.ok).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(handlers.deleteLane).not.toHaveBeenCalled();
  });
});
