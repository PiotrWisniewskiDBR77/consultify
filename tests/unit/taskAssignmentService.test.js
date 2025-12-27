/**
 * Task Assignment Service Tests
 * 
 * PMO Standards Compliant Task Assignment with SLA and Escalation
 * 
 * Standards:
 * - ISO 21500:2021 - Activity (Clause 4.4.5), Escalation (Clause 4.3.4)
 * - PMI PMBOK 7th Edition - Project Work Performance Domain
 * - PRINCE2 - Progress Theme, Exception Handling
 */

const { describe, it, expect, beforeEach, vi } = require('vitest');

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
    getMapping: vi.fn((concept) => ({
      iso21500: { term: concept === 'Escalation' ? 'Escalation (4.3.4)' : 'Activity (4.4.5)' },
      pmbok7: { term: concept === 'Escalation' ? 'Escalation Path' : 'Activity' },
      prince2: { term: concept === 'Escalation' ? 'Exception Report' : 'Activity' }
    }))
  }
}));

vi.mock('../../server/services/projectMemberService', () => ({
  default: {
    getMember: vi.fn(),
    getEscalationRecipients: vi.fn(),
    PROJECT_ROLES: {
      TASK_ASSIGNEE: 'TASK_ASSIGNEE',
      INITIATIVE_OWNER: 'INITIATIVE_OWNER',
      WORKSTREAM_OWNER: 'WORKSTREAM_OWNER',
      PMO_LEAD: 'PMO_LEAD',
      SPONSOR: 'SPONSOR'
    }
  }
}));

const TaskAssignmentService = require('../../server/services/taskAssignmentService');
const ProjectMemberService = require('../../server/services/projectMemberService');

