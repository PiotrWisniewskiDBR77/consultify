/**
 * N5 kontynuacja, trzecia fala (2026-08-09) — `NodeContextMenu.tsx`'s Convert
 * + Convert-branch groups (8 items — 3 `ctx_convert_*` + 5
 * `ctx_subtree_convert_*`, the latter also rendered by
 * `FloatingNodeToolbar.tsx`'s "Convert branch" dropdown, same registry entry,
 * `surfaces: ['context','floating']`) now have a corresponding
 * `idea.node.mm_convert_*`/`idea.node.mm_convert_branch_*` action registry
 * entry. Template: `useMindMapQuickActions.nodeBus.test.tsx`.
 *
 * E11 UPDATE (2026-08-10, docs/standards/idea-workspace/10_*, §2.1
 * "Element"): the ORIGINAL version of this file asserted that all EIGHT
 * items — including the three plain `ctx_convert_*` ("Convert", no "branch"
 * in the label) — shared ONE bus receiver/handler with the five real
 * "Convert branch" items, always cascading to descendants. That was the
 * honesty finding this fix closes: a single-node label must not cascade.
 * The three plain items now have their OWN bus action (`mm_convert_single`)
 * and handler (`convertSingleNode`, exactly one nodeId, no descendants) —
 * asserted in the first `it.each` block below. The five real "Convert
 * branch" items are UNCHANGED — second `it.each` block, still
 * `mm_convert_branch`/`convertBranch`.
 */
import { act, render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { runIdeaAction, type ActionContext } from '@/actions/ideaActionRegistry';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';

import { useMindMapQuickActions } from '../../../src/components/MyWork/mindmap/useMindMapQuickActions';

function makeHarness() {
  const convertBranch = vi.fn();
  const convertSingleNode = vi.fn();

  const Harness: React.FC = () => {
    useMindMapQuickActions({
      ideaId: 'idea-1',
      ideaTitle: 'Test idea',
      isPolish: false,
      locked: false,
      nodes: [],
      edges: [],
      layoutMode: 'tree',
      handlers: {
        pushUndo: vi.fn(),
        addChildNode: vi.fn(),
        toggleCollapse: vi.fn(),
        getSelectedNode: vi.fn(() => undefined as any),
        convertBranch,
        convertSingleNode,
      } as any,
      setters: { setEdges: vi.fn(), setNodes: vi.fn() } as any,
    });
    return null;
  };

  return { Harness, convertBranch, convertSingleNode };
}

function teresaCtx(overrides?: Partial<ActionContext>): ActionContext {
  return {
    ideaId: 'idea-1',
    tool: 'mindmap',
    selection: EMPTY_SELECTION,
    surface: 'context',
    source: 'teresa',
    confirmed: true,
    ...overrides,
  };
}

describe('Mind Map node Convert / Convert-branch — real dispatch-bus receiver (N5, trzecia fala)', () => {
  it.each([
    ['idea.node.mm_convert_initiative', 'initiative'],
    ['idea.node.mm_convert_decision', 'decision'],
    ['idea.node.mm_convert_tasks', 'task_set'],
  ])(
    '%s: plain Convert (single_item) — forwards to handlers.convertSingleNode(%s, nodeId), NEVER convertBranch',
    async (actionId, target) => {
      const h = makeHarness();
      render(<h.Harness />);

      const result = await act(async () =>
        runIdeaAction(actionId, teresaCtx({ params: { nodeId: 'n1' } }))
      );

      expect(result.ok).toBe(true);
      expect((result.data as any)?.runtime).toBe('mm_convert_single');
      expect(h.convertSingleNode).toHaveBeenCalledTimes(1);
      expect(h.convertSingleNode).toHaveBeenCalledWith(target, 'n1');
      expect(h.convertBranch).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['idea.node.mm_convert_branch_decision', 'decision'],
    ['idea.node.mm_convert_branch_tasks', 'task_set'],
    ['idea.node.mm_convert_branch_task_set', 'task_set'],
    ['idea.node.mm_convert_branch_initiative', 'initiative'],
    ['idea.node.mm_convert_branch_process_flow', 'process_flow'],
  ])('%s: Convert branch (cascade) — forwards to handlers.convertBranch(%s, nodeId)', async (actionId, target) => {
    const h = makeHarness();
    render(<h.Harness />);

    const result = await act(async () =>
      runIdeaAction(actionId, teresaCtx({ params: { nodeId: 'n1' } }))
    );

    expect(result.ok).toBe(true);
    expect((result.data as any)?.runtime).toBe('mm_convert_branch');
    expect(h.convertBranch).toHaveBeenCalledTimes(1);
    expect(h.convertBranch).toHaveBeenCalledWith(target, 'n1');
    expect(h.convertSingleNode).not.toHaveBeenCalled();
  });

  it('idea.node.mm_convert_branch_decision: declines with a clear message when no nodeId is given (no selection either)', async () => {
    const h = makeHarness();
    render(<h.Harness />);

    const result = await act(async () =>
      runIdeaAction('idea.node.mm_convert_branch_decision', teresaCtx())
    );

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/nodeId/);
    expect(h.convertBranch).not.toHaveBeenCalled();
  });

  it('idea.node.mm_convert_branch_decision: declines without ctx.confirmed — conversion creates a new, persistent object (generic runIdeaAction confirmBeforeRun gate, same as idea.workspace.convert)', async () => {
    const h = makeHarness();
    render(<h.Harness />);

    const result = await act(async () =>
      runIdeaAction(
        'idea.node.mm_convert_branch_decision',
        teresaCtx({ params: { nodeId: 'n1' }, confirmed: false })
      )
    );

    expect(result.ok).toBe(false);
    // Gated generically by runIdeaAction (teresa.confirmBeforeRun), before the
    // handler's own honest `if (!ctx.confirmed)` check ever runs — same
    // two-layer pattern as `idea.workspace.convert`.
    expect(result.message).toMatch(/zmienia dane na trwałe|potwierd/i);
    expect((result.data as any)?.needsConfirmation).toBe(true);
    expect(h.convertBranch).not.toHaveBeenCalled();
  });

  it('idea.node.mm_convert_branch_decision: a UI click (ctx.params.run present) takes the human click-path instead of the bus, unchanged from before the migration', async () => {
    const h = makeHarness();
    render(<h.Harness />);
    const run = vi.fn();

    const result = await act(async () =>
      runIdeaAction('idea.node.mm_convert_branch_decision', {
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
    expect(h.convertBranch).not.toHaveBeenCalled();
  });
});
