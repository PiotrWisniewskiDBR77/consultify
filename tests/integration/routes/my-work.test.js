import app from '../../../server/src/index.js';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabase } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    const workerId = process.env.VITEST_WORKER_ID || '0';
    process.env.SQLITE_PATH = `./test-integration-${workerId}.db`;
});

// My Work Routes Integration Tests
// Tests the My Work API endpoints for task and project management

const express = require('express');
const myWorkRoutes = require('../../../../server/routes/my-work');
const { setupTestDatabase, teardownTestDatabase } = require('../helpers/testDatabase');

describe('My Work Routes', () => {
    const db = getDatabase();
    let app;
    let server;
    let testDb;

    beforeAll(async () => {
        await initializeDatabase();
        testDb = await setupTestDatabase();

        app = express();
        app.use(express.json());
        app.use('/api/my-work', myWorkRoutes);

        server = app.listen(3002);
    });

    afterAll(async () => {
        await teardownTestDatabase(testDb);
        server.close();
    });

    beforeEach(async () => {
        // Reset database state
        await testDb.run('DELETE FROM tasks');
        await testDb.run('DELETE FROM projects');
        await testDb.run('DELETE FROM initiatives');
    });

    describe('GET /api/my-work/dashboard', () => {
    const db = getDatabase();
        beforeEach(async () => {
            // Create test data
            await testDb.run(`
                INSERT INTO tasks (id, title, status, assignee_id, priority, due_date)
                VALUES (?, ?, ?, ?, ?, ?)
            `, ['task-1', 'Test Task 1', 'in_progress', 'user-123', 'high', '2024-12-31']);

            await testDb.run(`
                INSERT INTO tasks (id, title, status, assignee_id, priority, due_date)
                VALUES (?, ?, ?, ?, ?, ?)
            `, ['task-2', 'Test Task 2', 'completed', 'user-123', 'medium', '2024-12-25']);

            await testDb.run(`
                INSERT INTO projects (id, name, status, owner_id)
                VALUES (?, ?, ?, ?)
            `, ['proj-1', 'Test Project', 'active', 'user-123']);
        });

        it('should return dashboard overview for user', async () => {
            const response = await request(app)
                .get('/api/my-work/dashboard?userId=user-123')
                .expect(200);

            expect(response.body).toHaveProperty('tasks');
            expect(response.body).toHaveProperty('projects');
            expect(response.body).toHaveProperty('upcomingDeadlines');
            expect(response.body).toHaveProperty('workload');

            expect(response.body.tasks).toHaveProperty('total', 2);
            expect(response.body.tasks).toHaveProperty('inProgress', 1);
            expect(response.body.tasks).toHaveProperty('completed', 1);
        });

        it('should include workload metrics', async () => {
            const response = await request(app)
                .get('/api/my-work/dashboard?userId=user-123')
                .expect(200);

            expect(response.body.workload).toHaveProperty('utilization');
            expect(response.body.workload).toHaveProperty('capacity');
            expect(response.body.workload).toHaveProperty('overallocated');
        });

        it('should show upcoming deadlines', async () => {
            const response = await request(app)
                .get('/api/my-work/dashboard?userId=user-123')
                .expect(200);

            expect(Array.isArray(response.body.upcomingDeadlines)).toBe(true);
            expect(response.body.upcomingDeadlines.length).toBeGreaterThan(0);

            const deadline = response.body.upcomingDeadlines[0];
            expect(deadline).toHaveProperty('id');
            expect(deadline).toHaveProperty('title');
            expect(deadline).toHaveProperty('dueDate');
            expect(deadline).toHaveProperty('daysRemaining');
        });

        it('should require userId parameter', async () => {
            const response = await request(app)
                .get('/api/my-work/dashboard')
                .expect(400);

            expect(response.body.error).toContain('userId is required');
        });
    });

    describe('GET /api/my-work/tasks', () => {
    const db = getDatabase();
        beforeEach(async () => {
            // Create test tasks
            const tasks = [
                ['task-1', 'High Priority Task', 'in_progress', 'user-123', 'high', '2024-12-31', 'proj-1'],
                ['task-2', 'Medium Priority Task', 'todo', 'user-123', 'medium', '2024-12-25', 'proj-1'],
                ['task-3', 'Low Priority Task', 'completed', 'user-123', 'low', '2024-12-20', 'proj-2'],
                ['task-4', 'Other User Task', 'in_progress', 'user-456', 'high', '2024-12-30', 'proj-1']
            ];

            for (const task of tasks) {
                await testDb.run(`
                    INSERT INTO tasks (id, title, status, assignee_id, priority, due_date, project_id)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, task);
            }
        });

        it('should return user tasks with filtering', async () => {
            const response = await request(app)
                .get('/api/my-work/tasks?userId=user-123')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(3); // Only user-123 tasks

            response.body.forEach(task => {
                expect(task.assigneeId).toBe('user-123');
                expect(task).toHaveProperty('id');
                expect(task).toHaveProperty('title');
                expect(task).toHaveProperty('status');
                expect(task).toHaveProperty('priority');
            });
        });

        it('should filter by status', async () => {
            const response = await request(app)
                .get('/api/my-work/tasks?userId=user-123&status=in_progress')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(1);
            expect(response.body[0].status).toBe('in_progress');
            expect(response.body[0].title).toBe('High Priority Task');
        });

        it('should filter by priority', async () => {
            const response = await request(app)
                .get('/api/my-work/tasks?userId=user-123&priority=high')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(1);
            expect(response.body[0].priority).toBe('high');
        });

        it('should support pagination', async () => {
            const response = await request(app)
                .get('/api/my-work/tasks?userId=user-123&page=1&limit=2')
                .expect(200);

            expect(Array.isArray(response.body.tasks)).toBe(true);
            expect(response.body.tasks.length).toBeLessThanOrEqual(2);
            expect(response.body).toHaveProperty('total');
            expect(response.body).toHaveProperty('page', 1);
            expect(response.body).toHaveProperty('limit', 2);
        });

        it('should sort by due date', async () => {
            const response = await request(app)
                .get('/api/my-work/tasks?userId=user-123&sort=due_date&order=asc')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(3);

            // Check if sorted by due date
            for (let i = 1; i < response.body.length; i++) {
                const prevDate = new Date(response.body[i-1].dueDate);
                const currDate = new Date(response.body[i].dueDate);
                expect(prevDate.getTime()).toBeLessThanOrEqual(currDate.getTime());
            }
        });
    });

    describe('GET /api/my-work/workload', () => {
    const db = getDatabase();
        beforeEach(async () => {
            // Create tasks with different due dates to test workload calculation
            const tasks = [
                ['task-1', 'Task 1', 'in_progress', 'user-123', 'high', '2024-12-20'],
                ['task-2', 'Task 2', 'in_progress', 'user-123', 'medium', '2024-12-21'],
                ['task-3', 'Task 3', 'in_progress', 'user-123', 'low', '2024-12-22'],
                ['task-4', 'Task 4', 'completed', 'user-123', 'high', '2024-12-19']
            ];

            for (const task of tasks) {
                await testDb.run(`
                    INSERT INTO tasks (id, title, status, assignee_id, priority, due_date)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, task);
            }
        });

        it('should calculate workload metrics', async () => {
            const response = await request(app)
                .get('/api/my-work/workload?userId=user-123')
                .expect(200);

            expect(response.body).toHaveProperty('utilization');
            expect(response.body).toHaveProperty('capacity');
            expect(response.body).toHaveProperty('overallocation');
            expect(response.body).toHaveProperty('workloadDistribution');

            expect(typeof response.body.utilization).toBe('number');
            expect(response.body.utilization).toBeGreaterThan(0);
            expect(response.body.utilization).toBeLessThanOrEqual(1);
        });

        it('should provide workload heatmap data', async () => {
            const response = await request(app)
                .get('/api/my-work/workload?userId=user-123&includeHeatmap=true')
                .expect(200);

            expect(response.body).toHaveProperty('heatmap');
            expect(Array.isArray(response.body.heatmap)).toBe(true);

            response.body.heatmap.forEach(day => {
                expect(day).toHaveProperty('date');
                expect(day).toHaveProperty('workload');
                expect(day).toHaveProperty('tasks');
            });
        });

        it('should identify bottleneck periods', async () => {
            const response = await request(app)
                .get('/api/my-work/workload?userId=user-123&includeBottlenecks=true')
                .expect(200);

            expect(response.body).toHaveProperty('bottlenecks');
            expect(Array.isArray(response.body.bottlenecks)).toBe(true);
        });
    });

    describe('GET /api/my-work/calendar', () => {
    const db = getDatabase();
        beforeEach(async () => {
            // Create tasks with different due dates
            const tasks = [
                ['task-1', 'Meeting', 'scheduled', 'user-123', 'high', '2024-12-20'],
                ['task-2', 'Review', 'scheduled', 'user-123', 'medium', '2024-12-20'],
                ['task-3', 'Delivery', 'scheduled', 'user-123', 'high', '2024-12-25']
            ];

            for (const task of tasks) {
                await testDb.run(`
                    INSERT INTO tasks (id, title, status, assignee_id, priority, due_date)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, task);
            }
        });

        it('should return calendar events', async () => {
            const response = await request(app)
                .get('/api/my-work/calendar?userId=user-123&start=2024-12-01&end=2024-12-31')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);

            response.body.forEach(event => {
                expect(event).toHaveProperty('id');
                expect(event).toHaveProperty('title');
                expect(event).toHaveProperty('start');
                expect(event).toHaveProperty('end');
                expect(event).toHaveProperty('type', 'task');
            });
        });

        it('should filter events by date range', async () => {
            const response = await request(app)
                .get('/api/my-work/calendar?userId=user-123&start=2024-12-19&end=2024-12-21')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(2); // Tasks on Dec 20

            response.body.forEach(event => {
                const eventDate = new Date(event.start);
                expect(eventDate.getDate()).toBe(20);
                expect(eventDate.getMonth()).toBe(11); // December is 11
            });
        });

        it('should include different event types', async () => {
            // Add a project milestone
            await testDb.run(`
                INSERT INTO project_milestones (id, project_id, title, due_date, status)
                VALUES (?, ?, ?, ?, ?)
            `, ['milestone-1', 'proj-1', 'Phase 1 Complete', '2024-12-22', 'pending']);

            const response = await request(app)
                .get('/api/my-work/calendar?userId=user-123&start=2024-12-01&end=2024-12-31')
                .expect(200);

            const milestoneEvents = response.body.filter(event => event.type === 'milestone');
            expect(milestoneEvents.length).toBeGreaterThan(0);
        });
    });

    describe('POST /api/my-work/tasks/:id/status', () => {
    const db = getDatabase();
        let taskId;

        beforeEach(async () => {
            // Create test task
            await testDb.run(`
                INSERT INTO tasks (id, title, status, assignee_id, priority, due_date)
                VALUES (?, ?, ?, ?, ?, ?)
            `, ['task-1', 'Test Task', 'todo', 'user-123', 'medium', '2024-12-31']);

            taskId = 'task-1';
        });

        it('should update task status', async () => {
            const response = await request(app)
                .post(`/api/my-work/tasks/${taskId}/status`)
                .send({ status: 'in_progress', userId: 'user-123' })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);

            // Verify status change
            const taskResponse = await request(app)
                .get('/api/my-work/tasks?userId=user-123')
                .expect(200);

            const task = taskResponse.body.find(t => t.id === taskId);
            expect(task.status).toBe('in_progress');
        });

        it('should validate status transitions', async () => {
            // Try invalid transition
            const response = await request(app)
                .post(`/api/my-work/tasks/${taskId}/status`)
                .send({ status: 'invalid_status', userId: 'user-123' })
                .expect(400);

            expect(response.body.error).toContain('Invalid status');
        });

        it('should prevent unauthorized status changes', async () => {
            const response = await request(app)
                .post(`/api/my-work/tasks/${taskId}/status`)
                .send({ status: 'completed', userId: 'user-456' }) // Wrong user
                .expect(403);

            expect(response.body.error).toContain('Unauthorized');
        });
    });

    describe('GET /api/my-work/notifications', () => {
    const db = getDatabase();
        beforeEach(async () => {
            // Create notifications
            await testDb.run(`
                INSERT INTO notifications (id, user_id, type, message, read_status, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `, ['notif-1', 'user-123', 'task_due', 'Task due tomorrow', 'unread', '2024-12-20']);

            await testDb.run(`
                INSERT INTO notifications (id, user_id, type, message, read_status, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `, ['notif-2', 'user-123', 'project_update', 'Project status changed', 'read', '2024-12-19']);
        });

        it('should return user notifications', async () => {
            const response = await request(app)
                .get('/api/my-work/notifications?userId=user-123')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(2);

            response.body.forEach(notification => {
                expect(notification).toHaveProperty('id');
                expect(notification).toHaveProperty('type');
                expect(notification).toHaveProperty('message');
                expect(notification).toHaveProperty('readStatus');
            });
        });

        it('should filter by read status', async () => {
            const response = await request(app)
                .get('/api/my-work/notifications?userId=user-123&readStatus=unread')
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBe(1);
            expect(response.body[0].readStatus).toBe('unread');
        });

        it('should mark notifications as read', async () => {
            const response = await request(app)
                .post('/api/my-work/notifications/notif-1/read')
                .send({ userId: 'user-123' })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);

            // Verify notification is marked as read
            const notificationsResponse = await request(app)
                .get('/api/my-work/notifications?userId=user-123&readStatus=read')
                .expect(200);

            expect(notificationsResponse.body.some(n => n.id === 'notif-1')).toBe(true);
        });
    });

    describe('GET /api/my-work/progress', () => {
    const db = getDatabase();
        beforeEach(async () => {
            // Create tasks with progress tracking
            await testDb.run(`
                INSERT INTO tasks (id, title, status, assignee_id, progress, estimated_hours, actual_hours)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, ['task-1', 'Task 1', 'in_progress', 'user-123', 0.6, 40, 24]);

            await testDb.run(`
                INSERT INTO tasks (id, title, status, assignee_id, progress, estimated_hours, actual_hours)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, ['task-2', 'Task 2', 'completed', 'user-123', 1.0, 20, 18]);
        });

        it('should return progress metrics', async () => {
            const response = await request(app)
                .get('/api/my-work/progress?userId=user-123')
                .expect(200);

            expect(response.body).toHaveProperty('overallProgress');
            expect(response.body).toHaveProperty('timeTracking');
            expect(response.body).toHaveProperty('efficiency');

            expect(response.body.overallProgress).toBeGreaterThan(0);
            expect(response.body.overallProgress).toBeLessThanOrEqual(1);
        });

        it('should calculate efficiency metrics', async () => {
            const response = await request(app)
                .get('/api/my-work/progress?userId=user-123')
                .expect(200);

            expect(response.body.efficiency).toHaveProperty('onTimeDelivery');
            expect(response.body.efficiency).toHaveProperty('effortVariance');
            expect(response.body.efficiency).toHaveProperty('productivityIndex');
        });

        it('should provide burndown chart data', async () => {
            const response = await request(app)
                .get('/api/my-work/progress?userId=user-123&includeBurndown=true')
                .expect(200);

            expect(response.body).toHaveProperty('burndownData');
            expect(Array.isArray(response.body.burndownData)).toBe(true);

            response.body.burndownData.forEach(point => {
                expect(point).toHaveProperty('date');
                expect(point).toHaveProperty('planned');
                expect(point).toHaveProperty('actual');
            });
        });
    });

    describe('Error Handling', () => {
    const db = getDatabase();
        it('should handle database errors gracefully', async () => {
            // Mock database error
            const originalRun = testDb.run;
            testDb.run = jest.fn((query, params, callback) => {
                callback(new Error('Database connection failed'));
            });

            const response = await request(app)
                .get('/api/my-work/dashboard?userId=user-123')
                .expect(500);

            expect(response.body.error).toContain('Database error');

            testDb.run = originalRun;
        });

        it('should validate user permissions', async () => {
            const response = await request(app)
                .get('/api/my-work/dashboard?userId=invalid-user')
                .expect(403);

            expect(response.body.error).toContain('Unauthorized');
        });

        it('should handle invalid parameters', async () => {
            const response = await request(app)
                .get('/api/my-work/tasks?userId=user-123&page=invalid')
                .expect(400);

            expect(response.body.error).toContain('Invalid page parameter');
        });
    });

    describe('Performance', () => {
    const db = getDatabase();
        it('should handle high load efficiently', async () => {
            // Create many tasks
            const tasks = Array(100).fill().map((_, i) => [
                `task-${i}`,
                `Task ${i}`,
                'in_progress',
                'user-123',
                'medium',
                '2024-12-31'
            ]);

            for (const task of tasks) {
                await testDb.run(`
                    INSERT INTO tasks (id, title, status, assignee_id, priority, due_date)
                    VALUES (?, ?, ?, ?, ?, ?)
                `, task);
            }

            const startTime = Date.now();

            const response = await request(app)
                .get('/api/my-work/tasks?userId=user-123&page=1&limit=50')
                .expect(200);

            const duration = Date.now() - startTime;
            expect(duration).toBeLessThan(1000); // Less than 1 second
            expect(response.body.tasks.length).toBe(50);
        });

        it('should support caching for frequent queries', async () => {
            const response1 = await request(app)
                .get('/api/my-work/dashboard?userId=user-123')
                .expect(200);

            const response2 = await request(app)
                .get('/api/my-work/dashboard?userId=user-123')
                .expect(200);

            // Responses should be consistent
            expect(response1.body.tasks.total).toBe(response2.body.tasks.total);
        });
    });
});