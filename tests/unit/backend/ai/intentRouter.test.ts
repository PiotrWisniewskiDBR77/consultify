import { describe, expect, it } from 'vitest';

import {
  classifyIntent,
  routeIntent,
} from '../../../../server/src/services/ai/intentRouter.js';

describe('intentRouter', () => {
  it('routes evidence-heavy analysis to deep research workflow', async () => {
    const result = await routeIntent(
      'Analyze the market, collect evidence, compare competitors, and cite sources for the board.',
      'org-1'
    );

    expect(result.intent).toBe('analyze');
    expect(result.workflow).toBe('deep_research');
    expect(result.suggestedModel.tier).toBe('PREMIUM');
    expect(result.suggestedModel.purpose).toBe('deep_research_synthesis');
    expect(result.requiredContext).toContain('kpis');
  });

  it('routes task and timeline changes to execution workflow', async () => {
    const result = await routeIntent(
      'Update the initiative owner, adjust the timeline, and plan the next milestone.',
      'org-1',
      { artifactIds: ['initiative-7'] }
    );

    expect(result.intent).toBe('update');
    expect(result.workflow).toBe('execution');
    expect(result.suggestedModel.purpose).toBe('task_management');
    expect(result.contextArtifacts).toHaveLength(1);
    expect(result.contextArtifacts[0]?.artifactId).toBe('initiative-7');
  });

  it('keeps lightweight clarification in chat workflow', () => {
    const result = classifyIntent('Clarify what you mean by this recommendation.');

    expect(result.intent).toBe('clarify');
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});
