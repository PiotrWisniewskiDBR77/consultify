/**
 * RISK-30 (S22-TERESA, 2026-08-12) — the remaining 58 UI-closure call sites
 * in `src/actions/registry/runtimeHelpers.ts`.
 *
 * Before this change, all 58 sites called `ctx.params.run` (the caller's
 * closure) and immediately returned `{ ok: true, actionId }` without
 * inspecting anything — `ActionResult.confirmed` stayed `undefined` (== "not
 * migrated, treat as false" per its own doc in `src/actions/registry/types.ts`).
 * The fix widens `run`'s contract CENTRALLY (`runUiClosureAsync`, one helper)
 * instead of hand-editing per-site logic: every migrated site now does
 * `const ui = await runUiClosureAsync(run); return { ok: true, actionId,
 * confirmed: ui.confirmed };`.
 *
 * This file tests two things with real assertions:
 *   1. `runUiClosureAsync` itself — the single point of truth for what
 *      counts as "confirmed" (a `QuickActionOutcome`, `true`, `false`, or
 *      anything else including a plain `void` closure — the overwhelming
 *      majority of real UI closures).
 *   2. A representative sample of the 58 migrated call sites, covering each
 *      distinct SHAPE found in the file: a UI-only gate (`runToolbarUiOnlyCallback`),
 *      a dual-path bus action (`runTableRowDeleteCallback`), the one
 *      genuinely async closure (`runPanelUiOnlyCallback`), and the two sites
 *      whose literal `actionId` string (not a shared variable) required a
 *      slightly different substitution during the migration
 *      (`runMindmapAttachKnowledgeCallback`, `runNodeEditLabelCallback`).
 */
import { describe, expect, it } from 'vitest';

import {
  runFrameNodeParamCallback,
  runMindmapAttachKnowledgeCallback,
  runNodeEditLabelCallback,
  runPanelUiOnlyCallback,
  runTableRowDeleteCallback,
  runToolbarUiOnlyCallback,
  runUiClosureAsync,
} from '@/actions/registry/runtimeHelpers';
import type { ActionContext } from '@/actions/registry/types';
import { EMPTY_SELECTION } from '@/components/MyWork/ideaSelectionTypes';

function baseCtx(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    ideaId: 'idea-1',
    tool: 'whiteboard',
    selection: EMPTY_SELECTION,
    surface: 'toolbar',
    source: 'ui',
    ...overrides,
  };
}

describe('runUiClosureAsync (RISK-30 central helper)', () => {
  it('honours a QuickActionOutcome success literally', async () => {
    const result = await runUiClosureAsync(() => ({ ok: true }));
    expect(result).toEqual({ confirmed: true, outcome: { ok: true } });
  });

  it('honours a QuickActionOutcome refusal literally', async () => {
    const result = await runUiClosureAsync(() => ({ ok: false, reason: 'locked' }));
    expect(result).toEqual({ confirmed: false, outcome: { ok: false, reason: 'locked' } });
  });

  it('treats a bare `true` return as confirmed, no detail', async () => {
    const result = await runUiClosureAsync(() => true);
    expect(result).toEqual({ confirmed: true, outcome: { ok: true } });
  });

  it('treats a bare `false` return as NOT confirmed', async () => {
    const result = await runUiClosureAsync(() => false);
    expect(result.confirmed).toBe(false);
    expect(result.outcome).toBeUndefined();
  });

  it('treats a plain void closure (the overwhelming majority of real UI callbacks) as NOT confirmed — never a guessed success', async () => {
    let sideEffectRan = false;
    const result = await runUiClosureAsync(() => {
      sideEffectRan = true;
      // no return value — exactly what a real onClick handler looks like
    });
    expect(sideEffectRan).toBe(true); // the closure DID run — `ok` staying true is still honest
    expect(result.confirmed).toBe(false);
  });

  it('awaits an ASYNC closure and honours its resolved value (the one Group-B site that is not synchronous, runPanelUiOnlyCallback)', async () => {
    const result = await runUiClosureAsync(async () => {
      await Promise.resolve();
      return true;
    });
    expect(result.confirmed).toBe(true);
  });

  it('await on a non-Promise synchronous return is a same-tick no-op (no hidden delay class change)', async () => {
    const order: string[] = [];
    const p = runUiClosureAsync(() => {
      order.push('closure');
      return true;
    });
    order.push('after-call');
    await p;
    order.push('after-await');
    // `await` on a non-thenable still yields one microtask, so 'after-call'
    // (synchronous continuation) legitimately lands before 'after-await' —
    // documented here so a future reader does not mistake this for a bug.
    expect(order).toEqual(['closure', 'after-call', 'after-await']);
  });
});

