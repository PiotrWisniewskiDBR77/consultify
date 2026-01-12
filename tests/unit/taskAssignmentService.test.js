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

const TaskAssignmentService = require('../../server/services/taskAssignmentService');
const ProjectMemberService = require('../../server/services/projectMemberService');
const db = require('../../server/database');
const NotificationService = require('../../server/services/notificationService');
const ActivityService = require('../../server/services/activityService');

describe('TaskAssignmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup spies and provide default mock implementations
    vi.spyOn(db, 'getAsync').mockImplementation(() => Promise.resolve(null));
    vi.spyOn(db, 'runAsync').mockImplementation(() => Promise.resolve({}));
    vi.spyOn(db, 'allAsync').mockImplementation(() => Promise.resolve([]));

    vi.spyOn(ProjectMemberService, 'getMember').mockImplementation(() => Promise.resolve(null));
    vi.spyOn(ProjectMemberService, 'getEscalationRecipients').mockImplementation(() => Promise.resolve([]));

    vi.spyOn(NotificationService, 'create').mockImplementation(() => Promise.resolve({}));
    vi.spyOn(ActivityService, 'log').mockImplementation(() => Promise.resolve({}));
  });

  describe('Service Constants', () => {
    it('should define SLA hours for all priorities', () => {
      const sla = TaskAssignmentService.SLA_HOURS_BY_PRIORITY;
      expect(sla.urgent).toBe(8);
      expect(sla.high).toBe(24);
      expect(sla.medium).toBe(48);
      expect(sla.low).toBe(72);
    });

    it('should define escalation levels', () => {
      const levels = TaskAssignmentService.ESCALATION_LEVELS;
      expect(levels.NONE).toBe(0);
      expect(levels.INITIATIVE_OWNER).toBe(1);
      expect(levels.PMO_LEAD).toBe(2);
      expect(levels.SPONSOR).toBe(3);
    });

    it('should define escalation triggers', () => {
      const triggers = TaskAssignmentService.ESCALATION_TRIGGERS;
      expect(triggers.SLA_BREACH).toBe('SLA_BREACH');
      expect(triggers.BLOCKED).toBe('BLOCKED');
      expect(triggers.MANUAL).toBe('MANUAL');
      expect(triggers.PRIORITY_CHANGE).toBe('PRIORITY_CHANGE');
    });
  });

  describe('assignTask', () => {
    it('should assign task to a valid project member', async () => {
      db.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        priority: 'medium'
      });

      ProjectMemberService.getMember.mockResolvedValueOnce({
        userId: 'user-1',
        projectRole: 'TASK_ASSIGNEE',
        permissions: { canUpdateTasks: true }
      });

      // Mock project lookup for _createActivity
      db.getAsync.mockResolvedValueOnce({
        organization_id: 'org-1'
      });

      // Mock get updated task for getTask()
      db.getAsync.mockResolvedValueOnce({
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
      expect(db.runAsync).toHaveBeenCalled();
    });

    it('should throw error for non-existent task', async () => {
      db.getAsync.mockResolvedValueOnce(null);

      await expect(
        TaskAssignmentService.assignTask('invalid-task', 'user-1')
      ).rejects.toThrow('Task not found');
    });

    it('should throw error if user is not a project member', async () => {
      db.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        priority: 'medium'
      });

      ProjectMemberService.getMember.mockResolvedValueOnce(null);

      await expect(
        TaskAssignmentService.assignTask('task-1', 'user-1')
      ).rejects.toThrow('User is not a member of this project');
    });

    it('should throw error if user role cannot receive task assignments', async () => {
      db.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        priority: 'medium'
      });

      ProjectMemberService.getMember.mockResolvedValueOnce({
        userId: 'user-1',
        projectRole: 'OBSERVER',
        permissions: {}
      });

      await expect(
        TaskAssignmentService.assignTask('task-1', 'user-1')
      ).rejects.toThrow('cannot be assigned tasks');
    });

    it('should calculate SLA based on priority', async () => {
      db.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        priority: 'urgent'
      });

      ProjectMemberService.getMember.mockResolvedValueOnce({
        userId: 'user-1',
        projectRole: 'TASK_ASSIGNEE'
      });

      db.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        assignee_id: 'user-1',
        sla_hours: 8
      });

      await TaskAssignmentService.assignTask('task-1', 'user-1');

      expect(db.runAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([8])
      );
    });
  });

  describe('escalateTask', () => {
    it('should escalate task to next level', async () => {
      db.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        escalation_level: 0
      });

      ProjectMemberService.getEscalationRecipients.mockResolvedValueOnce([
        { userId: 'owner-1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' }
      ]);

      db.getAsync.mockResolvedValueOnce({
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
      db.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        escalation_level: 3
      });

      await expect(
        TaskAssignmentService.escalateTask('task-1', { reason: 'Test' })
      ).rejects.toThrow('maximum escalation level');
    });

    it('should throw error if no escalation recipients found', async () => {
      db.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        escalation_level: 0
      });

      ProjectMemberService.getEscalationRecipients.mockResolvedValueOnce([]);

      await expect(
        TaskAssignmentService.escalateTask('task-1', { reason: 'Test' })
      ).rejects.toThrow('No recipients found');
    });
  });

  describe('checkAndEscalateOverdue', () => {
    it('should find and escalate overdue tasks', async () => {
      db.allAsync.mockResolvedValueOnce([
        {
          id: 'task-1',
          project_id: 'project-1',
          title: 'Overdue Task',
          sla_due_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          escalation_level: 0
        }
      ]);

      db.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        project_id: 'project-1',
        escalation_level: 0
      });

      ProjectMemberService.getEscalationRecipients.mockResolvedValueOnce([
        { userId: 'owner-1', firstName: 'John', lastName: 'Doe', email: 'john@test.com' }
      ]);

      db.getAsync.mockResolvedValueOnce({
        id: 'task-1',
        escalation_level: 1
      });

      const result = await TaskAssignmentService.checkAndEscalateOverdue();

      expect(result.processed).toBe(1);
      expect(result.escalated).toBe(1);
    });

    it('should handle escalation failures gracefully', async () => {
      db.allAsync.mockResolvedValueOnce([
        {
          id: 'task-1',
          project_id: 'project-1',
          title: 'Overdue Task',
          escalation_level: 3
        }
      ]);

      db.getAsync.mockResolvedValueOnce({
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
      db.allAsync.mockResolvedValueOnce([
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
      db.allAsync.mockResolvedValueOnce([
        {
          project_id: 'project-1',
          project_name: 'Project 1',
          status: 'IN_PROGRESS',
          priority: 'high',
          sla_due_at: new Date(Date.now() - 1000).toISOString()
        },
        {
          project_id: 'project-1',
          project_name: 'Project 1',
          status: 'TODO',
          priority: 'medium',
          sla_due_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
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
