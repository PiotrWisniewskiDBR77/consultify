/**
 * Project Member Service Tests
 * 
 * PMO Standards Compliant Team Management
 * 
 * Standards:
 * - ISO 21500:2021 - Project Team (Clause 4.6.2)
 * - PMI PMBOK 7th Edition - Team Performance Domain
 * - PRINCE2 - Organization Theme (Project Roles)
 */

const { describe, it, expect, beforeEach, afterEach, vi } = require('vitest');

// Mock database
const mockDb = {
  runAsync: vi.fn(),
  getAsync: vi.fn(),
  allAsync: vi.fn()
};

vi.mock('../../server/db', () => ({
  default: mockDb,
  ...mockDb
}));

vi.mock('../../server/services/pmoDomainRegistry', () => ({
  PMO_DOMAIN_IDS: {
    GOVERNANCE_DECISION_MAKING: 'GOVERNANCE_DECISION_MAKING',
    SCOPE_CHANGE_CONTROL: 'SCOPE_CHANGE_CONTROL',
    SCHEDULE_MILESTONES: 'SCHEDULE_MILESTONES',
    RISK_ISSUE_MANAGEMENT: 'RISK_ISSUE_MANAGEMENT',
    RESOURCE_RESPONSIBILITY: 'RESOURCE_RESPONSIBILITY',
    PERFORMANCE_MONITORING: 'PERFORMANCE_MONITORING',
    BENEFITS_REALIZATION: 'BENEFITS_REALIZATION'
  }
}));

vi.mock('../../server/services/pmoStandardsMapping', () => ({
  default: {
    getMapping: vi.fn(() => ({
      iso21500: { term: 'Project Team (4.6.2)' },
      pmbok7: { term: 'Team Performance Domain' },
      prince2: { term: 'Organization Theme' }
    }))
  }
}));

const ProjectMemberService = require('../../server/services/projectMemberService');

