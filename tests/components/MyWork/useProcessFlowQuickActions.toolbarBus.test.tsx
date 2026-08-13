/**
 * Process Flow TOOLBAR (2026-08-10, N6.4) — `ProcessFlowToolbar.tsx`'s mode
 * tabs + "More" overflow menu now have Action Registry entries
 * (`surface: 'toolbar'`, `ideaActionRegistry.ts`).
 *
 * Mirrors `useProcessFlowQuickActions.laneBus.test.tsx` as a template and
 * covers ONLY what this pass genuinely added on the bus side — not the whole
 * menu (the UI-only items are asserted as honest declines, one representative
 * each, because they have no receiver by design):
 *
 *  1. `pf_summary` — the one genuinely NEW receiver (AI process summary,
 *     read-only). Its twin `pf_analyze` (AI Coach) has had a receiver for
 *     ages; the asymmetry had no mechanical justification.
 *  2. `pf_mode_classic`/`_automation`/`_vsm` — receivers that already existed
 *     in the hook with NO caller at all (a wiring gap, not new plumbing).
 *  3. UI-only decline path (`idea.view.pf_validate`) — proves Teresa gets an
 *     explicit refusal instead of a silent no-op (Z3).
 *  4. The dead menu item (`idea.node.pf_convert_analysis`) — proves the
 *     registry refuses it for Teresa rather than promising a conversion the
 *     product removed (target `analysis` is not in `IDEA_CONVERT_TARGETS`).
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
    generateSummary: vi.fn(),
    autoLayout: vi.fn(),
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

describe('Process Flow TOOLBAR actions — bus receivers and honest declines (N6.4, 2026-08-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('idea.ai.pf_process_summary: dispatches pf_summary and the hook routes it to generateSummary()', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    const result = await act(async () =>
      runIdeaAction('idea.ai.pf_process_summary', teresaCtx())
    );

    expect(result.ok).toBe(true);
    expect((result.data as any)?.runtime).toBe('pf_summary');
    expect(handlers.generateSummary).toHaveBeenCalledTimes(1);
    // Read-only AI (doc 09 §6): nothing on the canvas may be touched.
    expect(handlers.addNode).not.toHaveBeenCalled();
    expect(handlers.deleteSelected).not.toHaveBeenCalled();
  });

  it('idea.view.pf_mode_*: each of the three tabs reaches the pre-existing setFlowMode receiver', async () => {
    const setters = makeSetters();
    render(<Harness handlers={makeHandlers()} setters={setters} />);

    await act(async () => runIdeaAction('idea.view.pf_mode_classic', teresaCtx()));
    await act(async () => runIdeaAction('idea.view.pf_mode_automation', teresaCtx()));
    await act(async () => runIdeaAction('idea.view.pf_mode_vsm', teresaCtx()));

    expect(setters.setFlowMode).toHaveBeenCalledTimes(3);
    expect(setters.setFlowMode).toHaveBeenNthCalledWith(1, 'classic');
    expect(setters.setFlowMode).toHaveBeenNthCalledWith(2, 'automation');
    expect(setters.setFlowMode).toHaveBeenNthCalledWith(3, 'vsm');
  });

  it('UI click keeps its ORIGINAL callback path (ctx.params.run), byte-identical to before the wiring', async () => {
    const setters = makeSetters();
    render(<Harness handlers={makeHandlers()} setters={setters} />);
    const run = vi.fn();

    const result = await act(async () =>
      runIdeaAction('idea.view.pf_mode_vsm', {
        ...teresaCtx(),
        surface: 'toolbar',
        source: 'ui',
        params: { run },
      })
    );

    expect(result.ok).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
    // The UI path must NOT ALSO go through the bus — that would double-apply.
    expect(setters.setFlowMode).not.toHaveBeenCalled();
  });

  it('idea.view.pf_validate: UI-only — Teresa gets an explicit refusal, never a silent no-op', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    const result = await act(async () => runIdeaAction('idea.view.pf_validate', teresaCtx()));

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Więcej/);
  });

  it('idea.node.pf_convert_analysis: the dead menu item refuses for Teresa instead of promising a conversion', async () => {
    const handlers = makeHandlers();
    render(<Harness handlers={handlers} setters={makeSetters()} />);

    const result = await act(async () =>
      runIdeaAction(
        'idea.node.pf_convert_analysis',
        teresaCtx({ params: { nodeId: 'n-1' }, confirmed: true })
      )
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/nie istnieje dziś w produkcie/);
  });
});
