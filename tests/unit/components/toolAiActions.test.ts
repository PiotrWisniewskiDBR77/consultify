import { describe, expect, it } from 'vitest';

import { getToolPhaseAiActions } from '../../../src/components/DiscoveryTools/toolAiActions';

describe('toolAiActions registry', () => {
  it('returns mission framing and full-session actions for SWOT mission', () => {
    const actions = getToolPhaseAiActions('dynamic-swot', {
      id: 'mission',
      name: 'Mission & Context',
      namePl: 'Mission & Context',
      description: 'Define mission',
      descriptionPl: 'Zdefiniuj mission',
      required: true,
      aiAssisted: false,
    });

    expect(actions.map((action) => action.id)).toEqual(['suggest-step', 'generate-full-session']);
  });

  it('returns summary action for AI-assisted summary steps', () => {
    const actions = getToolPhaseAiActions('market-forces', {
      id: 'summary',
      name: 'Summary',
      namePl: 'Podsumowanie',
      description: 'Summarize',
      descriptionPl: 'Podsumuj',
      required: true,
      aiAssisted: true,
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]?.id).toBe('generate-summary');
  });
});
