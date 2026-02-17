import { describe, expect, it } from 'vitest';

import AIExplainabilityService from '../../server/src/services/aiExplainabilityService.ts';

describe('AI explainability service - REAL_CODE', () => {
  it('computeConfidenceLevel returns LOW for empty context', () => {
    expect(AIExplainabilityService.computeConfidenceLevel({})).toBe('LOW');
  });

  it('computeConfidenceLevel returns MEDIUM when blockers exist', () => {
    expect(
      AIExplainabilityService.computeConfidenceLevel(
        { project: { projectId: 'p' }, pmo: { healthSnapshot: { blockers: [{}] } } },
        { projectMemory: { memoryCount: 10 } }
      )
    ).toBe('MEDIUM');
  });

  it('computeConfidenceLevel returns HIGH for complete context and no blockers', () => {
    expect(
      AIExplainabilityService.computeConfidenceLevel(
        {
          project: { projectId: 'p', phase: 'X' },
          pmo: { healthSnapshot: { blockers: [] } },
          platform: { role: 'x' },
          organization: { organizationId: 'o' },
        },
        { projectMemory: { memoryCount: 1 } }
      )
    ).toBe('HIGH');
  });

  it('buildReasoningSummary includes overdue/pending/blockers', () => {
    const s = AIExplainabilityService.buildReasoningSummary({
      pmo: {
        healthSnapshot: {
          tasks: { overdueCount: 2 },
          decisions: { pendingCount: 1 },
          blockers: [1],
        },
      },
    });
    expect(s).toContain('overdue');
    expect(s).toContain('pending');
    expect(s).toContain('blocker');
  });

  it('buildExplainabilityFooter formats constraints into markdown list', () => {
    const expl = AIExplainabilityService.buildAIExplanation({
      role: 'ADVISOR',
      policy: { policyLevel: 'ADVISORY' },
      context: { project: { phase: 'C' } },
      projectMemory: { memoryCount: 3 },
    });
    const footer = AIExplainabilityService.buildExplainabilityFooter(expl);
    expect(footer).toContain('**Constraints:**');
    expect(footer).toContain('- AI Role:');
  });
});
