// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('useToolStore governance actions', () => {
  let useToolStore: any;

  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.clear();
    vi.resetModules();
    const mod = await import('../../../src/store/useToolStore');
    useToolStore = (mod as any).useToolStore;
  });

  it('accepts the AI-generated summary through explicit card acceptance', () => {
    const store = useToolStore.getState();
    store.createSession('dynamic-swot');
    store.setSWOTSummary({
      proposalId: 'swot-summary',
      proposalStatus: 'ai-proposed',
      executiveSummary: 'Pending source summary',
      keyInsights: ['Insight'],
      appliedConclusions: ['Conclusion'],
      recommendedInitiatives: [],
    });

    useToolStore.getState().acceptCard('conclusion', 'swot-summary');

    expect(useToolStore.getState().currentSession.inputData.summary.proposalStatus).toBe('accepted');
  });

  it('marks the AI-generated summary as rethinking before replacement', () => {
    const store = useToolStore.getState();
    store.createSession('dynamic-swot');
    store.setSWOTSummary({
      proposalId: 'swot-summary',
      proposalStatus: 'ai-proposed',
      executiveSummary: 'Pending source summary',
      keyInsights: ['Insight'],
      appliedConclusions: ['Conclusion'],
      recommendedInitiatives: [],
    });

    useToolStore.getState().markRethinking('conclusion', 'swot-summary');

    expect(useToolStore.getState().currentSession.inputData.summary.proposalStatus).toBe('rethinking');
  });
});
