/**
 * Unit Tests for ReportApprovalService
 *
 * Tests the multi-level approval workflow for Management Reports.
 */

const ReportApprovalService = require('../services/reportApprovalService');

// Mock database
jest.mock('../database', () => {
  const mockDb = {
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn(),
  };
  return mockDb;
});

const db = require('../database');

describe('ReportApprovalService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initializeApprovalWorkflow', () => {
    it('should create approval records for each level', async () => {
      // Mock report exists
      db.get.mockImplementation((sql, params, callback) => {
        if (sql.includes('FROM management_reports')) {
          callback(null, { id: 'report1', organization_id: 'org1' });
        } else if (sql.includes('FROM management_report_versions')) {
          callback(null, { id: 'version1' });
        }
      });

      db.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 1, changes: 1 }, null);
      });

      const config = {
        levels: [
          { level: 1, role: 'MANAGER', required: true, slaHours: 24 },
          { level: 2, role: 'PMO_LEAD', required: true, slaHours: 48 },
        ],
      };

      const result = await ReportApprovalService.initializeApprovalWorkflow(
        'report1',
        config,
        'user1'
      );

      expect(result.reportId).toBe('report1');
      expect(result.totalLevels).toBe(2);
      expect(result.approvals.length).toBe(2);
      expect(db.run).toHaveBeenCalled();
    });

    it('should throw error if report not found', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, null);
      });

      await expect(
        ReportApprovalService.initializeApprovalWorkflow('nonexistent', {}, 'user1')
      ).rejects.toThrow('Report not found');
    });
  });

  describe('submitForApproval', () => {
    it('should submit draft report for approval', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        if (sql.includes('FROM management_reports WHERE id')) {
          callback(null, {
            id: 'report1',
            status: 'DRAFT',
            organization_id: 'org1',
            report_type: 'TEAM_MEETING',
          });
        } else if (sql.includes('FROM management_report_versions')) {
          callback(null, { id: 'version1' });
        } else if (sql.includes('FROM management_report_approval_presets')) {
          callback(null, null);
        }
      });

      db.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 1, changes: 1 }, null);
      });

      const result = await ReportApprovalService.submitForApproval('report1', 'user1');

      expect(result.success).toBe(true);
      expect(result.approvalStatus).toBe('PENDING');
    });

    it('should reject submission if report is not draft', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { id: 'report1', status: 'FINAL' });
      });

      await expect(ReportApprovalService.submitForApproval('report1', 'user1')).rejects.toThrow(
        'Cannot submit report with status FINAL'
      );
    });

    it('should reject submission if report is locked', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { id: 'report1', status: 'DRAFT', locked_at: new Date().toISOString() });
      });

      await expect(ReportApprovalService.submitForApproval('report1', 'user1')).rejects.toThrow(
        'Report is locked'
      );
    });
  });

  describe('approve', () => {
    it('should approve at current level and advance workflow', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        if (sql.includes('FROM management_reports')) {
          callback(null, {
            id: 'report1',
            approval_status: 'PENDING',
            organization_id: 'org1',
          });
        } else if (sql.includes('FROM users WHERE id')) {
          callback(null, { id: 'user1', role: 'ADMIN' });
        } else if (sql.includes('FROM management_report_approvals') && sql.includes('PENDING')) {
          if (sql.includes('approval_level >')) {
            callback(null, null); // No more pending levels
          } else {
            callback(null, {
              id: 'approval1',
              approval_level: 1,
              required_role: 'MANAGER',
            });
          }
        }
      });

      db.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      const result = await ReportApprovalService.approve('report1', 'user1', 'LGTM');

      expect(result.success).toBe(true);
      expect(result.approvedLevel).toBe(1);
      expect(result.allLevelsComplete).toBe(true);
    });

    it('should reject if not pending approval', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { id: 'report1', approval_status: 'NONE' });
      });

      await expect(ReportApprovalService.approve('report1', 'user1')).rejects.toThrow(
        'Report is not pending approval'
      );
    });
  });

  describe('reject', () => {
    it('should reject and return to draft', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        if (sql.includes('FROM management_reports')) {
          callback(null, {
            id: 'report1',
            approval_status: 'PENDING',
            organization_id: 'org1',
            status: 'DRAFT',
          });
        } else if (sql.includes('FROM users WHERE id')) {
          callback(null, { id: 'user1', role: 'ADMIN' });
        } else if (sql.includes('FROM management_report_approvals')) {
          callback(null, {
            id: 'approval1',
            approval_level: 1,
            required_role: 'MANAGER',
          });
        }
      });

      db.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      const result = await ReportApprovalService.reject('report1', 'user1', 'Needs revision', true);

      expect(result.success).toBe(true);
      expect(result.returnedToDraft).toBe(true);
      expect(result.reportApprovalStatus).toBe('NONE');
    });

    it('should require rejection comment', async () => {
      await expect(ReportApprovalService.reject('report1', 'user1', '')).rejects.toThrow(
        'Rejection comment is required'
      );
    });
  });

  describe('getApprovalStatus', () => {
    it('should return complete approval chain', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, {
          id: 'report1',
          approval_status: 'PENDING',
          organization_id: 'org1',
        });
      });

      db.all.mockImplementation((sql, params, callback) => {
        callback(null, [
          { id: 'a1', approval_level: 1, required_role: 'MANAGER', status: 'APPROVED' },
          { id: 'a2', approval_level: 2, required_role: 'PMO_LEAD', status: 'PENDING' },
        ]);
      });

      const result = await ReportApprovalService.getApprovalStatus('report1');

      expect(result.totalLevels).toBe(2);
      expect(result.levels.length).toBe(2);
      expect(result.overallStatus).toBe('PENDING');
    });
  });

  describe('getPendingApprovalsForUser', () => {
    it('should return pending approvals for user role', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        if (sql.includes('FROM users')) {
          callback(null, { role: 'MANAGER' });
        } else if (sql.includes('COUNT')) {
          callback(null, { total: 3 });
        }
      });

      db.all.mockImplementation((sql, params, callback) => {
        callback(null, [
          { id: 'a1', report_id: 'r1', report_title: 'Report 1', approval_level: 1 },
          { id: 'a2', report_id: 'r2', report_title: 'Report 2', approval_level: 1 },
        ]);
      });

      const result = await ReportApprovalService.getPendingApprovalsForUser('user1', 'org1');

      expect(result.approvals.length).toBe(2);
      expect(result.total).toBe(3);
    });
  });

  describe('skipApprovalLevel', () => {
    it('should skip level with reason', async () => {
      db.get.mockImplementation((sql, params, callback) => {
        if (sql.includes('COUNT')) {
          callback(null, { count: 0 }); // No more pending
        } else {
          callback(null, {
            id: 'approval1',
            approval_level: 1,
            status: 'PENDING',
          });
        }
      });

      db.run.mockImplementation((sql, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      const result = await ReportApprovalService.skipApprovalLevel(
        'report1',
        1,
        'admin1',
        'Urgent'
      );

      expect(result.success).toBe(true);
      expect(result.skippedLevel).toBe(1);
    });

    it('should require reason for skip', async () => {
      await expect(
        ReportApprovalService.skipApprovalLevel('report1', 1, 'admin1', '')
      ).rejects.toThrow('Reason is required');
    });
  });
});
