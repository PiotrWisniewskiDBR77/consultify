import { describe, expect, it } from 'vitest';

import { computeToolReviewGaps } from '../../../src/components/DiscoveryTools/toolCompletion';
import type { SWOTData } from '../../../src/store/useToolStore';

const buildSwot = (overrides: Partial<SWOTData> = {}): SWOTData =>
  ({
    context: {
      goal: 'Define next strategic direction',
      scope: 'Whole company',
      timeframe: 'medium',
      successSignal: 'Clear strategic priority',
    },
    signals: [{ id: 's1', type: 'ai', content: 'Signal', sourceLabel: 'AI', proposalStatus: 'accepted' }],
    items: [
      { id: 'i1', text: 'Strong brand', impact: 'high', quadrant: 'strengths', proposalStatus: 'accepted' },
      { id: 'i2', text: 'High costs', impact: 'medium', quadrant: 'weaknesses', proposalStatus: 'accepted' },
      { id: 'i3', text: 'New market', impact: 'high', quadrant: 'opportunities', proposalStatus: 'accepted' },
      { id: 'i4', text: 'Competition', impact: 'medium', quadrant: 'threats', proposalStatus: 'accepted' },
    ],
    correlations: [
      { id: 'c1', items: ['i1', 'i3'], type: 'SO', insight: 'Use brand to enter market', proposalStatus: 'accepted' },
    ],
    tensions: [
      {
        id: 't1',
        title: 'Attack opportunity',
        type: 'attack',
        linkedCorrelationIds: ['c1'],
        linkedItemIds: ['i1', 'i3'],
        insight: 'Move fast',
        proposalStatus: 'accepted',
      },
    ],
    recommendedMoves: [
      {
        id: 'm1',
        title: 'Launch GTM move',
        category: 'quick-win',
        rationale: 'Capture demand',
        linkedTensionIds: ['t1'],
        linkedItemIds: ['i1', 'i3'],
        expectedImpact: 'high',
        estimatedEffort: 'medium',
        proposalStatus: 'accepted',
      },
    ],
    outputCandidates: [
      {
        id: 'o1',
        outputType: 'report',
        title: 'Board report',
        description: 'Report candidate',
        rationale: 'Ready for review',
        linkedMoveIds: ['m1'],
        linkedItemIds: ['i1', 'i3'],
        readiness: 'ready-for-report',
        proposalStatus: 'accepted',
      },
    ],
    summary: {
      proposalId: 'swot-summary',
      proposalStatus: 'accepted',
      executiveSummary: 'Accepted summary',
      keyInsights: ['Insight'],
      appliedConclusions: ['Conclusion'],
      recommendedInitiatives: [],
    },
    ...overrides,
  }) as SWOTData;

describe('toolCompletion governance gaps', () => {
  it('treats pending AI summary as an unresolved review gap', () => {
    const gaps = computeToolReviewGaps(
      'dynamic-swot',
      buildSwot({
        summary: {
          proposalId: 'swot-summary',
          proposalStatus: 'ai-proposed',
          executiveSummary: 'Pending summary',
          keyInsights: ['Insight'],
          appliedConclusions: ['Conclusion'],
          recommendedInitiatives: [],
        },
      }),
      false
    );

    expect(gaps).toContain('Missing final source summary');
  });

  it('treats AI-proposed moves and output candidates as unresolved review gaps', () => {
    const gaps = computeToolReviewGaps(
      'dynamic-swot',
      buildSwot({
        recommendedMoves: [
          {
            id: 'm1',
            title: 'Pending move',
            category: 'quick-win',
            rationale: 'Awaiting acceptance',
            linkedTensionIds: ['t1'],
            linkedItemIds: ['i1', 'i3'],
            expectedImpact: 'high',
            estimatedEffort: 'medium',
            proposalStatus: 'ai-proposed',
          },
        ],
        outputCandidates: [
          {
            id: 'o1',
            outputType: 'initiative',
            title: 'Pending initiative route',
            description: 'Awaiting acceptance',
            rationale: 'Awaiting acceptance',
            linkedMoveIds: ['m1'],
            linkedItemIds: ['i1', 'i3'],
            readiness: 'ready-for-initiative',
            proposalStatus: 'ai-proposed',
          },
        ],
      }),
      false
    );

    expect(gaps).toContain('Missing recommended moves');
    expect(gaps).toContain('Missing output candidates');
  });
});
