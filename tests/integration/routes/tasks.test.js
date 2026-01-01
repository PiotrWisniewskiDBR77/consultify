/**
 * Tasks Routes Integration Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Import REAL database module (CJS interop)
import db from '../../../server/database';

// Mock other dependencies globally (ESM mocks)
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
    default: {
        createNotification: vi.fn()
    }
}));

vi.mock('../../../server/services/activityService', () => ({
    default: { log: vi.fn() }
}));

vi.mock('../../../server/services/initiativeService', () => ({
    default: { recalculateProgress: vi.fn().mockResolvedValue() }
}));

vi.mock('../../../server/utils/cacheHelper', () => ({
    default: {
        invalidate: vi.fn(),
        invalidateProjectCache: vi.fn(),
        invalidateUserCache: vi.fn()
    }
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

        // Spy on the real DB instance methods
        // We need to restore mocks first to avoid stacking spies
        vi.restoreAllMocks();

        // Default implementations
        vi.spyOn(db, 'all').mockImplementation((sql, params, callback) => callback(null, []));
        vi.spyOn(db, 'get').mockImplementation((sql, params, callback) => callback(null, null));
        vi.spyOn(db, 'run').mockImplementation(function (sql, params, callback) {
            const cb = typeof params === 'function' ? params : callback;
            if (cb) cb.call({ changes: 1, lastID: 1 }, null);
        });
        // POST uses db.prepare
        if (!db.prepare) {
            db.prepare = vi.fn(() => ({
                run: vi.fn((...args) => {
                    const cb = args.pop();
                    if (typeof cb === 'function') cb.call({ changes: 1, lastID: 1 }, null);
                }),
                finalize: vi.fn()
            }));
        } else {
            vi.spyOn(db, 'prepare').mockImplementation(() => ({
                run: vi.fn((...args) => {
                    const cb = args.pop();
                    if (typeof cb === 'function') cb.call({ changes: 1, lastID: 1 }, null);
                }),
                finalize: vi.fn()
            }));
        }

        app = express();
        app.use(express.json());

        // Use require to load the CJS router
        // Since we are modifing the db OBJECT, we don't need to reload the router if it holds the same object ref
        // But cleaning router cache is good practice
        const routerPath = require.resolve('../../../server/routes/tasks.js');
        delete require.cache[routerPath];
        const tasksRouter = require('../../../server/routes/tasks.js');

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

            db.all.mockImplementation((sql, params, callback) => {
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
            db.all.mockImplementation((sql, params, callback) => {
                expect(sql).toContain('t.project_id = ?');
                expect(params).toContain('proj-1');
                callback(null, []);
            });

            await request(app)
                .get('/api/tasks?projectId=proj-1')
                .expect(200);
        });

        it('filters by status', async () => {
            db.all.mockImplementation((sql, params, callback) => {
                expect(sql).toContain('t.status = ?');
                expect(params).toContain('completed');
                callback(null, []);
            });

            await request(app)
                .get('/api/tasks?status=completed')
                .expect(200);
        });

        it('filters by assigneeId', async () => {
            db.all.mockImplementation((sql, params, callback) => {
                expect(sql).toContain('t.assignee_id = ?');
                expect(params).toContain('user-2');
                callback(null, []);
            });

            await request(app)
                .get('/api/tasks?assigneeId=user-2')
                .expect(200);
        });

        it('filters by priority', async () => {
            db.all.mockImplementation((sql, params, callback) => {
                expect(sql).toContain('t.priority = ?');
                expect(params).toContain('urgent');
                callback(null, []);
            });

            await request(app)
                .get('/api/tasks?priority=urgent')
                .expect(200);
        });

        it('filters by initiativeId', async () => {
            db.all.mockImplementation((sql, params, callback) => {
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

            db.all.mockImplementation((sql, params, callback) => {
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
            db.all.mockImplementation((sql, params, callback) => {
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
            db.all.mockImplementation((sql, params, callback) => {
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

            db.get.mockImplementation((sql, params, callback) => {
                callback(null, mockTask);
            });

            const response = await request(app)
                .get('/api/tasks/task-1')
                .expect(200);

            expect(response.body.id).toBe('task-1');
            expect(response.body.title).toBe('Review proposal');
        });

        it('returns 404 for non-existent task', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const response = await request(app)
                .get('/api/tasks/non-existent')
                .expect(404);

            expect(response.body.error).toBe('Task not found');
        });
    });
});

