// @vitest-environment jsdom
//
// RB-023: reopening a consulting-tool session must restore the step the user
// was on, not silently default to step 1. hydrateSessionFromApi previously
// ignored the persisted wizardState entirely — ToolDocumentView.fetchAll()
// now passes the server's wizardState through, and hydrateSessionFromApi
// resolves the step-id string against this tool's own step definitions.
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('useToolStore.hydrateSessionFromApi — RB-023 step reopen', () => {
  let useToolStore: any;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
    const mod = await import('../../../src/store/useToolStore');
    useToolStore = (mod as any).useToolStore;
  });

  it('restores the persisted wizardState step instead of defaulting to step 1', () => {
    useToolStore.getState().hydrateSessionFromApi({
      id: 'sess-1',
      toolType: 'market-forces',
      answers: {},
      wizardState: { currentStep: 'forces' },
    });

    // 'forces' is the third PORTER_STEPS entry (mission, input, forces, ...).
    expect(useToolStore.getState().currentStep).toBe(3);
    expect(useToolStore.getState().currentSession?.currentStep).toBe(3);
  });

  it('defaults to step 1 when no wizardState is persisted (new session)', () => {
    useToolStore.getState().hydrateSessionFromApi({
      id: 'sess-2',
      toolType: 'market-forces',
      answers: {},
      wizardState: null,
    });

    expect(useToolStore.getState().currentStep).toBe(1);
  });

  it('ignores an unknown/stale wizardState step id and falls back to step 1', () => {
    useToolStore.getState().hydrateSessionFromApi({
      id: 'sess-3',
      toolType: 'market-forces',
      answers: {},
      wizardState: { currentStep: 'not-a-real-step' },
    });

    expect(useToolStore.getState().currentStep).toBe(1);
  });

  it('an explicit numeric currentStep still wins over wizardState (back-compat)', () => {
    useToolStore.getState().hydrateSessionFromApi({
      id: 'sess-4',
      toolType: 'market-forces',
      answers: {},
      currentStep: 2,
      wizardState: { currentStep: 'forces' },
    } as any);

    expect(useToolStore.getState().currentStep).toBe(2);
  });
});
