import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock database
vi.mock('../../../../src/utils/DbPromise.js', () => ({
  run: vi.fn().mockResolvedValue({ changes: 1 }),
  get: vi.fn(),
  all: vi.fn().mockResolvedValue([]),
}));

import * as decisionMemory from '../../../../src/services/ai/decisionMemoryService.js';

describe('DecisionMemoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('recordDecision', () => {
    it('returns a decision ID starting with dec-', async () => {
      const id = await decisionMemory.recordDecision({
        organizationId: 'org-123',
        userId: 'user-456',
        sessionId: 'sess-789',
        decisionSummary: 'Should we expand to new market?',
        optionsConsidered: ['Option A', 'Option B'],
      });

      expect(id).toMatch(/^dec-/);
    });

    it('includes all required fields in database insert', async () => {
      const { run } = await import('../../../../src/utils/DbPromise.js');

      await decisionMemory.recordDecision({
        organizationId: 'org-123',
        userId: 'user-456',
        sessionId: 'sess-789',
        decisionSummary: 'Expand to Germany',
        chosenOption: 'Option A',
        confidenceScore: 85,
        tags: ['expansion', 'strategy'],
      });

      expect(run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO ai_decision_outcomes'),
        expect.arrayContaining([expect.stringMatching(/^dec-/), 'org-123', 'user-456', 'sess-789'])
      );
    });
  });

  describe('recordOutcome', () => {
    it('updates the outcome status', async () => {
      const { run } = await import('../../../../src/utils/DbPromise.js');

      await decisionMemory.recordOutcome({
        decisionId: 'dec-123',
        outcomeStatus: 'positive',
        outcomeNotes: 'Revenue increased by 20%',
      });

      expect(run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE ai_decision_outcomes'),
        expect.arrayContaining(['positive', 'Revenue increased by 20%'])
      );
    });
  });

  describe('buildHistoricalContextAddon', () => {
    it('returns empty string when no similar decisions found', async () => {
      const addon = await decisionMemory.buildHistoricalContextAddon({
        organizationId: 'org-123',
        currentProblem: 'Something completely new',
        language: 'en',
      });

      expect(addon).toBe('');
    });
  });
});
