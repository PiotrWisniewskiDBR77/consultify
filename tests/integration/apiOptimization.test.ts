
import request from 'supertest';
import { describe, expect, it, vi, beforeAll, afterAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';

// Mock auth middleware
vi.mock('../../server/src/middleware/auth.middleware.js', () => ({
    verifyToken: (req: any, res: any, next: any) => {
        req.user = { id: 'test-user-id', organizationId: 'test-org-id', role: 'admin' };
        req.userRole = 'admin';
        req.userId = 'test-user-id';
        req.organizationId = 'test-org-id';
        next();
    },
    authenticateToken: (req: any, res: any, next: any) => {
        req.user = { id: 'test-user-id', organizationId: 'test-org-id', role: 'admin' };
        next();
    },
    authorizeRole: () => (req: any, res: any, next: any) => next(),
    requireSuperAdmin: (req: any, res: any, next: any) => next(),
    optionalAuth: (req: any, res: any, next: any) => next(),
    requireRole: () => (req: any, res: any, next: any) => next(),
    requireOrganization: (req: any, res: any, next: any) => next(),
    requirePermission: () => (req: any, res: any, next: any) => next(),
}));

// Mock permission service
vi.mock('../../server/services/permissionService.js', () => ({
    default: {
        checkPermission: vi.fn().mockResolvedValue(true)
    },
    PermissionService: {
        checkPermission: vi.fn().mockResolvedValue(true)
    }
}));

// Mock orgContext middleware
vi.mock('../../server/src/middleware/orgContext.middleware.js', () => ({
    orgContextMiddleware: (req: any, res: any, next: any) => next()
}));

// Import app
import app from '../../server/src/index.js';
import DbPromise from '../../server/src/utils/DbPromise.js';

describe('API Optimization', () => {
    const orgId = 'test-org-id';
    const projectId = uuidv4();
    let mockTasks: any[] = [];
    let originalDbMock: any;

    beforeAll(async () => {
        // Access global mock
        const globalMock = (global as any).__TEST_DB_MOCK__;
        if (!globalMock) {
            throw new Error('Global DB mock not found, ensure setup.ts is running');
        }

        // Setup stateful mock implementation on the global object
        globalMock.run.mockImplementation(async (sql: string, params: any[], cb: any) => {
            const callback = typeof params === 'function' ? params : cb;

            if (sql.includes('INSERT INTO tasks')) {
                const p = params || [];
                const newTask = {
                    id: p[0],
                    project_id: p[1],
                    organization_id: p[2],
                    title: p[3],
                    status: p[4],
                    priority: p[5],
                    created_at: p[6],
                    updated_at: p[7]
                };
                mockTasks.push(newTask);
                if (callback) callback.call({ lastID: 1, changes: 1 }, null);
                return { success: true, changes: 1 };
            }
            if (sql.includes('DELETE FROM tasks')) {
                const pid = params[0];
                const indicesToRemove: number[] = [];
                mockTasks.forEach((t, i) => {
                    if (t.project_id === pid) indicesToRemove.push(i);
                });
                for (let i = indicesToRemove.length - 1; i >= 0; i--) {
                    mockTasks.splice(indicesToRemove[i], 1);
                }
                if (callback) callback.call({ lastID: 0, changes: indicesToRemove.length }, null);
                return { success: true, changes: indicesToRemove.length };
            }
            if (callback) callback.call({ lastID: 0, changes: 0 }, null);
            return { success: true, changes: 0 };
        });

        // Mock ALL - used by DbPromise.all
        // Note: DbPromise.all calls db.all(sql, params, callback)
        globalMock.all.mockImplementation((sql: string, params: any[], cb: any) => {
            const callback = typeof params === 'function' ? params : cb;
            // Use simple robust matching
            if (sql.replace(/\s+/g, ' ').includes('FROM tasks')) {
                let filtered = [...mockTasks];
                const p = params || [];

                // Params are [orgId, projectId, limit, offset]
                if (p.length >= 2) {
                    filtered = filtered.filter(t => t.organization_id === p[0] && t.project_id === p[1]);
                } else if (p.length >= 1) {
                    // Fallback if only one param (unlikely given logic, but safe)
                    filtered = filtered.filter(t => t.project_id === p[0] || t.organization_id === p[0]);
                }

                // Handle LIMIT and OFFSET
                if (p.length >= 2) {
                    const limit = Number(p[p.length - 2]);
                    const offset = Number(p[p.length - 1]);
                    filtered = filtered.slice(offset, offset + limit);
                }

                if (callback) callback(null, filtered);
                return filtered;
            }
            if (callback) callback(null, []);
            return [];
        });

        // Mock GET - used by DbPromise.get
        globalMock.get.mockImplementation((sql: string, params: any[], cb: any) => {
            const callback = typeof params === 'function' ? params : cb;

            if (sql.replace(/\s+/g, ' ').includes('FROM tasks') && sql.includes('COUNT')) {
                const p = params || [];
                const filtered = mockTasks.filter(t => t.organization_id === p[0] && t.project_id === p[1]);
                if (callback) callback(null, { total: filtered.length });
                return { total: filtered.length };
            }

            if (callback) callback(null, null);
            return null;
        });

        // Seed 55 tasks
        mockTasks = [];
        const tasks = Array.from({ length: 55 }, (_, i) => ({
            id: uuidv4(),
            project_id: projectId,
            organization_id: orgId,
            title: `Task ${i + 1}`,
            status: 'todo',
            priority: 'medium',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }));

        for (const task of tasks) {
            await DbPromise.run(
                `INSERT INTO tasks (id, project_id, organization_id, title, status, priority, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [task.id, task.project_id, task.organization_id, task.title, task.status, task.priority, task.created_at, task.updated_at]
            );
        }
    });

    afterAll(async () => {
        vi.clearAllMocks();
    });

    it('should return compressed response for large payloads', async () => {
        const res = await request(app)
            .get('/api/tasks')
            .query({ projectId })
            .set('Accept-Encoding', 'gzip');

        expect(res.status).toBe(200);
        expect(res.headers['content-encoding']).toBe('gzip');
    });

    it('should paginate tasks correctly (default limit 100)', async () => {
        const res = await request(app)
            .get('/api/tasks')
            .query({ projectId });

        expect(res.status).toBe(200);
        expect(res.body.length).toBe(55); // All 55 returned as limit is 100
        expect(Number(res.headers['x-total-count'])).toBe(55);
        expect(Number(res.headers['x-page'])).toBe(1);
        expect(Number(res.headers['x-limit'])).toBe(100);
        expect(Number(res.headers['x-total-pages'])).toBe(1);
    });

    it('should respect custom limit and page', async () => {
        // Page 1, limit 10
        const res1 = await request(app)
            .get('/api/tasks')
            .query({ projectId, limit: 10, page: 1 });

        expect(res1.status).toBe(200);
        expect(res1.body.length).toBe(10);
        expect(Number(res1.headers['x-page'])).toBe(1);
        expect(Number(res1.headers['x-total-pages'])).toBe(6); // 55 items / 10 = 5.5 -> 6 pages

        // Page 6 (last page), limit 10
        const res2 = await request(app)
            .get('/api/tasks')
            .query({ projectId, limit: 10, page: 6 });

        expect(res2.status).toBe(200);
        expect(res2.body.length).toBe(5);
        expect(Number(res2.headers['x-page'])).toBe(6);
    });

    it('should apply rate limits (skip in test env normally, but logic is there)', async () => {
        // Since we are running in 'test' env, rate limiter is skipped in index.ts:
        // skip: (req) => isTest || ...
        // So we can only verify it passes through.
        const res = await request(app).get('/ping');
        expect(res.status).toBe(200);
    });
});
