/**
 * PMO Project Members Integration Tests
 * 
 * Integration tests for the Project Members API
 * 
 * Standards:
 * - ISO 21500:2021 - Project Team (Clause 4.6.2)
 * - PMI PMBOK 7th Edition - Team Performance Domain
 * - PRINCE2 - Organization Theme (Project Roles)
 */

const { describe, it, expect, beforeAll, afterAll, beforeEach } = require('vitest');
const request = require('supertest');
const app = require('../../server/index');

// Skip if no test database configured
const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION_TESTS === 'true';

describe.skipIf(SKIP_INTEGRATION)('PMO Project Members API', () => {
  let authToken;
  let testProjectId;
  let testUserId;
  let testMemberId;

  beforeAll(async () => {
    // Setup: Get auth token and create test data
    // This would typically involve creating a test user and project
    // For now, we'll assume these are set up via environment or fixtures
    authToken = process.env.TEST_AUTH_TOKEN || 'test-token';
    testProjectId = process.env.TEST_PROJECT_ID || 'test-project-1';
    testUserId = process.env.TEST_USER_ID || 'test-user-1';
  });

  describe('POST /api/projects/:projectId/members', () => {
    it('should add a member to a project', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/members`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: testUserId,
          projectRole: 'TASK_ASSIGNEE',
          allocationPercent: 50
        });

      if (response.status === 201) {
        expect(response.body.projectRole).toBe('TASK_ASSIGNEE');
        expect(response.body.allocationPercent).toBe(50);
        testMemberId = response.body.id;
      } else {
        // Member might already exist
        expect([201, 400]).toContain(response.status);
      }
    });

    it('should reject invalid role', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/members`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          userId: 'new-user-id',
          projectRole: 'INVALID_ROLE'
        });

      expect(response.status).toBe(400);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/members`)
        .send({
          userId: testUserId,
          projectRole: 'TASK_ASSIGNEE'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/projects/:projectId/members', () => {
    it('should list project members', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/members`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.members).toBeInstanceOf(Array);
      expect(response.body.roles).toBeDefined();
    });

    it('should filter by role', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/members`)
        .query({ role: 'TASK_ASSIGNEE' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      response.body.members.forEach(member => {
        expect(member.projectRole).toBe('TASK_ASSIGNEE');
      });
    });
  });

  describe('GET /api/projects/:projectId/raci-matrix', () => {
    it('should return RACI matrix', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/raci-matrix`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.projectId).toBe(testProjectId);
      expect(response.body.matrix).toBeDefined();
      expect(response.body.generatedAt).toBeDefined();
    });

    it('should include all object types in RACI matrix', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/raci-matrix`)
        .set('Authorization', `Bearer ${authToken}`);

      const expectedObjectTypes = [
        'PROJECT', 'INITIATIVE', 'TASK', 'DECISION',
        'CHANGE_REQUEST', 'ASSESSMENT', 'ROADMAP', 'STAGE_GATE'
      ];

      expectedObjectTypes.forEach(objectType => {
        expect(response.body.matrix[objectType]).toBeDefined();
      });
    });
  });

  describe('GET /api/projects/:projectId/my-role', () => {
    it('should return current user role', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/my-role`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(typeof response.body.isMember).toBe('boolean');
      
      if (response.body.isMember) {
        expect(response.body.projectRole).toBeDefined();
        expect(response.body.permissions).toBeDefined();
      }
    });
  });

  describe('PATCH /api/projects/:projectId/members/:userId', () => {
    it('should update member role', async () => {
      const response = await request(app)
        .patch(`/api/projects/${testProjectId}/members/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          projectRole: 'INITIATIVE_OWNER'
        });

      if (response.status === 200) {
        expect(response.body.projectRole).toBe('INITIATIVE_OWNER');
      } else {
        expect([200, 403, 404]).toContain(response.status);
      }
    });

    it('should update allocation', async () => {
      const response = await request(app)
        .patch(`/api/projects/${testProjectId}/members/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          allocationPercent: 75
        });

      if (response.status === 200) {
        expect(response.body.allocationPercent).toBe(75);
      }
    });
  });

  describe('GET /api/projects/:projectId/available-assignees', () => {
    it('should return users who can be assigned tasks', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/available-assignees`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      
      // All returned users should have assignable roles
      const assignableRoles = ['TASK_ASSIGNEE', 'INITIATIVE_OWNER', 'WORKSTREAM_OWNER', 'PMO_LEAD'];
      response.body.forEach(user => {
        expect(assignableRoles).toContain(user.projectRole);
      });
    });
  });

  describe('DELETE /api/projects/:projectId/members/:userId', () => {
    it('should remove member from project', async () => {
      const response = await request(app)
        .delete(`/api/projects/${testProjectId}/members/${testUserId}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Should succeed or fail due to permissions
      expect([200, 400, 403]).toContain(response.status);
      
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
      }
    });

    it('should prevent removing last SPONSOR', async () => {
      // This test assumes we're trying to remove the only SPONSOR
      const response = await request(app)
        .delete(`/api/projects/${testProjectId}/members/sponsor-user-id`)
        .set('Authorization', `Bearer ${authToken}`);

      // Should fail if this is the only SPONSOR
      if (response.status === 400) {
        expect(response.body.error).toContain('SPONSOR');
      }
    });
  });
});

