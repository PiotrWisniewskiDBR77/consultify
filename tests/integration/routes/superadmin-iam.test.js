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

/**
 * Integration Tests for SuperAdmin IAM Routes
 */

const { describe, it, expect, beforeAll, afterAll, beforeEach } = require('vitest');
const app = require('../../../server/index');

// Helper to get auth token
const getAuthToken = async () => {
    const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'admin@dbr77.com', password: '123456' });
    return res.body.token;
};

describe('SuperAdmin IAM Routes', () => {
    const db = getDatabase();
    let token;

    beforeAll(async () => {
        await initializeDatabase();
        token = await getAuthToken();
    });

    describe('Admin Sessions', () => {
    const db = getDatabase();
        describe('GET /api/superadmin/admin/sessions', () => {
    const db = getDatabase();
            it('should return list of admin sessions', async () => {
                const res = await request(app)
                    .get('/api/superadmin/admin/sessions')
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(Array.isArray(res.body)).toBe(true);
            });

            it('should require authentication', async () => {
                const res = await request(app)
                    .get('/api/superadmin/admin/sessions');

                expect(res.status).toBe(401);
            });
        });

        describe('POST /api/superadmin/admin/sessions', () => {
    const db = getDatabase();
            it('should create a new admin session', async () => {
                const res = await request(app)
                    .post('/api/superadmin/admin/sessions')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ mfaVerified: true, expiresInHours: 24 });

                expect(res.status).toBe(200);
                expect(res.body).toHaveProperty('sessionToken');
                expect(res.body.mfaVerified).toBe(true);
            });
        });

        describe('DELETE /api/superadmin/admin/sessions/:id', () => {
    const db = getDatabase();
            it('should revoke an admin session', async () => {
                // First create a session
                const createRes = await request(app)
                    .post('/api/superadmin/admin/sessions')
                    .set('Authorization', `Bearer ${token}`)
                    .send({ mfaVerified: false });

                const sessionId = createRes.body.id;

                // Then revoke it
                const res = await request(app)
                    .delete(`/api/superadmin/admin/sessions/${sessionId}`)
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body.message).toContain('revoked');
            });
        });

        describe('GET /api/superadmin/admin/sessions/stats', () => {
    const db = getDatabase();
            it('should return session statistics', async () => {
                const res = await request(app)
                    .get('/api/superadmin/admin/sessions/stats')
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body).toHaveProperty('totalSessions');
                expect(res.body).toHaveProperty('activeSessions');
            });
        });
    });

    describe('Admin Audit Logs', () => {
    const db = getDatabase();
        describe('GET /api/superadmin/admin/audit-logs', () => {
    const db = getDatabase();
            it('should return list of audit logs', async () => {
                const res = await request(app)
                    .get('/api/superadmin/admin/audit-logs')
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(Array.isArray(res.body)).toBe(true);
            });

            it('should filter by action type', async () => {
                const res = await request(app)
                    .get('/api/superadmin/admin/audit-logs?actionType=login')
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
            });

            it('should filter by status', async () => {
                const res = await request(app)
                    .get('/api/superadmin/admin/audit-logs?status=unresolved')
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
            });
        });

        describe('GET /api/superadmin/admin/audit-logs/stats', () => {
    const db = getDatabase();
            it('should return audit statistics', async () => {
                const res = await request(app)
                    .get('/api/superadmin/admin/audit-logs/stats')
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body).toHaveProperty('total_logs');
            });
        });
    });

    describe('Admin Permissions', () => {
    const db = getDatabase();
        describe('GET /api/superadmin/admin/permissions', () => {
    const db = getDatabase();
            it('should return list of permissions', async () => {
                const res = await request(app)
                    .get('/api/superadmin/admin/permissions')
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(Array.isArray(res.body)).toBe(true);
            });
        });

        describe('GET /api/superadmin/admin/permissions/matrix', () => {
    const db = getDatabase();
            it('should return permissions matrix', async () => {
                const res = await request(app)
                    .get('/api/superadmin/admin/permissions/matrix')
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(res.body).toHaveProperty('categories');
                expect(res.body).toHaveProperty('roles');
                expect(res.body).toHaveProperty('matrix');
            });
        });

        describe('POST /api/superadmin/admin/permissions', () => {
    const db = getDatabase();
            it('should create a new permission', async () => {
                const res = await request(app)
                    .post('/api/superadmin/admin/permissions')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        key: 'test:permission:' + Date.now(),
                        description: 'Test permission',
                        category: 'general'
                    });

                expect(res.status).toBe(200);
                expect(res.body).toHaveProperty('key');
            });
        });
    });

    describe('Approval Workflows', () => {
    const db = getDatabase();
        describe('GET /api/superadmin/admin/approval-workflows', () => {
    const db = getDatabase();
            it('should return list of workflows', async () => {
                const res = await request(app)
                    .get('/api/superadmin/admin/approval-workflows')
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(Array.isArray(res.body)).toBe(true);
            });
        });

        describe('POST /api/superadmin/admin/approval-workflows', () => {
    const db = getDatabase();
            it('should create a new workflow', async () => {
                const res = await request(app)
                    .post('/api/superadmin/admin/approval-workflows')
                    .set('Authorization', `Bearer ${token}`)
                    .send({
                        name: 'Test Workflow ' + Date.now(),
                        description: 'Test workflow description',
                        resourceType: 'organization',
                        approvers: ['admin@test.com']
                    });

                expect(res.status).toBe(200);
                expect(res.body).toHaveProperty('id');
            });
        });

        describe('GET /api/superadmin/admin/approval-requests', () => {
    const db = getDatabase();
            it('should return list of approval requests', async () => {
                const res = await request(app)
                    .get('/api/superadmin/admin/approval-requests')
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
                expect(Array.isArray(res.body)).toBe(true);
            });

            it('should filter by status', async () => {
                const res = await request(app)
                    .get('/api/superadmin/admin/approval-requests?status=pending')
                    .set('Authorization', `Bearer ${token}`);

                expect(res.status).toBe(200);
            });
        });
    });
});