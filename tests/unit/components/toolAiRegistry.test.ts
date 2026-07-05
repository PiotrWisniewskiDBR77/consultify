import { describe, expect, it, vi } from 'vitest';

import { applyDynamicSwotPendingAction } from '../../../src/hooks/discovery/toolAi/dynamicSwot';
import { getToolSuggestionPrompt, getToolSummaryPrompt } from '../../../src/hooks/discovery/toolAi/promptRegistry';
import type { SWOTData } from '../../../src/store/useToolStore';

const buildSwot = (overrides: Partial<SWOTData> = {}): SWOTData =>
  ({
    context: {
      goal: 'Define next direction',
      scope: 'Whole company',
      timeframe: 'medium',
      successSignal: 'Agreed priorities',
    },
    signals: [],
    items: [
      { id: 'i1', text: 'Strong brand', impact: 'high', quadrant: 'strengths' },
      { id: 'i2', text: 'Weak process', impact: 'medium', quadrant: 'weaknesses' },
      { id: 'i3', text: 'New market', impact: 'high', quadrant: 'opportunities' },
      { id: 'i4', text: 'Competition', impact: 'medium', quadrant: 'threats' },
    ],
    correlations: [],
    tensions: [],
    recommendedMoves: [],
    outputCandidates: [],
    ...overrides,
  }) as SWOTData;

describe('toolAi registry helpers', () => {
  it('returns modular prompts for SWOT and non-SWOT tools', () => {
    expect(getToolSuggestionPrompt('dynamic-swot', 'mission', buildSwot())).toContain(
      'Improve the mission brief'
    );
    expect(getToolSuggestionPrompt('market-forces', 'rivalry', {})).toContain(
      'Analyze the rivalry force'
    );
    const summaryPrompt = getToolSummaryPrompt('dynamic-swot', buildSwot());
    expect(summaryPrompt).toContain('CONCLUSION_LAYER_STANDARD variant W2');
    expect(summaryPrompt).toContain('"verdict"');
    expect(summaryPrompt).toContain('tradeoff');
    expect(summaryPrompt).toContain('rejectedAlternative');
  });

  it('returns mission suggestion from SWOT apply handler without silent persistence', () => {
    const result = applyDynamicSwotPendingAction({
      pendingAction: 'suggestions',
      parsed: {
        mission: {
          goal: 'Sharper goal',
          scope: 'Sharper scope',
          successSignal: 'Sharper success',
          timeframe: 'long',
        },
      },
      currentStepId: 'mission',
      swotData: buildSwot(),
      rethinkTarget: null,
      toolType: 'dynamic-swot',
      actions: {
        updateInputData: vi.fn(),
        addSWOTSignal: vi.fn(),
        addSWOTItem: vi.fn(),
        addCorrelation: vi.fn(),
        setSWOTTensions: vi.fn(),
        setSWOTMoves: vi.fn(),
        setSWOTOutputCandidates: vi.fn(),
        setSWOTSummary: vi.fn(),
        setInitiatives: vi.fn(),
        setSessionGenerationStatus: vi.fn(),
        updateCardAfterRethink: vi.fn(),
      },
    });

    expect(result.missionSuggestion).toEqual(
      expect.objectContaining({
        goal: 'Sharper goal',
        scope: 'Sharper scope',
        successSignal: 'Sharper success',
        timeframe: 'long',
      })
    );
  });
});
