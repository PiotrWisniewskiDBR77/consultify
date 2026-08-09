/**
 * Process Flow NODE menu (2026-08-09) — `ProcessFlowContextMenu.tsx`'s
 * `getNodeContextActions` (8 items) + dual-surface
 * `ProcessFlowFloatingToolbar.tsx` (7 buttons) now have Action Registry
 * entries in `ideaActionRegistry.ts`: `idea.node.duplicate`/`idea.node.delete`
 * extended cross-tool from Whiteboard, `idea.view.auto_layout` reused as-is,
 * and 8 genuinely new `idea.node.pf_*` ids (properties/edit/copy/
 * ai_rewrite_step/convert_initiative/artifact_links/comments/open_chat).
 *
 * Mirrors `useProcessFlowQuickActions.edgeBus.test.tsx` as a template: proves
 * a caller with only a nodeId (no component instance) can reach the real
 * mutation through `runIdeaAction`, and that UI-only entries decline
 * cleanly for Teresa instead of pretending to work.
 */
import { act, render } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const convertMyIdeaMock = vi.fn();

vi.mock('@/services/api', () => ({
  Api: {
    convertMyIdea: (...args: unknown[]) => convertMyIdeaMock(...args),
  },
}));

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
    openEdgeStylePopover: vi.fn(),
    reverseEdge: vi.fn(),
    setEdgeCondition: vi.fn(),
    startAIRewriteStep: vi.fn(),
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

function uiCtx(run: () => void, overrides?: Partial<ActionContext>): ActionContext {
  return {
    ideaId: 'idea-1',
    tool: 'process_flow',
    selection: EMPTY_SELECTION,
    surface: 'context',
    source: 'ui',
    params: { run },
    ...overrides,
  };
}

describe('Process Flow node actions — real dispatch-bus receiver (node menu + floating toolbar wiring, 2026-08-09)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('idea.node.duplicate: reused cross-tool from Whiteboard — dispatches pf_duplicate, hook routes it to duplicateSelected() (pre-existing receiver, zero new hook code)', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    const result = await act(async () => runIdeaAction('idea.node.duplicate', teresaCtx()));

    expect(result.ok).toBe(true);
    expect((result.data as any)?.runtime).toBe('pf_duplicate');
    expect(handlers.duplicateSelected).toHaveBeenCalledTimes(1);
  });

  it('idea.node.delete: reused cross-tool from Whiteboard — dispatches pf_delete, hook routes it to deleteSelected() (same receiver already reused by idea.edge.pf_delete)', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    const result = await act(async () => runIdeaAction('idea.node.delete', teresaCtx()));

    expect(result.ok).toBe(true);
    expect((result.data as any)?.runtime).toBe('pf_delete');
    expect(handlers.deleteSelected).toHaveBeenCalledTimes(1);
  });

  it('idea.node.pf_ai_rewrite_step: nodeId + instruction dispatches pf_ai_rewrite_step, hook routes it to startAIRewriteStep(nodeId, instruction) — the one genuinely new receiver this pass adds', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    const result = await act(async () =>
      runIdeaAction(
        'idea.node.pf_ai_rewrite_step',
        teresaCtx({ params: { nodeId: 'node-1', instruction: 'Make this step clearer' } })
      )
    );

    expect(result.ok).toBe(true);
    expect((result.data as any)?.runtime).toBe('pf_ai_rewrite_step');
    expect(handlers.startAIRewriteStep).toHaveBeenCalledTimes(1);
    expect(handlers.startAIRewriteStep).toHaveBeenCalledWith('node-1', 'Make this step clearer');
  });

  it('idea.node.pf_ai_rewrite_step: declines with a clear message when instruction is missing — does not guess or silently no-op', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    const result = await act(async () =>
      runIdeaAction('idea.node.pf_ai_rewrite_step', teresaCtx({ params: { nodeId: 'node-1' } }))
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/instruction/);
    expect(handlers.startAIRewriteStep).not.toHaveBeenCalled();
  });

  it('idea.node.pf_ai_rewrite_step: the UI path (ctx.source "ui" + ctx.params.run) runs the local callback directly (openStepRewrite) and never touches the bus', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);
    const run = vi.fn();

    const result = await act(async () => runIdeaAction('idea.node.pf_ai_rewrite_step', uiCtx(run)));

    expect(result.ok).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    expect(handlers.startAIRewriteStep).not.toHaveBeenCalled();
  });

  it('idea.node.pf_convert_initiative: Teresa without confirmed → central confirmBeforeRun gate declines before the handler runs, Api.convertMyIdea never called', async () => {
    const result = await runIdeaAction(
      'idea.node.pf_convert_initiative',
      teresaCtx({ params: { nodeId: 'node-2' } })
    );

    expect(result.ok).toBe(false);
    expect(result.data).toEqual({
      needsConfirmation: true,
      actionId: 'idea.node.pf_convert_initiative',
    });
    expect(convertMyIdeaMock).not.toHaveBeenCalled();
  });

  it('idea.node.pf_convert_initiative: Teresa with confirmed:true + nodeId → calls Api.convertMyIdea with target initiative and the CORRECT nodeIds field (unlike the UI click path, which sends a dead selectedIds field the receiver never reads)', async () => {
    convertMyIdeaMock.mockResolvedValueOnce({ outputId: 'initiative-1' });

    const result = await runIdeaAction(
      'idea.node.pf_convert_initiative',
      teresaCtx({ params: { nodeId: 'node-2' }, confirmed: true, language: 'pl' })
    );

    expect(result.ok).toBe(true);
    expect(convertMyIdeaMock).toHaveBeenCalledWith('idea-1', {
      target: 'initiative',
      options: { language: 'pl', nodeIds: ['node-2'] },
    });
  });

  it('idea.node.pf_convert_initiative: confirmed but no nodeId available → declines without calling Api', async () => {
    const result = await runIdeaAction(
      'idea.node.pf_convert_initiative',
      teresaCtx({ confirmed: true })
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/nodeId/);
    expect(convertMyIdeaMock).not.toHaveBeenCalled();
  });

  it.each([
    ['idea.node.pf_edit', 'menu węzła'],
    ['idea.node.pf_copy', 'menu węzła'],
    ['idea.node.pf_properties', 'menu węzła'],
    ['idea.node.pf_comments', 'menu węzła'],
    ['idea.node.pf_artifact_links', 'menu węzła'],
    ['idea.node.pf_open_chat', 'menu węzła'],
  ])(
    '%s: UI-only — declines for Teresa (no live bus path) instead of pretending to work',
    async (id) => {
      const result = await runIdeaAction(id, teresaCtx());
      expect(result.ok).toBe(false);
    }
  );

  it.each([
    'idea.node.pf_edit',
    'idea.node.pf_copy',
    'idea.node.pf_properties',
    'idea.node.pf_comments',
    'idea.node.pf_artifact_links',
    'idea.node.pf_open_chat',
  ])('%s: UI path (ctx.source "ui" + ctx.params.run) runs the local callback directly', async (id) => {
    const run = vi.fn();
    const result = await runIdeaAction(id, uiCtx(run));
    expect(result.ok).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