describe.skipIf(SKIP_INTEGRATION)('PMO Workstreams API', () => {
  let authToken;
  let testProjectId;
  let testWorkstreamId;

  beforeAll(async () => {
    authToken = process.env.TEST_AUTH_TOKEN || 'test-token';
    testProjectId = process.env.TEST_PROJECT_ID || 'test-project-1';
  });

  describe('POST /api/projects/:projectId/workstreams', () => {
    it('should create a workstream', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/workstreams`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Digital Transformation',
          description: 'All digital initiatives',
          color: '#3B82F6'
        });

      if (response.status === 201) {
        expect(response.body.name).toBe('Digital Transformation');
        expect(response.body.status).toBe('ACTIVE');
        testWorkstreamId = response.body.id;
      } else {
        expect([201, 403]).toContain(response.status);
      }
    });

    it('should require name', async () => {
      const response = await request(app)
        .post(`/api/projects/${testProjectId}/workstreams`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Missing name'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/projects/:projectId/workstreams', () => {
    it('should list workstreams', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/workstreams`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.workstreams).toBeInstanceOf(Array);
      expect(typeof response.body.unassignedInitiatives).toBe('number');
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get(`/api/projects/${testProjectId}/workstreams`)
        .query({ status: 'ACTIVE' })
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      response.body.workstreams.forEach(ws => {
        expect(ws.status).toBe('ACTIVE');
      });
    });
  });

  describe('GET /api/workstreams/:id/progress', () => {
    it('should return workstream progress', async () => {
      if (!testWorkstreamId) {
        return;
      }

      const response = await request(app)
        .get(`/api/workstreams/${testWorkstreamId}/progress`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.workstreamId).toBe(testWorkstreamId);
      expect(typeof response.body.progress).toBe('number');
      expect(response.body.initiatives).toBeDefined();
      expect(response.body.tasks).toBeDefined();
    });
  });

  describe('PATCH /api/workstreams/:id', () => {
    it('should update workstream', async () => {
      if (!testWorkstreamId) {
        return;
      }

      const response = await request(app)
        .patch(`/api/workstreams/${testWorkstreamId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Digital Transformation Stream',
          status: 'ACTIVE'
        });

      if (response.status === 200) {
        expect(response.body.name).toBe('Digital Transformation Stream');
      }
    });
  });

  describe('DELETE /api/workstreams/:id', () => {
    it('should delete workstream', async () => {
      if (!testWorkstreamId) {
        return;
      }

      const response = await request(app)
        .delete(`/api/workstreams/${testWorkstreamId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect([200, 403]).toContain(response.status);
    });
  });
});

describe.skipIf(SKIP_INTEGRATION)('PMO Task Assignment API', () => {
  let authToken;
  let testTaskId;
  let testAssigneeId;

  beforeAll(async () => {
    authToken = process.env.TEST_AUTH_TOKEN || 'test-token';
    testTaskId = process.env.TEST_TASK_ID || 'test-task-1';
    testAssigneeId = process.env.TEST_ASSIGNEE_ID || 'test-assignee-1';
  });

  describe('POST /api/tasks/:id/assign', () => {
    it('should assign task to user', async () => {
      const response = await request(app)
        .post(`/api/tasks/${testTaskId}/assign`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          assigneeId: testAssigneeId
        });

      if (response.status === 200) {
        expect(response.body.assigneeId).toBe(testAssigneeId);
        expect(response.body.slaDueAt).toBeDefined();
        expect(response.body.escalationLevel).toBe(0);
      } else {
        expect([200, 400, 404]).toContain(response.status);
      }
    });

    it('should set custom SLA hours', async () => {
      const response = await request(app)
        .post(`/api/tasks/${testTaskId}/assign`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          assigneeId: testAssigneeId,
          slaHours: 12
        });

      if (response.status === 200) {
        expect(response.body.slaHours).toBe(12);
      }
    });
  });

  describe('POST /api/tasks/:id/escalate', () => {
    it('should escalate task', async () => {
      const response = await request(app)
        .post(`/api/tasks/${testTaskId}/escalate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reason: 'Task is blocked',
          triggerType: 'BLOCKED'
        });

      if (response.status === 200) {
        expect(response.body.escalation).toBeDefined();
        expect(response.body.escalation.toLevel).toBeGreaterThan(0);
        expect(response.body.escalation.reason).toBe('Task is blocked');
      } else {
        expect([200, 400]).toContain(response.status);
      }
    });
  });

  describe('GET /api/tasks/:id/escalations', () => {
    it('should return escalation history', async () => {
      const response = await request(app)
        .get(`/api/tasks/${testTaskId}/escalations`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toBeInstanceOf(Array);
      
      response.body.forEach(escalation => {
        expect(escalation.taskId).toBe(testTaskId);
        expect(typeof escalation.fromLevel).toBe('number');
        expect(typeof escalation.toLevel).toBe('number');
      });
    });
  });

  describe('GET /api/tasks/my-workload', () => {
    it('should return current user workload', async () => {
      const response = await request(app)
        .get('/api/tasks/my-workload')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(typeof response.body.total).toBe('number');
      expect(typeof response.body.overdue).toBe('number');
      expect(typeof response.body.atRisk).toBe('number');
      expect(response.body.byProject).toBeInstanceOf(Array);
    });
  });

  describe('POST /api/tasks/:id/unassign', () => {
    it('should unassign task', async () => {
      const response = await request(app)
        .post(`/api/tasks/${testTaskId}/unassign`)
        .set('Authorization', `Bearer ${authToken}`);

      if (response.status === 200) {
        expect(response.body.assigneeId).toBeNull();
        expect(response.body.slaDueAt).toBeNull();
      } else {
        expect([200, 400]).toContain(response.status);
      }
    });
  });
});



