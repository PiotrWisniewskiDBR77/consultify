/**
 * Decisions Routes Integration Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock database
const mockDb = {
    all: vi.fn((sql, params, callback) => callback(null, [])),
    get: vi.fn((sql, params, callback) => callback(null, null)),
    run: vi.fn(function(sql, params, callback) { callback.call({ changes: 1, lastID: 1 }, null); })
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
        req.userId = 'user-1';
        req.userRole = 'ADMIN';
        req.can = (permission) => true;
        next();
    }
}));

describe('Decisions Routes', () => {
    let app;

    beforeEach(async () => {
        vi.clearAllMocks();
        
        app = express();
        app.use(express.json());
        
        const decisionsRouter = (await import('../../../server/routes/decisions.js')).default;
        app.use('/api/decisions', decisionsRouter);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('GET /api/decisions', () => {
        it('returns list of decisions', async () => {
            const mockDecisions = [
                {
                    id: 'dec-1',
                    project_id: 'proj-1',
                    title: 'Approve budget increase',
                    status: 'PENDING',
                    first_name: 'John',
                    last_name: 'Doe'
                },
                {
                    id: 'dec-2',
                    project_id: 'proj-1',
                    title: 'Change scope',
                    status: 'APPROVED',
                    first_name: 'Jane',
                    last_name: 'Smith'
                }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(null, mockDecisions);
            });

            const response = await request(app)
                .get('/api/decisions')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body).toHaveLength(2);
            expect(response.body[0].title).toBe('Approve budget increase');
        });

        it('filters by projectId', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                expect(sql).toContain('d.project_id = ?');
                expect(params).toContain('proj-1');
                callback(null, []);
            });

            await request(app)
                .get('/api/decisions?projectId=proj-1')
                .expect(200);
        });

        it('filters by status', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                expect(sql).toContain('d.status = ?');
                expect(params).toContain('PENDING');
                callback(null, []);
            });

            await request(app)
                .get('/api/decisions?status=PENDING')
                .expect(200);
        });

        it('filters by relatedObjectId', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                expect(sql).toContain('d.related_object_id = ?');
                expect(params).toContain('init-1');
                callback(null, []);
            });

            await request(app)
                .get('/api/decisions?relatedObjectId=init-1')
                .expect(200);
        });

        it('orders by created_at DESC', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                expect(sql).toContain('ORDER BY d.created_at DESC');
                callback(null, []);
            });

            await request(app)
                .get('/api/decisions')
                .expect(200);
        });

        it('handles database errors', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback(new Error('Database error'), null);
            });

            const response = await request(app)
                .get('/api/decisions')
                .expect(500);

            expect(response.body.error).toBe('Database error');
        });
    });

    describe('GET /api/decisions/:id', () => {
        it('returns single decision', async () => {
            const mockDecision = {
                id: 'dec-1',
                title: 'Approve budget',
                status: 'PENDING',
                audit_trail: JSON.stringify([
                    { action: 'CREATED', by: 'user-1', at: '2024-01-15T10:00:00Z' }
                ])
            };

            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, mockDecision);
            });

            const response = await request(app)
                .get('/api/decisions/dec-1')
                .expect(200);

            expect(response.body.id).toBe('dec-1');
            expect(response.body.auditTrail).toHaveLength(1);
        });

        it('returns 404 for non-existent decision', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const response = await request(app)
                .get('/api/decisions/non-existent')
                .expect(404);

            expect(response.body.error).toBe('Decision not found');
        });

        it('handles malformed audit trail', async () => {
            const mockDecision = {
                id: 'dec-1',
                title: 'Test',
                audit_trail: 'invalid json'
            };

            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, mockDecision);
            });

            const response = await request(app)
                .get('/api/decisions/dec-1')
                .expect(200);

            expect(response.body.auditTrail).toEqual([]);
        });
    });

    describe('POST /api/decisions', () => {
        it('creates new decision', async () => {
            mockDb.run.mockImplementation(function(sql, params, callback) {
                callback.call({ changes: 1, lastID: 1 }, null);
            });

            const newDecision = {
                projectId: 'proj-1',
                decisionType: 'BUDGET',
                relatedObjectType: 'INITIATIVE',
                relatedObjectId: 'init-1',
                title: 'Approve budget increase',
                description: 'Need to increase budget by 10%'
            };

            const response = await request(app)
                .post('/api/decisions')
                .send(newDecision)
                .expect(201);

            expect(response.body.id).toBeDefined();
            expect(response.body.projectId).toBe('proj-1');
            expect(response.body.title).toBe('Approve budget increase');
            expect(response.body.status).toBe('PENDING');
        });

        it('returns 400 for missing required fields', async () => {
            const incompleteDecision = {
                projectId: 'proj-1',
                // Missing required fields
            };

            const response = await request(app)
                .post('/api/decisions')
                .send(incompleteDecision)
                .expect(400);

            expect(response.body.error).toBe('Missing required fields');
        });

        it('includes audit trail in created decision', async () => {
            mockDb.run.mockImplementation(function(sql, params, callback) {
                // Verify audit trail is included
                const auditTrail = JSON.parse(params[9]);
                expect(auditTrail[0].action).toBe('CREATED');
                expect(auditTrail[0].by).toBe('user-1');
                callback.call({ changes: 1 }, null);
            });

            await request(app)
                .post('/api/decisions')
                .send({
                    projectId: 'proj-1',
                    decisionType: 'SCOPE',
                    relatedObjectType: 'INITIATIVE',
                    relatedObjectId: 'init-1',
                    title: 'Test decision'
                })
                .expect(201);
        });

        it('handles database errors', async () => {
            mockDb.run.mockImplementation(function(sql, params, callback) {
                callback(new Error('Insert failed'));
            });

            const response = await request(app)
                .post('/api/decisions')
                .send({
                    projectId: 'proj-1',
                    decisionType: 'SCOPE',
                    relatedObjectType: 'INITIATIVE',
                    relatedObjectId: 'init-1',
                    title: 'Test'
                })
                .expect(500);

            expect(response.body.error).toBe('Insert failed');
        });
    });

    describe('PATCH /api/decisions/:id/decide', () => {
        it('approves decision', async () => {
            const mockDecision = {
                id: 'dec-1',
                decision_owner_id: 'user-1',
                audit_trail: JSON.stringify([])
            };

            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, mockDecision);
            });

            mockDb.run.mockImplementation(function(sql, params, callback) {
                callback.call({ changes: 1 }, null);
            });

            const response = await request(app)
                .patch('/api/decisions/dec-1/decide')
                .send({ status: 'APPROVED', outcome: 'Approved with conditions' })
                .expect(200);

            expect(response.body.status).toBe('APPROVED');
            expect(response.body.decidedBy).toBe('user-1');
        });

        it('rejects decision', async () => {
            const mockDecision = {
                id: 'dec-1',
                decision_owner_id: 'user-1',
                audit_trail: JSON.stringify([])
            };

            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, mockDecision);
            });

            mockDb.run.mockImplementation(function(sql, params, callback) {
                callback.call({ changes: 1 }, null);
            });

            const response = await request(app)
                .patch('/api/decisions/dec-1/decide')
                .send({ status: 'REJECTED', outcome: 'Not aligned with strategy' })
                .expect(200);

            expect(response.body.status).toBe('REJECTED');
        });

        it('returns 400 for invalid status', async () => {
            const response = await request(app)
                .patch('/api/decisions/dec-1/decide')
                .send({ status: 'INVALID' })
                .expect(400);

            expect(response.body.error).toBe('Invalid status');
        });

        it('returns 404 for non-existent decision', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            const response = await request(app)
                .patch('/api/decisions/non-existent/decide')
                .send({ status: 'APPROVED' })
                .expect(404);

            expect(response.body.error).toBe('Decision not found');
        });

        it('updates audit trail', async () => {
            const mockDecision = {
                id: 'dec-1',
                decision_owner_id: 'user-1',
                audit_trail: JSON.stringify([
                    { action: 'CREATED', by: 'user-1', at: '2024-01-15T10:00:00Z' }
                ])
            };

            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, mockDecision);
            });

            mockDb.run.mockImplementation(function(sql, params, callback) {
                // Verify audit trail includes new entry
                const auditTrail = JSON.parse(params[2]);
                expect(auditTrail).toHaveLength(2);
                expect(auditTrail[1].action).toBe('APPROVED');
                callback.call({ changes: 1 }, null);
            });

            await request(app)
                .patch('/api/decisions/dec-1/decide')
                .send({ status: 'APPROVED', outcome: 'Approved' })
                .expect(200);
        });

        it('allows admin to decide any decision', async () => {
            const mockDecision = {
                id: 'dec-1',
                decision_owner_id: 'other-user', // Different from request user
                audit_trail: JSON.stringify([])
            };

            mockDb.get.mockImplementation((sql, params, callback) => {
                callback(null, mockDecision);
            });

            mockDb.run.mockImplementation(function(sql, params, callback) {
                callback.call({ changes: 1 }, null);
            });

            const response = await request(app)
                .patch('/api/decisions/dec-1/decide')
                .send({ status: 'APPROVED' })
                .expect(200);

            expect(response.body.status).toBe('APPROVED');
        });
    });
});