describe('TaskAssignmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SLA_HOURS_BY_PRIORITY', () => {
    it('should define SLA hours for all priorities', () => {
      const sla = TaskAssignmentService.SLA_HOURS_BY_PRIORITY;
      
      expect(sla.urgent).toBe(8);
      expect(sla.high).toBe(24);
      expect(sla.medium).toBe(48);
      expect(sla.low).toBe(72);
    });
  });

  describe('ESCALATION_LEVELS', () => {
    it('should define 4 escalation levels', () => {
      const levels = TaskAssignmentService.ESCALATION_LEVELS;
      
      expect(levels.NONE).toBe(0);
      expect(levels.INITIATIVE_OWNER).toBe(1);
      expect(levels.PMO_LEAD).toBe(2);
      expect(levels.SPONSOR).toBe(3);
    });
  });

  describe('ESCALATION_TRIGGERS', () => {
    it('should define all escalation triggers', () => {
      const triggers = TaskAssignmentService.ESCALATION_TRIGGERS;
      
      expect(triggers.SLA_BREACH).toBe('SLA_BREACH');
      expect(triggers.BLOCKED).toBe('BLOCKED');
      expect(triggers.MANUAL).toBe('MANUAL');
      expect(triggers.PRIORITY_CHANGE).toBe('PRIORITY_CHANGE');
    });
  });

  describe('assignTask', () => {
    it('should assign task to a valid project member', async () => {
      // Mock task exists
      mockDb.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        priority: 'medium'
      });

      // Mock member exists with valid role
      ProjectMemberService.default.getMember.mockResolvedValueOnce({
        userId: 'user-1',
        projectRole: 'TASK_ASSIGNEE',
        permissions: { canUpdateTasks: true }
      });

      // Mock update
      mockDb.runAsync.mockResolvedValue({});
      
      // Mock get updated task
      mockDb.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        assignee_id: 'user-1',
        sla_hours: 48,
        sla_due_at: new Date().toISOString(),
        escalation_level: 0
      });

      const result = await TaskAssignmentService.assignTask('task-1', 'user-1', {
        assignedById: 'admin-1'
      });

      expect(result).toBeDefined();
      expect(result.assigneeId).toBe('user-1');
      expect(mockDb.runAsync).toHaveBeenCalled();
    });

    it('should throw error for non-existent task', async () => {
      mockDb.getAsync.mockResolvedValueOnce(null);

      await expect(
        TaskAssignmentService.assignTask('invalid-task', 'user-1')
      ).rejects.toThrow('Task not found');
    });

    it('should throw error if user is not a project member', async () => {
      mockDb.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        priority: 'medium'
      });

      ProjectMemberService.default.getMember.mockResolvedValueOnce(null);

      await expect(
        TaskAssignmentService.assignTask('task-1', 'user-1')
      ).rejects.toThrow('User is not a member of this project');
    });

    it('should throw error if user role cannot receive task assignments', async () => {
      mockDb.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        priority: 'medium'
      });

      ProjectMemberService.default.getMember.mockResolvedValueOnce({
        userId: 'user-1',
        projectRole: 'OBSERVER', // Observers can't be assigned tasks
        permissions: {}
      });

      await expect(
        TaskAssignmentService.assignTask('task-1', 'user-1')
      ).rejects.toThrow('cannot be assigned tasks');
    });

    it('should calculate SLA based on priority', async () => {
      mockDb.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        priority: 'urgent' // 8 hours SLA
      });

      ProjectMemberService.default.getMember.mockResolvedValueOnce({
        userId: 'user-1',
        projectRole: 'TASK_ASSIGNEE'
      });

      mockDb.runAsync.mockResolvedValue({});
      mockDb.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        assignee_id: 'user-1',
        sla_hours: 8
      });

      await TaskAssignmentService.assignTask('task-1', 'user-1');

      expect(mockDb.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([8]) // SLA hours for urgent
      );
    });
  });

  describe('escalateTask', () => {
    it('should escalate task to next level', async () => {
      mockDb.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        escalation_level: 0
      });

      ProjectMemberService.default.getEscalationRecipients.mockResolvedValueOnce([
        { userId: 'owner-1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' }
      ]);

      mockDb.runAsync.mockResolvedValue({});
      mockDb.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        escalation_level: 1,
        escalated_to_id: 'owner-1'
      });

      const result = await TaskAssignmentService.escalateTask('task-1', {
        reason: 'SLA breach',
        triggerType: 'SLA_BREACH'
      });

      expect(result.escalation.toLevel).toBe(1);
      expect(result.escalation.escalatedTo.userId).toBe('owner-1');
    });

    it('should throw error if task is at max escalation level', async () => {
      mockDb.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        escalation_level: 3 // Max level
      });

      await expect(
        TaskAssignmentService.escalateTask('task-1', { reason: 'Test' })
      ).rejects.toThrow('maximum escalation level');
    });

    it('should throw error if no escalation recipients found', async () => {
      mockDb.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        escalation_level: 0
      });

      ProjectMemberService.default.getEscalationRecipients.mockResolvedValueOnce([]);

      await expect(
        TaskAssignmentService.escalateTask('task-1', { reason: 'Test' })
      ).rejects.toThrow('No recipients found');
    });
  });

  describe('checkAndEscalateOverdue', () => {
    it('should find and escalate overdue tasks', async () => {
      // Mock overdue tasks
      mockDb.allAsync.mockResolvedValueOnce([
        {
          id: 'task-1',
          project_id: 'project-1',
          title: 'Overdue Task',
          sla_due_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
          escalation_level: 0
        }
      ]);

      // Mock escalation process
      mockDb.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        escalation_level: 0
      });

      ProjectMemberService.default.getEscalationRecipients.mockResolvedValueOnce([
        { userId: 'owner-1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' }
      ]);

      mockDb.runAsync.mockResolvedValue({});
      mockDb.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        escalation_level: 1
      });

      const result = await TaskAssignmentService.checkAndEscalateOverdue();

      expect(result.processed).toBe(1);
      expect(result.escalated).toBe(1);
    });

    it('should handle escalation failures gracefully', async () => {
      mockDb.allAsync.mockResolvedValueOnce([
        {
          id: 'task-1',
          project_id: 'project-1',
          title: 'Overdue Task',
          escalation_level: 3 // Already at max
        }
      ]);

      mockDb.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        escalation_level: 3
      });

      const result = await TaskAssignmentService.checkAndEscalateOverdue();

      expect(result.processed).toBe(1);
      expect(result.failed).toBe(1);
    });
  });

  describe('getOverdueTasks', () => {
    it('should return overdue tasks for a project', async () => {
      mockDb.allAsync.mockResolvedValueOnce([
        {
          id: 'task-1',
          project_id: 'project-1',
          title: 'Overdue Task',
          sla_due_at: new Date(Date.now() - 1000).toISOString(),
          status: 'IN_PROGRESS',
          escalation_level: 1
        }
      ]);

      const result = await TaskAssignmentService.getOverdueTasks('project-1');

      expect(result.length).toBe(1);
      expect(result[0].slaStatus).toBe('BREACHED');
    });
  });

  describe('getUserWorkload', () => {
    it('should return workload summary for a user', async () => {
      mockDb.allAsync.mockResolvedValueOnce([
        {
          project_id: 'project-1',
          project_name: 'Project 1',
          status: 'IN_PROGRESS',
          priority: 'high',
          sla_due_at: new Date(Date.now() - 1000).toISOString() // Overdue
        },
        {
          project_id: 'project-1',
          project_name: 'Project 1',
          status: 'TODO',
          priority: 'medium',
          sla_due_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // At risk (within 4 hours)
        }
      ]);

      const result = await TaskAssignmentService.getUserWorkload('user-1');

      expect(result.total).toBe(2);
      expect(result.overdue).toBe(1);
      expect(result.atRisk).toBe(1);
      expect(result.byProject.length).toBe(1);
    });
  });
});