describe('RISK-30 migrated call sites — representative sample of the 58', () => {
  it('runToolbarUiOnlyCallback (UI-only gate pattern): confirmed follows what the closure reports', async () => {
    const confirmedResult = await runToolbarUiOnlyCallback(
      'idea.node.wb_undo',
      baseCtx({ params: { run: () => ({ ok: true }) } })
    );
    expect(confirmedResult).toEqual(
      expect.objectContaining({ ok: true, actionId: 'idea.node.wb_undo', confirmed: true })
    );

    const unconfirmedResult = await runToolbarUiOnlyCallback(
      'idea.node.wb_undo',
      baseCtx({ params: { run: () => undefined } })
    );
    expect(unconfirmedResult).toEqual(
      expect.objectContaining({ ok: true, actionId: 'idea.node.wb_undo', confirmed: false })
    );
  });

  it('runToolbarUiOnlyCallback still refuses non-UI callers with a real message (untouched by this migration)', async () => {
    const result = await runToolbarUiOnlyCallback(
      'idea.node.wb_undo',
      baseCtx({ source: 'teresa', params: {} })
    );
    expect(result.ok).toBe(false);
    expect(result.message).toBeTruthy();
    expect(result.confirmed).toBeUndefined();
  });

  it('runTableRowDeleteCallback (dual-path bus action): the UI branch now reports confirmed honestly', async () => {
    const ctx = baseCtx({
      tool: 'table',
      params: { run: () => ({ ok: false as const, reason: 'locked' as const }) },
    });
    const result = await runTableRowDeleteCallback(ctx);
    expect(result).toEqual(
      expect.objectContaining({ ok: true, actionId: 'table.row.delete', confirmed: false })
    );
  });

  it('runPanelUiOnlyCallback (the async Group-B site): confirmed reflects the awaited save outcome', async () => {
    const savedOk = await runPanelUiOnlyCallback(
      'idea.workspace.business_case_save',
      baseCtx({ params: { run: async () => true } })
    );
    expect(savedOk.confirmed).toBe(true);

    const savedUnknown = await runPanelUiOnlyCallback(
      'idea.workspace.business_case_save',
      baseCtx({ params: { run: async () => undefined } })
    );
    expect(savedUnknown.confirmed).toBe(false);
  });

  it('runMindmapAttachKnowledgeCallback (literal actionId site #1): confirmed threads through unchanged actionId', async () => {
    const result = await runMindmapAttachKnowledgeCallback(
      baseCtx({ tool: 'mindmap', params: { run: () => true } })
    );
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        actionId: 'idea.node.mm_attach_knowledge',
        confirmed: true,
      })
    );
  });

  it('runNodeEditLabelCallback (literal actionId site #2): confirmed threads through unchanged actionId', async () => {
    const result = await runNodeEditLabelCallback(
      baseCtx({ tool: 'whiteboard', params: { run: () => false } })
    );
    expect(result).toEqual(
      expect.objectContaining({ ok: true, actionId: 'idea.node.edit', confirmed: false })
    );
  });

  it('runFrameNodeParamCallback (frame/dual-path site): confirmed follows the closure, actionId is fixed', async () => {
    const result = await runFrameNodeParamCallback(
      baseCtx({ tool: 'whiteboard', params: { run: () => ({ ok: true }) } })
    );
    expect(result).toEqual(
      expect.objectContaining({
        ok: true,
        actionId: 'idea.node.remove_from_frame',
        confirmed: true,
      })
    );
  });

  it('none of the sampled sites regress `ok` — accepted-and-dispatched semantics are unchanged by this migration', async () => {
    const alwaysOk = await runToolbarUiOnlyCallback(
      'idea.node.wb_redo',
      baseCtx({ params: { run: () => undefined } })
    );
    expect(alwaysOk.ok).toBe(true);
  });
});
