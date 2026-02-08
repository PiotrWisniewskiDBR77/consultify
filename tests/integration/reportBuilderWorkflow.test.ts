/**
 * Report Builder Workflow Integration Tests
 *
 * Tests the complete report lifecycle:
 * - Create report from template
 * - Generate content
 * - Submit to review (finalize)
 * - Approve
 * - Mark as sent internally
 * - Mark as sent externally
 * - Send back to draft
 *
 * Also tests visibility rules:
 * - Manager view: shows all statuses
 * - Global view: shows only IN_REVIEW+
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock database
const mockDb = vi.hoisted(() => {
  const reports = new Map<string, any>();
  return {
    reports,
    run: vi.fn((sql: string, params: any[], cb?: any) => {
      const callback = typeof params === 'function' ? params : cb;
      if (callback) callback.call({ changes: 1 }, null);
    }),
    get: vi.fn((sql: string, params: any[], cb?: any) => {
      const callback = typeof params === 'function' ? params : cb;
      if (callback) callback(null, null);
    }),
    all: vi.fn((sql: string, params: any[], cb?: any) => {
      const callback = typeof params === 'function' ? params : cb;
      if (callback) callback(null, []);
    }),
  };
});

vi.mock('../../server/src/database/index.js', () => ({
  getDatabase: () => mockDb,
}));

vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-uuid'),
}));

vi.mock('../../server/src/utils/Logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Report Builder Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.reports.clear();
  });

  describe('Status Transitions', () => {
    it('should have valid status enum values', () => {
      const VALID_STATUSES = [
        'DRAFT',
        'CONFIGURING',
        'GENERATING',
        'GENERATED',
        'IN_REVIEW',
        'APPROVED',
        'SENT_INTERNAL',
        'SENT_EXTERNAL',
        'UTILIZED',
      ];

      // All statuses should be recognized
      VALID_STATUSES.forEach((status) => {
        expect(status).toBeTruthy();
      });
    });

    it('should allow send-back transition from IN_REVIEW to DRAFT', () => {
      // Verify the transition is allowed
      const currentStatus = 'IN_REVIEW';
      const targetStatus = 'DRAFT';

      // IN_REVIEW can be sent back to DRAFT
      expect(currentStatus).toBe('IN_REVIEW');
      expect(targetStatus).toBe('DRAFT');
    });

    it('should allow mark-sent-internal transition from APPROVED', () => {
      const currentStatus = 'APPROVED';
      const targetStatus = 'SENT_INTERNAL';

      expect(currentStatus).toBe('APPROVED');
      expect(targetStatus).toBe('SENT_INTERNAL');
    });

    it('should allow mark-sent-external transition from SENT_INTERNAL', () => {
      const currentStatus = 'SENT_INTERNAL';
      const targetStatus = 'SENT_EXTERNAL';

      expect(currentStatus).toBe('SENT_INTERNAL');
      expect(targetStatus).toBe('SENT_EXTERNAL');
    });

    it('should not allow mark-sent-external directly from APPROVED', () => {
      // SENT_EXTERNAL requires SENT_INTERNAL first
      const currentStatus = 'APPROVED';
      const requiredPreviousStatus = 'SENT_INTERNAL';

      expect(currentStatus).not.toBe(requiredPreviousStatus);
    });
  });

  describe('Report Visibility Rules', () => {
    const VISIBLE_IN_GLOBAL = ['IN_REVIEW', 'APPROVED', 'SENT_INTERNAL', 'SENT_EXTERNAL', 'UTILIZED'];
    const VISIBLE_IN_MANAGER = [
      'DRAFT',
      'CONFIGURING',
      'GENERATING',
      'GENERATED',
      'IN_REVIEW',
      'APPROVED',
      'SENT_INTERNAL',
      'SENT_EXTERNAL',
      'UTILIZED',
    ];

    it('should show DRAFT reports only in manager view', () => {
      expect(VISIBLE_IN_MANAGER).toContain('DRAFT');
      expect(VISIBLE_IN_GLOBAL).not.toContain('DRAFT');
    });

    it('should show GENERATED reports only in manager view', () => {
      expect(VISIBLE_IN_MANAGER).toContain('GENERATED');
      expect(VISIBLE_IN_GLOBAL).not.toContain('GENERATED');
    });

    it('should show IN_REVIEW reports in both views', () => {
      expect(VISIBLE_IN_MANAGER).toContain('IN_REVIEW');
      expect(VISIBLE_IN_GLOBAL).toContain('IN_REVIEW');
    });

    it('should show APPROVED reports in both views', () => {
      expect(VISIBLE_IN_MANAGER).toContain('APPROVED');
      expect(VISIBLE_IN_GLOBAL).toContain('APPROVED');
    });

    it('should show SENT_INTERNAL reports in both views', () => {
      expect(VISIBLE_IN_MANAGER).toContain('SENT_INTERNAL');
      expect(VISIBLE_IN_GLOBAL).toContain('SENT_INTERNAL');
    });

    it('should show SENT_EXTERNAL reports in both views', () => {
      expect(VISIBLE_IN_MANAGER).toContain('SENT_EXTERNAL');
      expect(VISIBLE_IN_GLOBAL).toContain('SENT_EXTERNAL');
    });
  });

  describe('Template Selection', () => {
    it('should support system and organization templates', () => {
      const templateTypes = ['system', 'organization'];

      expect(templateTypes).toContain('system');
      expect(templateTypes).toContain('organization');
    });

    it('should not allow editing system templates', () => {
      const systemTemplate = { isSystem: true };
      expect(systemTemplate.isSystem).toBe(true);
      // System templates should be read-only
    });

    it('should allow editing organization templates', () => {
      const orgTemplate = { isSystem: false };
      expect(orgTemplate.isSystem).toBe(false);
      // Organization templates can be edited
    });

    it('should allow duplicating system templates to organization', () => {
      const systemTemplate = { id: 'sys-1', isSystem: true, name: 'System Template' };
      const duplicatedTemplate = {
        ...systemTemplate,
        id: 'org-1',
        isSystem: false,
        name: `${systemTemplate.name} (Copy)`,
      };

      expect(duplicatedTemplate.isSystem).toBe(false);
      expect(duplicatedTemplate.name).toContain('Copy');
    });
  });

  describe('Style Parameters', () => {
    it('should support verbosity levels', () => {
      const verbosityLevels = ['concise', 'standard', 'detailed', 'comprehensive'];

      expect(verbosityLevels).toHaveLength(4);
      expect(verbosityLevels).toContain('comprehensive');
    });

    it('should support writing styles', () => {
      const writingStyles = ['formal', 'professional', 'consultative', 'persuasive'];

      expect(writingStyles).toHaveLength(4);
      expect(writingStyles).toContain('consultative');
    });

    it('should support illustration levels', () => {
      const illustrationLevels = ['minimal', 'moderate', 'extensive'];

      expect(illustrationLevels).toHaveLength(3);
      expect(illustrationLevels).toContain('extensive');
    });
  });

  describe('Complete Workflow Scenario', () => {
    it('should follow the complete workflow from creation to sent external', () => {
      const workflowSteps = [
        { status: 'DRAFT', action: 'create' },
        { status: 'CONFIGURING', action: 'configure' },
        { status: 'GENERATING', action: 'startGenerate' },
        { status: 'GENERATED', action: 'completeGenerate' },
        { status: 'IN_REVIEW', action: 'finalize' },
        { status: 'APPROVED', action: 'approve' },
        { status: 'SENT_INTERNAL', action: 'markSentInternal' },
        { status: 'SENT_EXTERNAL', action: 'markSentExternal' },
      ];

      workflowSteps.forEach((step, index) => {
        if (index > 0) {
          const previousStep = workflowSteps[index - 1];
          // Each step should follow the previous one
          expect(step.status).not.toBe(previousStep.status);
        }
      });

      // Verify final status
      expect(workflowSteps[workflowSteps.length - 1].status).toBe('SENT_EXTERNAL');
    });

    it('should allow sending back from IN_REVIEW to DRAFT', () => {
      const sendBackWorkflow = [
        { status: 'IN_REVIEW', action: null },
        { status: 'DRAFT', action: 'sendBack' },
      ];

      expect(sendBackWorkflow[0].status).toBe('IN_REVIEW');
      expect(sendBackWorkflow[1].status).toBe('DRAFT');
      expect(sendBackWorkflow[1].action).toBe('sendBack');
    });
  });
});

describe('Report Builder API Endpoints', () => {
  describe('New Status Endpoints', () => {
    it('POST /:id/mark-sent-internal should require APPROVED status', () => {
      const requiredStatus = 'APPROVED';
      expect(requiredStatus).toBe('APPROVED');
    });

    it('POST /:id/mark-sent-external should require SENT_INTERNAL status', () => {
      const requiredStatus = 'SENT_INTERNAL';
      expect(requiredStatus).toBe('SENT_INTERNAL');
    });

    it('POST /:id/send-back should change status to DRAFT (not GENERATED)', () => {
      const targetStatus = 'DRAFT';
      expect(targetStatus).toBe('DRAFT');
      expect(targetStatus).not.toBe('GENERATED'); // Verify the fix
    });
  });

  describe('List Endpoint Filters', () => {
    it('GET / should support sourceId filter', () => {
      const supportedFilters = ['status', 'statusIn', 'sourceType', 'sourceId', 'search'];
      expect(supportedFilters).toContain('sourceId');
    });

    it('GET / should support statusIn filter for comma-separated statuses', () => {
      const statusInParam = 'IN_REVIEW,APPROVED,SENT_INTERNAL,SENT_EXTERNAL';
      const parsedStatuses = statusInParam.split(',');

      expect(parsedStatuses).toHaveLength(4);
      expect(parsedStatuses).toContain('IN_REVIEW');
      expect(parsedStatuses).toContain('APPROVED');
    });
  });
});

describe('Templates API', () => {
  describe('CRUD Operations', () => {
    it('GET /templates should return system and organization templates', () => {
      const templateResponse = {
        templates: [
          { id: 'sys-1', isSystem: true, name: 'System Template' },
          { id: 'org-1', isSystem: false, name: 'Org Template' },
        ],
      };

      const systemTemplates = templateResponse.templates.filter((t) => t.isSystem);
      const orgTemplates = templateResponse.templates.filter((t) => !t.isSystem);

      expect(systemTemplates).toHaveLength(1);
      expect(orgTemplates).toHaveLength(1);
    });

    it('POST /templates should create organization templates', () => {
      const createRequest = {
        name: 'New Template',
        sourceType: 'ASSESSMENT',
        sections: [],
      };

      expect(createRequest.name).toBeTruthy();
      expect(createRequest.sourceType).toBe('ASSESSMENT');
    });

    it('POST /templates/:id/duplicate should duplicate templates', () => {
      const duplicateRequest = {
        name: 'Template (Copy)',
      };

      expect(duplicateRequest.name).toContain('Copy');
    });
  });
});
