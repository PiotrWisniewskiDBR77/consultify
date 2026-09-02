/**
 * EscalationService - Unit Tests (L1)
 * Tests for escalation logic and decision escalation
 *
 * Coverage target: 95%+
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock queryHelpers
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryRun: vi.fn(),
  queryOne: vi.fn(),
  queryAll: vi.fn(),
}));

// Mock uuid
vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-escalation-uuid'),
}));

// Mock logger
vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  calculateEscalationLevel,
  getEscalationRules,
  getDefaultThresholds,
  EscalationService,
} from '../../../server/src/services/escalationService';
import * as queryHelpers from '../../../server/src/utils/queryHelpers.js';

describe('EscalationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('calculateEscalationLevel', () => {
    it('should return none for null due date', () => {
      const result = calculateEscalationLevel(null);
      expect(result.level).toBe('none');
      expect(result.overdueDays).toBe(0);
    });

    it('should return none for future due date', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const result = calculateEscalationLevel(futureDate.toISOString());
      expect(result.level).toBe('none');
      expect(result.overdueDays).toBe(0);
    });

    it('should return amber for overdue within amber threshold', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 3); // 3 days ago
      const result = calculateEscalationLevel(pastDate.toISOString(), null, null, 5, 7);
      expect(result.level).toBe('amber');
      expect(result.overdueDays).toBeGreaterThan(0);
    });

    it('should return red for overdue beyond red threshold', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10); // 10 days ago
      const result = calculateEscalationLevel(pastDate.toISOString(), null, null, 5, 7);
      expect(result.level).toBe('red');
      expect(result.overdueDays).toBeGreaterThan(7);
    });

    it('should escalate critical priority faster', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 2); // 2 days ago
      const result = calculateEscalationLevel(pastDate.toISOString(), 'critical', null, 5, 7);
      // Critical priority escalates to red immediately when overdue
      expect(result.level).toBe('red');
    });

    it('should handle invalid date gracefully', () => {
      const result = calculateEscalationLevel('invalid-date');
      expect(result.level).toBe('none');
      expect(result.overdueDays).toBe(0);
    });
  });

  describe('getEscalationRules', () => {
    it('should return escalation rules for organization', async () => {
      const mockRules = [
        {
          id: 'rule-1',
          name: 'Default Rule',
          contextType: 'decision' as const,
          amberThresholdDays: 5,
          redThresholdDays: 7,
          autoEscalate: true,
          notifyOnAmber: true,
          notifyOnRed: true,
          organizationId: 'org-1',
        },
      ];

      vi.mocked(queryHelpers.queryAll).mockResolvedValue(mockRules);

      const result = await getEscalationRules('org-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array if table does not exist', async () => {
      vi.mocked(queryHelpers.queryAll).mockRejectedValue(new Error('no such table'));

      const result = await getEscalationRules('org-1');

      expect(result).toEqual([]);
    });
  });

  describe('getDefaultThresholds', () => {
    it('should return default thresholds for unknown type', () => {
      const result = getDefaultThresholds('UNKNOWN_TYPE');
      expect(result.amber).toBe(5);
      expect(result.red).toBe(7);
    });

    it('should return specific thresholds for INITIATIVE_APPROVAL', () => {
      const result = getDefaultThresholds('INITIATIVE_APPROVAL');
      expect(result.amber).toBe(3);
      expect(result.red).toBe(7);
    });

    it('should return specific thresholds for BLOCKER_RESOLUTION', () => {
      const result = getDefaultThresholds('BLOCKER_RESOLUTION');
      expect(result.amber).toBe(1);
      expect(result.red).toBe(3);
    });
  });

  describe('EscalationService.getEscalations', () => {
    // Security fix (2026-09-01): `getEscalations`/`runAutoEscalation` now
    // require `organizationId` and verify the project belongs to that org
    // (`SELECT id FROM projects WHERE id = ? AND organization_id = ?`) before
    // touching `decisions` — see AUDYT_RODZINY_TRAS_UPRAWNIENIA.md family #3.
    // `queryOne` is mocked to resolve a matching project row so these
    // "happy path" tests keep exercising the downstream `queryAll`/`queryRun`
    // calls exactly as before; the negative (cross-org) case is covered by
    // the real-Postgres regression suite (`notifications.escalations.idor.realdb.test.ts`).
    it('should get escalations for project', async () => {
      const mockEscalations = [
        {
          id: 'decision-1',
          project_id: 'project-1',
          status: 'escalated',
          escalation_level: 'red',
        },
      ];

      vi.mocked(queryHelpers.queryOne).mockResolvedValue({ id: 'project-1' });
      vi.mocked(queryHelpers.queryAll).mockResolvedValue(mockEscalations);

      const result = await EscalationService.getEscalations('project-1', 'org-1');

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should filter by status if provided', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue({ id: 'project-1' });
      vi.mocked(queryHelpers.queryAll).mockResolvedValue([]);

      await EscalationService.getEscalations('project-1', 'org-1', 'escalated');

      expect(queryHelpers.queryAll).toHaveBeenCalled();
    });

    it('should return an empty array without querying decisions when the project is not in the caller org', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue(null);

      const result = await EscalationService.getEscalations('project-1', 'org-attacker');

      expect(result).toEqual([]);
      expect(queryHelpers.queryAll).not.toHaveBeenCalled();
    });
  });

  describe('EscalationService.runAutoEscalation', () => {
    it('should process escalations for project', async () => {
      const mockDecisions = [
        {
          id: 'decision-1',
          organization_id: 'org-1',
          project_id: 'project-1',
          deadline: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending',
          priority: 'high',
          impact: null,
          escalation_level: null,
        },
      ];

      vi.mocked(queryHelpers.queryOne).mockResolvedValue({ id: 'project-1' });
      vi.mocked(queryHelpers.queryAll).mockResolvedValue(mockDecisions);
      vi.mocked(queryHelpers.queryRun).mockResolvedValue({ lastID: 1, changes: 1 });

      const result = await EscalationService.runAutoEscalation('project-1', 'org-1');

      expect(result).toBeDefined();
      expect(result.processed).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty decisions list', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue({ id: 'project-1' });
      vi.mocked(queryHelpers.queryAll).mockResolvedValue([]);

      const result = await EscalationService.runAutoEscalation('project-1', 'org-1');

      expect(result.processed).toBe(0);
    });

    it('should not touch decisions when the project is not in the caller org', async () => {
      vi.mocked(queryHelpers.queryOne).mockResolvedValue(null);

      const result = await EscalationService.runAutoEscalation('project-1', 'org-attacker');

      expect(result.processed).toBe(0);
      expect(queryHelpers.queryAll).not.toHaveBeenCalled();
      expect(queryHelpers.queryRun).not.toHaveBeenCalled();
    });
  });
});