describe('ProjectMemberService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('PROJECT_ROLES', () => {
    it('should define all 11 project roles', () => {
      const roles = ProjectMemberService.PROJECT_ROLES;
      
      expect(roles.SPONSOR).toBe('SPONSOR');
      expect(roles.DECISION_OWNER).toBe('DECISION_OWNER');
      expect(roles.PMO_LEAD).toBe('PMO_LEAD');
      expect(roles.WORKSTREAM_OWNER).toBe('WORKSTREAM_OWNER');
      expect(roles.INITIATIVE_OWNER).toBe('INITIATIVE_OWNER');
      expect(roles.TASK_ASSIGNEE).toBe('TASK_ASSIGNEE');
      expect(roles.SME).toBe('SME');
      expect(roles.REVIEWER).toBe('REVIEWER');
      expect(roles.OBSERVER).toBe('OBSERVER');
      expect(roles.CONSULTANT).toBe('CONSULTANT');
      expect(roles.STAKEHOLDER).toBe('STAKEHOLDER');
    });
  });

  describe('DEFAULT_PERMISSIONS', () => {
    it('should have permissions for all roles', () => {
      const roles = Object.keys(ProjectMemberService.PROJECT_ROLES);
      const permissions = ProjectMemberService.DEFAULT_PERMISSIONS;
      
      roles.forEach(role => {
        expect(permissions[role]).toBeDefined();
        expect(typeof permissions[role].canViewProject).toBe('boolean');
        expect(typeof permissions[role].canAssignTasks).toBe('boolean');
      });
    });

    it('should give SPONSOR full view and approval permissions', () => {
      const sponsorPerms = ProjectMemberService.DEFAULT_PERMISSIONS.SPONSOR;
      
      expect(sponsorPerms.canViewProject).toBe(true);
      expect(sponsorPerms.canViewTasks).toBe(true);
      expect(sponsorPerms.canViewFinancials).toBe(true);
      expect(sponsorPerms.canApproveDecisions).toBe(true);
      expect(sponsorPerms.canApproveChangeRequests).toBe(true);
      expect(sponsorPerms.canManageTeam).toBe(true);
      expect(sponsorPerms.canReceiveEscalations).toBe(true);
    });

    it('should give PMO_LEAD full operational permissions', () => {
      const pmoPerms = ProjectMemberService.DEFAULT_PERMISSIONS.PMO_LEAD;
      
      expect(pmoPerms.canCreateTasks).toBe(true);
      expect(pmoPerms.canAssignTasks).toBe(true);
      expect(pmoPerms.canUpdateTasks).toBe(true);
      expect(pmoPerms.canDeleteTasks).toBe(true);
      expect(pmoPerms.canManageTeam).toBe(true);
      expect(pmoPerms.canManageWorkstreams).toBe(true);
      expect(pmoPerms.canConfigureProject).toBe(true);
    });

    it('should give TASK_ASSIGNEE limited permissions', () => {
      const assigneePerms = ProjectMemberService.DEFAULT_PERMISSIONS.TASK_ASSIGNEE;
      
      expect(assigneePerms.canViewProject).toBe(true);
      expect(assigneePerms.canUpdateTasks).toBe(true);
      expect(assigneePerms.canEscalate).toBe(true);
      
      expect(assigneePerms.canCreateTasks).toBe(false);
      expect(assigneePerms.canAssignTasks).toBe(false);
      expect(assigneePerms.canDeleteTasks).toBe(false);
      expect(assigneePerms.canManageTeam).toBe(false);
    });

    it('should give OBSERVER read-only permissions', () => {
      const observerPerms = ProjectMemberService.DEFAULT_PERMISSIONS.OBSERVER;
      
      expect(observerPerms.canViewProject).toBe(true);
      expect(observerPerms.canViewTasks).toBe(true);
      expect(observerPerms.canViewInitiatives).toBe(true);
      
      expect(observerPerms.canCreateTasks).toBe(false);
      expect(observerPerms.canUpdateTasks).toBe(false);
      expect(observerPerms.canEscalate).toBe(false);
    });
  });

  describe('RACI_MATRIX', () => {
    it('should define RACI for all object types', () => {
      const raci = ProjectMemberService.RACI_MATRIX;
      
      expect(raci.PROJECT).toBeDefined();
      expect(raci.INITIATIVE).toBeDefined();
      expect(raci.TASK).toBeDefined();
      expect(raci.DECISION).toBeDefined();
      expect(raci.CHANGE_REQUEST).toBeDefined();
      expect(raci.ASSESSMENT).toBeDefined();
      expect(raci.ROADMAP).toBeDefined();
      expect(raci.STAGE_GATE).toBeDefined();
    });

    it('should assign PMO_LEAD as Responsible for PROJECT', () => {
      expect(ProjectMemberService.RACI_MATRIX.PROJECT.PMO_LEAD).toBe('R');
    });

    it('should assign SPONSOR as Accountable for PROJECT', () => {
      expect(ProjectMemberService.RACI_MATRIX.PROJECT.SPONSOR).toBe('A');
    });

    it('should assign TASK_ASSIGNEE as Responsible for TASK', () => {
      expect(ProjectMemberService.RACI_MATRIX.TASK.TASK_ASSIGNEE).toBe('R');
    });

    it('should assign DECISION_OWNER as Responsible for DECISION', () => {
      expect(ProjectMemberService.RACI_MATRIX.DECISION.DECISION_OWNER).toBe('R');
    });
  });

  describe('addMember', () => {
    it('should add a member with valid role', async () => {
      mockDb.getAsync.mockResolvedValueOnce(null); // No existing member
      mockDb.runAsync.mockResolvedValueOnce({}); // Insert
      mockDb.runAsync.mockResolvedValueOnce({}); // Audit log
      mockDb.getAsync.mockResolvedValueOnce({
        id: 'member-1',
        project_id: 'project-1',
        user_id: 'user-1',
        project_role: 'TASK_ASSIGNEE',
        allocation_percent: 100,
        permissions: JSON.stringify(ProjectMemberService.DEFAULT_PERMISSIONS.TASK_ASSIGNEE),
        created_at: new Date().toISOString()
      });

      const result = await ProjectMemberService.addMember(
        'project-1',
        'user-1',
        'TASK_ASSIGNEE',
        { addedById: 'admin-1' }
      );

      expect(result).toBeDefined();
      expect(result.projectRole).toBe('TASK_ASSIGNEE');
      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    it('should throw error for invalid role', async () => {
      await expect(
        ProjectMemberService.addMember('project-1', 'user-1', 'INVALID_ROLE')
      ).rejects.toThrow('Invalid project role');
    });

    it('should throw error if user is already a member', async () => {
      mockDb.getAsync.mockResolvedValueOnce({ id: 'existing-member' });

      await expect(
        ProjectMemberService.addMember('project-1', 'user-1', 'TASK_ASSIGNEE')
      ).rejects.toThrow('User is already a member');
    });
  });

  describe('checkPermission', () => {
    it('should return true if member has permission', async () => {
      mockDb.getAsync.mockResolvedValueOnce({
        id: 'member-1',
        project_id: 'project-1',
        user_id: 'user-1',
        project_role: 'PMO_LEAD',
        permissions: JSON.stringify({ canAssignTasks: true })
      });

      const result = await ProjectMemberService.checkPermission(
        'project-1',
        'user-1',
        'canAssignTasks'
      );

      expect(result).toBe(true);
    });

    it('should return false if member lacks permission', async () => {
      mockDb.getAsync.mockResolvedValueOnce({
        id: 'member-1',
        project_id: 'project-1',
        user_id: 'user-1',
        project_role: 'OBSERVER',
        permissions: JSON.stringify({ canAssignTasks: false })
      });

      const result = await ProjectMemberService.checkPermission(
        'project-1',
        'user-1',
        'canAssignTasks'
      );

      expect(result).toBe(false);
    });

    it('should return false if member not found', async () => {
      mockDb.getAsync.mockResolvedValueOnce(null);

      const result = await ProjectMemberService.checkPermission(
        'project-1',
        'user-1',
        'canAssignTasks'
      );

      expect(result).toBe(false);
    });
  });

  describe('getEscalationRecipients', () => {
    it('should return INITIATIVE_OWNER and WORKSTREAM_OWNER for level 1', async () => {
      mockDb.allAsync.mockResolvedValueOnce([
        { user_id: 'user-1', project_role: 'INITIATIVE_OWNER', first_name: 'John', last_name: 'Doe' }
      ]);

      const result = await ProjectMemberService.getEscalationRecipients('project-1', 1);

      expect(result.length).toBeGreaterThan(0);
      expect(mockDb.allAsync).toHaveBeenCalledWith(
        expect.stringContaining('INITIATIVE_OWNER'),
        expect.any(Array)
      );
    });

    it('should return PMO_LEAD for level 2', async () => {
      mockDb.allAsync.mockResolvedValueOnce([
        { user_id: 'user-1', project_role: 'PMO_LEAD', first_name: 'Jane', last_name: 'Doe' }
      ]);

      await ProjectMemberService.getEscalationRecipients('project-1', 2);

      expect(mockDb.allAsync).toHaveBeenCalledWith(
        expect.stringContaining('PMO_LEAD'),
        expect.any(Array)
      );
    });

    it('should return SPONSOR and DECISION_OWNER for level 3', async () => {
      mockDb.allAsync.mockResolvedValueOnce([
        { user_id: 'user-1', project_role: 'SPONSOR', first_name: 'CEO', last_name: 'Boss' }
      ]);

      await ProjectMemberService.getEscalationRecipients('project-1', 3);

      expect(mockDb.allAsync).toHaveBeenCalledWith(
        expect.stringContaining('SPONSOR'),
        expect.any(Array)
      );
    });
  });
});



