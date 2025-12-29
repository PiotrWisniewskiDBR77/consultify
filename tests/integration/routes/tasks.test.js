/**
 * Tasks Routes Integration Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock database
const mockDb = {
    all: vi.fn((sql, params, callback) => callback(null, [])),
    get: vi.fn((sql, params, callback) => callback(null, null)),
    run: vi.fn((sql, params, callback) => callback.call({ changes: 1, lastID: 1 }, null))
};

vi.mock('../../../server/database', () => ({
    default: mockDb
}));

vi.mock('../../../server/middleware/authMiddleware', () => ({
    default: (req, res, next) => {
        req.user = {
            id: 'user-1',
            organizationId: 'org-1',
            role: 'ADMIN'
        };
        next();
    }
}));

vi.mock('../../../server/routes/notifications', () => ({
    default: express.Router()
}));

vi.mock('../../../server/services/activityService', () => ({
    default: { logActivity: vi.fn() }
}));

vi.mock('../../../server/services/initiativeService', () => ({
    default: { updateProgress: vi.fn() }
}));

vi.mock('../../../server/utils/cacheHelper', () => ({
    default: { invalidate: vi.fn() }
}));

vi.mock('../../../server/services/taskAssignmentService', () => ({
    default: { assignTask: vi.fn() }
}));

vi.mock('../../../server/services/projectMemberService', () => ({
    default: { getMembers: vi.fn() }
}));

describe('Tasks Routes', () => {
    let app;

    beforeEach(async () => {
        vi.clearAllMocks();
        
        app = express();
        app.use(express.json());
        
        const tasksRouter = (await import('../../../server/routes/tasks.js')).default;
        app.use('/api/tasks', tasksRouter);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('GET /api/tasks', () => {
        it('returns list of tasks', async () => {
            const mockTasks = [
                {
                    id: 'task-1',
                    title: 'Review proposal',
                    status: 'todo',
                    priority: 'high',
                    assignee_id: 'user-1',
                    assignee_first_name: 'John',
                    assignee_last_name: 'Doe',
                    project_name: 'Project A'
                },
                {
                    id: 'task-2',
                    title: 'Prepare report',
                    status: 'in_progress',
                    priority: 'medium',
                    project_name: 'Project A'
                }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, mockTasks);
            });

            const response = await request(app)
                .get('/api/tasks')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveLength(2);
            expect(response.body[0].title).toBe('Review proposal');
        });

        it('filters by projectId', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                expect(sql).toContain('t.project_id = ?');
                expect(params).toContain('proj-1');
                callback(null, []);
            });

            await request(app)
                .get('/api/tasks?projectId=proj-1')
                .expect(200);
        });

        it('filters by status', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                expect(sql).toContain('t.status = ?');
                expect(params).toContain('completed');
                callback(null, []);
            });

            await request(app)
                .get('/api/tasks?status=completed')
                .expect(200);
        });

        it('filters by assigneeId', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                expect(sql).toContain('t.assignee_id = ?');
                expect(params).toContain('user-2');
                callback(null, []);
            });

            await request(app)
                .get('/api/tasks?assigneeId=user-2')
                .expect(200);
        });

        it('filters by priority', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                expect(sql).toContain('t.priority = ?');
                expect(params).toContain('urgent');
                callback(null, []);
            });

            await request(app)
                .get('/api/tasks?priority=urgent')
                .expect(200);
        });

        it('filters by initiativeId', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                expect(sql).toContain('t.initiative_id = ?');
                expect(params).toContain('init-1');
                callback(null, []);
            });

            await request(app)
                .get('/api/tasks?initiativeId=init-1')
                .expect(200);
        });

        it('parses JSON fields correctly', async () => {
            const mockTask = {
                id: 'task-1',
                title: 'Test',
                checklist: JSON.stringify([{ text: 'Item 1', done: false }]),
                attachments: JSON.stringify(['file1.pdf']),
                tags: JSON.stringify(['important']),
                assignees: JSON.stringify(['user-1', 'user-2'])
            };

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, [mockTask]);
            });

            const response = await request(app)
                .get('/api/tasks')
                .expect(200);

            expect(response.body[0].checklist).toEqual([{ text: 'Item 1', done: false }]);
            expect(response.body[0].attachments).toEqual(['file1.pdf']);
            expect(response.body[0].tags).toEqual(['important']);
            expect(response.body[0].assignees).toEqual(['user-1', 'user-2']);
        });

        it('orders by priority and due date', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                expect(sql).toContain('ORDER BY');
                expect(sql).toContain('CASE t.priority');
                expect(sql).toContain('t.due_date ASC');
                callback(null, []);
            });

            await request(app)
                .get('/api/tasks')
                .expect(200);
        });

        it('handles database errors', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(new Error('Database error'), null);
            });

            const response = await request(app)
                .get('/api/tasks')
                .expect(500);

            expect(response.body.error).toBe('Database error');
        });
    });

    describe('GET /api/tasks/:id', () => {
        it('returns single task', async () => {
            const mockTask = {
                id: 'task-1',
                organization_id: 'org-1',
                title: 'Review proposal',
                status: 'todo',
                priority: 'high'
            };

            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, mockTask);
            });

            const response = await request(app)
                .get('/api/tasks/task-1')
                .expect(200);

            expect(response.body.id).toBe('task-1');
            expect(response.body.title).toBe('Review proposal');
        });

        it('returns 404 for non-existent task', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const response = await request(app)
                .get('/api/tasks/non-existent')
                .expect(404);

            expect(response.body.error).toBe('Task not found');
        });
    });
});

