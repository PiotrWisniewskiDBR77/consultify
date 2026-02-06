import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock database
vi.mock('../../../../src/utils/DbPromise.js', () => ({
  run: vi.fn().mockResolvedValue({ changes: 1 }),
  get: vi.fn(),
  all: vi.fn().mockResolvedValue([]),
}));

import * as auditService from '../../../../src/services/ai/decisionAuditService.js';

describe('DecisionAuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('logStage', () => {
    it('returns an audit ID starting with audit-', async () => {
      const id = await auditService.logStage({
        organizationId: 'org-123',
        userId: 'user-456',
        sessionId: 'sess-789',
        stage: 'confirm_start',
      });

      expect(id).toMatch(/^audit-/);
    });

    it('logs all valid stage types', async () => {
      const stages: auditService.AuditStage[] = [
        'confirm_start',
        'research_start',
        'synthesis_complete',
        'abort',
      ];

      for (const stage of stages) {
        const id = await auditService.logStage({
          organizationId: 'org-123',
          userId: 'user-456',
          sessionId: 'sess-789',
          stage,
        });
        expect(id).toMatch(/^audit-/);
      }
    });
  });

  describe('getAuditTrail', () => {
    it('returns null when no entries found', async () => {
      const trail = await auditService.getAuditTrail('non-existent-session');
      expect(trail).toBeNull();
    });
  });

  describe('exportForCompliance', () => {
    it('throws error when session not found', async () => {
      await expect(auditService.exportForCompliance('non-existent', 'json')).rejects.toThrow(
        'Audit trail not found'
      );
    });
  });
});
