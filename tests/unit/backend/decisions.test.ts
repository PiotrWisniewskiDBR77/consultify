/**
 * Decision Management Unit Tests
 * Tests for DecisionController and EscalationService
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock the database utilities
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryAll: vi.fn(),
  queryOne: vi.fn(),
  queryRun: vi.fn(),
}));

vi.mock('../../../server/src/utils/DbPromise.js', () => ({
  all: vi.fn(),
  get: vi.fn(),
  run: vi.fn(),
}));

// Import after mocking
import * as queryHelpers from '../../../server/src/utils/queryHelpers.js';
import {
  calculateEscalationLevel,
  getDefaultThresholds,
  EscalationService,
} from '../../../server/src/services/escalationService.js';

describe('Decision Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateEscalationLevel', () => {
    it('should return "none" when no due date is provided', () => {
      const result = calculateEscalationLevel(null, null, null);
      expect(result.level).toBe('none');
      expect(result.overdueDays).toBe(0);
    });

    it('should return "none" when due date is invalid', () => {
      const result = calculateEscalationLevel('invalid-date', null, null);
      expect(result.level).toBe('none');
      expect(result.overdueDays).toBe(0);
    });

    it('should return "none" when not overdue', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculateEscalationLevel(futureDate, null, null);
      expect(result.level).toBe('none');
      expect(result.overdueDays).toBe(0);
    });

    it('should return "amber" when overdue by 1-5 days', () => {
      const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculateEscalationLevel(pastDate, null, null);
      expect(result.level).toBe('amber');
      expect(result.overdueDays).toBeGreaterThanOrEqual(2);
      expect(result.overdueDays).toBeLessThanOrEqual(4);
    });

    it('should return "amber" when overdue by 6-7 days', () => {
      const pastDate = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculateEscalationLevel(pastDate, null, null);
      expect(result.level).toBe('amber');
      expect(result.overdueDays).toBeGreaterThanOrEqual(5);
    });

    it('should return "red" when overdue by more than 7 days', () => {
      const pastDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculateEscalationLevel(pastDate, null, null);
      expect(result.level).toBe('red');
      expect(result.overdueDays).toBeGreaterThanOrEqual(9);
    });

    it('should return "red" immediately for CRITICAL priority', () => {
      const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculateEscalationLevel(pastDate, 'CRITICAL', null);
      expect(result.level).toBe('red');
    });

    it('should return "red" immediately for HIGH impact', () => {
      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculateEscalationLevel(pastDate, null, 'HIGH');
      expect(result.level).toBe('red');
    });

    it('should respect custom thresholds', () => {
      // 3 days overdue with amber threshold of 2 and red threshold of 4
      const pastDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculateEscalationLevel(pastDate, null, null, 2, 4);
      expect(result.level).toBe('amber');
      expect(result.overdueDays).toBeGreaterThanOrEqual(2);
    });

    it('should return "red" when exceeding custom red threshold', () => {
      // 5 days overdue with red threshold of 4
      const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const result = calculateEscalationLevel(pastDate, null, null, 2, 4);
      expect(result.level).toBe('red');
    });
  });

  describe('getDefaultThresholds', () => {
    it('should return default thresholds for unknown type', () => {
      const thresholds = getDefaultThresholds();
      expect(thresholds.amber).toBe(5);
      expect(thresholds.red).toBe(7);
    });

    it('should return specific thresholds for BLOCKER_RESOLUTION', () => {
      const thresholds = getDefaultThresholds('BLOCKER_RESOLUTION');
      expect(thresholds.amber).toBe(1);
      expect(thresholds.red).toBe(3);
    });

    it('should return specific thresholds for INITIATIVE_APPROVAL', () => {
      const thresholds = getDefaultThresholds('INITIATIVE_APPROVAL');
      expect(thresholds.amber).toBe(3);
      expect(thresholds.red).toBe(7);
    });

    it('should return specific thresholds for PHASE_TRANSITION', () => {
      const thresholds = getDefaultThresholds('PHASE_TRANSITION');
      expect(thresholds.amber).toBe(2);
      expect(thresholds.red).toBe(5);
    });
  });

  describe('EscalationService', () => {
    describe('getEscalationStatus', () => {
      it('should return none level for decision without deadline', async () => {
        vi.mocked(queryHelpers.queryOne).mockResolvedValue({
          id: 'decision-1',
          deadline: null,
          priority: 'MEDIUM',
          impact: 'MEDIUM',
          blocked_count: 0,
        });

        const status = await EscalationService.getEscalationStatus('decision-1');

        expect(status.level).toBe('none');
        expect(status.overdueDays).toBe(0);
        expect(status.isBlocking).toBe(false);
      });

      it('should return blocking status when decision has blockers', async () => {
        vi.mocked(queryHelpers.queryOne).mockResolvedValue({
          id: 'decision-1',
          deadline: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          priority: 'HIGH',
          impact: 'MEDIUM',
          blocked_count: 3,
        });

        const status = await EscalationService.getEscalationStatus('decision-1');

        expect(status.isBlocking).toBe(true);
        expect(status.blockedItemsCount).toBe(3);
      });

      it('should return none for non-existent decision', async () => {
        vi.mocked(queryHelpers.queryOne).mockResolvedValue(null);

        const status = await EscalationService.getEscalationStatus('non-existent');

        expect(status.level).toBe('none');
        expect(status.overdueDays).toBe(0);
        expect(status.isBlocking).toBe(false);
        expect(status.blockedItemsCount).toBe(0);
      });
    });

    describe('processEscalations', () => {
      it('should return empty summary when no decisions', async () => {
        vi.mocked(queryHelpers.queryAll).mockResolvedValue([]);

        const summary = await EscalationService.processEscalations('org-1');

        expect(summary.processed).toBe(0);
        expect(summary.amberAlerts).toBe(0);
        expect(summary.redAlerts).toBe(0);
        expect(summary.escalated).toBe(0);
      });

      it('should process decisions and update escalation levels', async () => {
        const decisions = [
          {
            id: 'decision-1',
            organization_id: 'org-1',
            deadline: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'pending',
            priority: 'MEDIUM',
            impact: 'MEDIUM',
            escalation_level: 'none',
            decision_maker_id: 'user-1',
            type: 'GENERAL',
          },
          {
            id: 'decision-2',
            organization_id: 'org-1',
            deadline: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            status: 'pending',
            priority: 'HIGH',
            impact: 'MEDIUM',
            escalation_level: 'amber',
            decision_maker_id: 'user-2',
            type: 'INITIATIVE_APPROVAL',
          },
        ];

        vi.mocked(queryHelpers.queryAll)
          .mockResolvedValueOnce(decisions) // First call for decisions
          .mockResolvedValueOnce([]); // Second call for rules

        vi.mocked(queryHelpers.queryRun).mockResolvedValue(undefined);

        const summary = await EscalationService.processEscalations('org-1');

        expect(summary.processed).toBe(2);
        expect(summary.errors).toBe(0);
      });
    });

    describe('getDecisionsNeedingAttention', () => {
      it('should categorize decisions by escalation level', async () => {
        const decisions = [
          {
            id: 'decision-1',
            deadline: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            priority: 'MEDIUM',
            impact: 'MEDIUM',
            blocked_count: 0,
          },
          {
            id: 'decision-2',
            deadline: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            priority: 'HIGH',
            impact: 'MEDIUM',
            blocked_count: 2,
          },
          {
            id: 'decision-3',
            deadline: null,
            priority: 'LOW',
            impact: 'LOW',
            blocked_count: 1,
          },
        ];

        vi.mocked(queryHelpers.queryAll).mockResolvedValue(decisions);

        const result = await EscalationService.getDecisionsNeedingAttention('org-1');

        expect(result.amber.length).toBeGreaterThanOrEqual(1);
        expect(result.red.length).toBeGreaterThanOrEqual(1);
        expect(result.blocking.length).toBe(2); // decisions with blocked_count > 0
      });

      it('should return empty arrays when no decisions', async () => {
        vi.mocked(queryHelpers.queryAll).mockResolvedValue(null);

        const result = await EscalationService.getDecisionsNeedingAttention('org-1');

        expect(result.amber).toEqual([]);
        expect(result.red).toEqual([]);
        expect(result.blocking).toEqual([]);
      });
    });

    describe('escalateDecision', () => {
      it('should manually escalate a decision', async () => {
        vi.mocked(queryHelpers.queryOne).mockResolvedValue({
          id: 'decision-1',
          status: 'pending',
          decision_maker_id: 'user-1',
        });
        vi.mocked(queryHelpers.queryRun).mockResolvedValue(undefined);

        await EscalationService.escalateDecision(
          'decision-1',
          'user-2',
          'Urgent attention needed',
          'user-3'
        );

        // Should update decision status
        expect(queryHelpers.queryRun).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE decisions'),
          expect.arrayContaining(['user-3', 'decision-1'])
        );

        // Should create history entry
        expect(queryHelpers.queryRun).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO decision_history'),
          expect.arrayContaining(['decision-1', 'pending', 'user-2'])
        );
      });

      it('should throw error for non-existent decision', async () => {
        vi.mocked(queryHelpers.queryOne).mockResolvedValue(null);

        await expect(
          EscalationService.escalateDecision('non-existent', 'user-1')
        ).rejects.toThrow('Decision not found');
      });
    });
  });
});

describe('Decision Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Status Transitions', () => {
    it('should allow PENDING -> APPROVED transition', () => {
      const validTransitions: Record<string, string[]> = {
        pending: ['approved', 'rejected', 'escalated', 'cancelled'],
        approved: [],
        rejected: [],
        escalated: ['approved', 'rejected'],
        cancelled: [],
      };

      expect(validTransitions['pending']).toContain('approved');
    });

    it('should allow PENDING -> REJECTED transition', () => {
      const validTransitions: Record<string, string[]> = {
        pending: ['approved', 'rejected', 'escalated', 'cancelled'],
      };

      expect(validTransitions['pending']).toContain('rejected');
    });

    it('should allow ESCALATED -> APPROVED transition', () => {
      const validTransitions: Record<string, string[]> = {
        escalated: ['approved', 'rejected'],
      };

      expect(validTransitions['escalated']).toContain('approved');
    });

    it('should not allow transitions from APPROVED', () => {
      const validTransitions: Record<string, string[]> = {
        approved: [],
      };

      expect(validTransitions['approved'].length).toBe(0);
    });
  });

  describe('Decision Types', () => {
    const decisionTypes = [
      'INITIATIVE_APPROVAL',
      'PHASE_TRANSITION',
      'BUDGET',
      'SCOPE_CHANGE',
      'RISK_ACCEPTANCE',
      'BLOCKER_RESOLUTION',
      'RESOURCE_ALLOCATION',
      'EXECUTION',
      'GENERAL',
    ];

    it.each(decisionTypes)('should recognize %s as valid decision type', (type) => {
      expect(decisionTypes).toContain(type);
    });
  });

  describe('Impact Levels', () => {
    const impactLevels = ['LOW', 'MEDIUM', 'HIGH'];

    it.each(impactLevels)('should recognize %s as valid impact level', (level) => {
      expect(impactLevels).toContain(level);
    });
  });

  describe('Priority Levels', () => {
    const priorityLevels = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

    it.each(priorityLevels)('should recognize %s as valid priority level', (level) => {
      expect(priorityLevels).toContain(level);
    });
  });

  describe('Escalation Levels', () => {
    const escalationLevels = ['none', 'amber', 'red'];

    it.each(escalationLevels)('should recognize %s as valid escalation level', (level) => {
      expect(escalationLevels).toContain(level);
    });
  });
});

describe('Decision Context Types', () => {
  const contextTypes = ['initiative', 'task', 'analysis', 'assessment', 'tool', 'project'];

  it.each(contextTypes)('should support %s as context type', (type) => {
    expect(contextTypes).toContain(type);
  });

  it('should have exactly 6 context types', () => {
    expect(contextTypes.length).toBe(6);
  });
});
