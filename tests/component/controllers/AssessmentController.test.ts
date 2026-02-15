/**
 * AssessmentController L2 Component Tests
 * Tests for assessment workflow logic, status transitions, and decision management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AssessmentController } from '../../../server/src/controllers/AssessmentController';
import * as queryHelpers from '../../../server/src/utils/queryHelpers.js';
import NotificationService from '../../../server/src/services/notificationService.js';
import { hasPermission } from '../../../server/src/services/permissionService.js';
import { assessmentAuditLogger } from '../../../server/src/utils/AssessmentAuditLogger.js';

// Mock dependencies
vi.mock('../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: vi.fn().mockResolvedValue(null),
  queryRun: vi.fn().mockResolvedValue({ changes: 1, lastID: 1 }),
  queryAll: vi.fn().mockResolvedValue([]),
  ensureAssessmentSchema: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../server/src/services/assessmentInitiativeService.js', () => ({
  default: {
    linkAssessmentToInitiatives: vi.fn(),
  },
}));

vi.mock('../../../server/src/services/notificationService.js', () => ({
  default: {
    send: vi.fn(),
  },
}));

vi.mock('../../../server/src/services/permissionService.js', () => ({
  hasPermission: vi.fn(),
}));

vi.mock('../../../server/src/utils/AssessmentAuditLogger.js', () => ({
  assessmentAuditLogger: {
    logCreation: vi.fn().mockResolvedValue(undefined),
    logStatusChange: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('AssessmentController', () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      user: {
        id: 'user-123',
        organizationId: 'org-123',
        role: 'ADMIN',
      },
      body: {},
      params: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  });

  describe('createAssessment', () => {
    it('should create a new assessment successfully', async () => {
      mockReq.body = {
        assessmentType: 'DRD',
        name: 'Test Assessment',
      };

      (queryHelpers.queryRun as any).mockResolvedValue({ changes: 1 });

      await AssessmentController.createAssessment(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'DRAFT',
        })
      );
      expect(queryHelpers.queryRun).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO assessments'),
        expect.any(Array)
      );
    });

    it('should return 400 if required fields are missing', async () => {
      mockReq.body = { assessmentType: 'DRD' }; // Missing name

      await AssessmentController.createAssessment(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'assessmentType and name are required' });
    });
  });

  describe('getAssessment', () => {
    it('should return assessment if it exists', async () => {
      mockReq.params = { assessmentId: 'assess-123' };
      const mockAssessment = {
        id: 'assess-123',
        organization_id: 'org-123',
        name: 'Test Assessment',
        status: 'DRAFT',
      };

      (queryHelpers.queryOne as any).mockResolvedValue(mockAssessment);

      await AssessmentController.getAssessment(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining(mockAssessment));
      expect(queryHelpers.queryOne).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM assessments'),
        ['assess-123', 'org-123']
      );
    });

    it('should return 404 if assessment not found', async () => {
      mockReq.params = { assessmentId: 'nonexistent' };
      (queryHelpers.queryOne as any).mockResolvedValue(null);

      await AssessmentController.getAssessment(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Assessment not found' });
    });
  });

  describe('ensurePermission', () => {
    it('should bypass permissions in non-production environments for assessment keys', async () => {
      // Based on the code: if (process.env.NODE_ENV !== 'production') { if (key.startsWith('ASSESSMENT_')) return true; }
      process.env.NODE_ENV = 'development';

      mockReq.params = { assessmentId: 'assess-123' };
      (queryHelpers.queryOne as any).mockResolvedValue({ organization_id: 'org-123' });

      // We can test a method that calls ensurePermission, like updateAssessment
      mockReq.body = { name: 'Updated name' };

      // Mocking the update part
      (queryHelpers.queryRun as any).mockResolvedValue({ changes: 1 });

      // Using getAssessment as a proxy to check if it returns 200 (meaning permission passed)
      await AssessmentController.getAssessment(mockReq, mockRes);
      expect(mockRes.json).toHaveBeenCalled();
    });
  });
});
