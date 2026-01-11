/**
 * AssessmentAuditLogger Unit Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Unit tests for AssessmentAuditLogger - 100% coverage target
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IDatabase } from '../../../../src/database/IDatabase.js';
import {
  AssessmentAuditLogger,
  assessmentAuditLogger as loggerInstance,
} from '../../../../src/utils/AssessmentAuditLogger.js';

describe('AssessmentAuditLogger', () => {
  let mockDb: IDatabase;
  let logger: AssessmentAuditLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockDbRun = vi.fn().mockResolvedValue({ success: true, lastID: 1, changes: 1 });

    logger = new AssessmentAuditLogger();
    logger.setDependencies({ dbRun: mockDbRun });

    // Store for expectations
    (logger as any)._mockDbRun = mockDbRun;
  });

  describe('log', () => {
    it('should log assessment action', async () => {
      const params = {
        userId: 'user-123',
        organizationId: 'org-123',
        action: 'assessment.created',
        resourceType: 'assessment',
        resourceId: 'assessment-123',
        details: { test: 'data' },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      };

      const auditId = await logger.log(params);

      expect(auditId).toBeDefined();
      expect((logger as any)._mockDbRun).toHaveBeenCalled();
    });

    it('should handle missing optional fields', async () => {
      const params = {
        userId: 'user-123',
        organizationId: 'org-123',
        action: 'assessment.created',
        resourceType: 'assessment',
        resourceId: 'assessment-123',
      };

      const auditId = await logger.log(params);

      expect(auditId).toBeDefined();
    });

    it('should handle database errors', async () => {
      (logger as any)._mockDbRun.mockResolvedValue({ success: false, error: 'Database error' });

      const params = {
        userId: 'user-123',
        organizationId: 'org-123',
        action: 'assessment.created',
        resourceType: 'assessment',
        resourceId: 'assessment-123',
      };

      await expect(logger.log(params)).rejects.toThrow();
    });
  });

  describe('logFromRequest', () => {
    it('should log from request object', async () => {
      const mockReq = {
        user: {
          id: 'user-123',
          organizationId: 'org-123',
        },
        ip: '127.0.0.1',
        get: vi.fn().mockReturnValue('test-agent'),
      } as unknown;

      const auditId = await logger.logFromRequest(
        mockReq as Parameters<typeof logger.logFromRequest>[0],
        'assessment.created',
        'assessment',
        'assessment-123',
        { test: 'data' }
      );

      expect(auditId).toBeDefined();
    });
  });
});
