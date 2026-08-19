import { describe, expect, it, vi } from 'vitest';

import { applyDynamicSwotPendingAction } from '@/hooks/discovery/toolAi/dynamicSwot';

describe('Dynamic SWOT full-session replay', () => {
  it('does not append duplicate signals, items, or correlations on an identical sequential replay', () => {
    const data: any = {
      context: {},
      signals: [],
      items: [],
      correlations: [],
      tensions: [],
      recommendedMoves: [],
      outputCandidates: [],
    };
    const actions: any = {
      addSWOTSignal: (value: any) =>
        data.signals.push({ id: `signal-${data.signals.length}`, ...value }),
      addSWOTItem: (value: any) => data.items.push({ id: `item-${data.items.length}`, ...value }),
      addCorrelation: (value: any) =>
        data.correlations.push({ id: `correlation-${data.correlations.length}`, ...value }),
      setSWOTTensions: (value: any) => (data.tensions = value),
      setSWOTMoves: (value: any) => (data.recommendedMoves = value),
      setSWOTOutputCandidates: (value: any) => (data.outputCandidates = value),
      setSWOTSummary: vi.fn(),
      setInitiatives: vi.fn(),
      setSessionGenerationStatus: vi.fn(),
      updateInputData: vi.fn(),
      updateCardAfterRethink: vi.fn(),
    };
    const parsed = {
      signals: [{ type: 'strengths', content: 'Trusted delivery' }],
      items: [{ quadrant: 'strengths', text: 'Trusted delivery', impact: 'high' }],
      correlations: [{ type: 'SO', items: ['item-a', 'item-b'], insight: 'Scale trust' }],
      tensions: [],
      moves: [],
      outputCandidates: [],
      initiatives: [],
      summary: {},
    };

    const apply = () =>
      applyDynamicSwotPendingAction({
        pendingAction: 'full-session',
        parsed,
        currentStepId: 'input',
        swotData: data,
        rethinkTarget: null,
        toolType: 'dynamic-swot',
        actions,
      } as any);

    apply();
    apply();

    expect(data.signals).toHaveLength(1);
    expect(data.items).toHaveLength(1);
    expect(data.correlations).toHaveLength(1);
  });
});
