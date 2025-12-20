/**
 * Integration Tests for Invitation Routes
 * 
 * Tests the invitation API endpoints for:
 * - Organization invitations
 * - Project invitations
 * - Token validation and acceptance
 * - Resend and revoke functionality
 * - Audit trail logging
 */

const request = require('supertest');
const app = require('../../server/server');
const db = require('../../server/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

describe('Invitation Routes', () => {
    let adminToken;
    let testOrgId;
    let testProjectId;
    let testAdminId;
    let testInvitationId;
    let testInvitationToken;

    // Setup test data before all tests
    beforeAll(async () => {
        // Create test organization
        testOrgId = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO organizations (id, name, plan, status, organization_type) VALUES (?, ?, ?, ?, ?)`,
                [testOrgId, 'Test Org', 'professional', 'active', 'PAID'],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Create test admin user
        testAdminId = uuidv4();
        const hashedPassword = bcrypt.hashSync('password123', 10);
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [testAdminId, testOrgId, 'admin@test.com', hashedPassword, 'Test', 'Admin', 'ADMIN', 'active'],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Create test project
        testProjectId = uuidv4();
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO projects (id, organization_id, name, status, owner_id) VALUES (?, ?, ?, ?, ?)`,
                [testProjectId, testOrgId, 'Test Project', 'active', testAdminId],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Get admin auth token
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'admin@test.com', password: 'password123' });

        adminToken = loginRes.body.token;
    });

    // Cleanup after all tests
    afterAll(async () => {
        // Clean up test data
        await new Promise((resolve) => {
            db.run('DELETE FROM invitation_events WHERE invitation_id IN (SELECT id FROM invitations WHERE organization_id = ?)', [testOrgId], resolve);
        });
        await new Promise((resolve) => {
            db.run('DELETE FROM invitations WHERE organization_id = ?', [testOrgId], resolve);
        });
        await new Promise((resolve) => {
            db.run('DELETE FROM project_users WHERE project_id = ?', [testProjectId], resolve);
        });
        await new Promise((resolve) => {
            db.run('DELETE FROM projects WHERE id = ?', [testProjectId], resolve);
        });
        await new Promise((resolve) => {
            db.run('DELETE FROM users WHERE organization_id = ?', [testOrgId], resolve);
        });
        await new Promise((resolve) => {
            db.run('DELETE FROM organizations WHERE id = ?', [testOrgId], resolve);
        });
    });

    // ==========================================
    // Organization Invitation Tests
    // ==========================================

    describe('POST /api/invitations/org', () => {
        it('should create an organization invitation', async () => {
            const res = await request(app)
                .post('/api/invitations/org')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    email: 'newuser@test.com',
                    role: 'USER'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.invitation).toBeDefined();
            expect(res.body.invitation.email).toBe('newuser@test.com');
            expect(res.body.invitation.role).toBe('USER');
            expect(res.body.invitation.status).toBe('pending');

            testInvitationId = res.body.invitation.id;
        });

        it('should reject duplicate invitation for same email', async () => {
            const res = await request(app)
                .post('/api/invitations/org')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    email: 'newuser@test.com',
                    role: 'USER'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('pending invitation already exists');
        });

        it('should reject invalid email format', async () => {
            const res = await request(app)
                .post('/api/invitations/org')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    email: 'invalid-email',
                    role: 'USER'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('Invalid email');
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .post('/api/invitations/org')
                .send({
                    email: 'another@test.com',
                    role: 'USER'
                });

            expect(res.statusCode).toBe(401);
        });
    });

    // ==========================================
    // List Invitations Tests
    // ==========================================

    describe('GET /api/invitations/org', () => {
        it('should list organization invitations', async () => {
            const res = await request(app)
                .get('/api/invitations/org')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);
        });

        it('should filter by status', async () => {
            const res = await request(app)
                .get('/api/invitations/org?status=pending')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            res.body.forEach(inv => {
                expect(inv.status).toBe('pending');
            });
        });
    });

    // ==========================================
    // Token Validation Tests
    // ==========================================

    describe('GET /api/invitations/validate/:token', () => {
        let validToken;

        beforeAll(async () => {
            // Get a valid token from the database
            const invitation = await new Promise((resolve, reject) => {
                db.get(
                    'SELECT token FROM invitations WHERE id = ?',
                    [testInvitationId],
                    (err, row) => err ? reject(err) : resolve(row)
                );
            });
            validToken = invitation?.token;
            testInvitationToken = validToken;
        });

        it('should validate a valid token', async () => {
            const res = await request(app)
                .get(`/api/invitations/validate/${validToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.valid).toBe(true);
            expect(res.body.email).toBe('newuser@test.com');
            expect(res.body.organizationName).toBe('Test Org');
        });

        it('should reject invalid token', async () => {
            const res = await request(app)
                .get('/api/invitations/validate/invalidtoken123');

            expect(res.statusCode).toBe(404);
            expect(res.body.error).toContain('Invalid invitation token');
        });
    });

    // ==========================================
    // Accept Invitation Tests
    // ==========================================

    describe('POST /api/invitations/accept', () => {
        it('should reject acceptance with wrong email', async () => {
            const res = await request(app)
                .post('/api/invitations/accept')
                .send({
                    token: testInvitationToken,
                    email: 'wrong@email.com',
                    firstName: 'Wrong',
                    lastName: 'User',
                    password: 'password123'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('does not match');
        });

        it('should reject acceptance with short password', async () => {
            const res = await request(app)
                .post('/api/invitations/accept')
                .send({
                    token: testInvitationToken,
                    email: 'newuser@test.com',
                    firstName: 'New',
                    lastName: 'User',
                    password: '123'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('at least 8 characters');
        });

        it('should accept valid invitation', async () => {
            const res = await request(app)
                .post('/api/invitations/accept')
                .send({
                    token: testInvitationToken,
                    email: 'newuser@test.com',
                    firstName: 'New',
                    lastName: 'User',
                    password: 'password123'
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.user).toBeDefined();
            expect(res.body.user.email).toBe('newuser@test.com');
        });

        it('should reject reusing the same token', async () => {
            const res = await request(app)
                .post('/api/invitations/accept')
                .send({
                    token: testInvitationToken,
                    email: 'newuser@test.com',
                    firstName: 'New',
                    lastName: 'User',
                    password: 'password123'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('accepted');
        });
    });

    // ==========================================
    // Resend Invitation Tests
    // ==========================================

    describe('POST /api/invitations/:id/resend', () => {
        let resendInvitationId;

        beforeAll(async () => {
            // Create a new invitation for resend test
            const res = await request(app)
                .post('/api/invitations/org')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    email: 'resendtest@test.com',
                    role: 'USER'
                });
            resendInvitationId = res.body.invitation.id;
        });

        it('should resend an invitation', async () => {
            // Get original token
            const originalInv = await new Promise((resolve, reject) => {
                db.get('SELECT token FROM invitations WHERE id = ?', [resendInvitationId], (err, row) => err ? reject(err) : resolve(row));
            });

            const res = await request(app)
                .post(`/api/invitations/${resendInvitationId}/resend`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);

            // Verify token changed
            const newInv = await new Promise((resolve, reject) => {
                db.get('SELECT token FROM invitations WHERE id = ?', [resendInvitationId], (err, row) => err ? reject(err) : resolve(row));
            });
            expect(newInv.token).not.toBe(originalInv.token);
        });
    });

    // ==========================================
    // Revoke Invitation Tests
    // ==========================================

    describe('POST /api/invitations/:id/revoke', () => {
        let revokeInvitationId;

        beforeAll(async () => {
            // Create a new invitation for revoke test
            const res = await request(app)
                .post('/api/invitations/org')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    email: 'revoketest@test.com',
                    role: 'USER'
                });
            revokeInvitationId = res.body.invitation.id;
        });

        it('should revoke an invitation', async () => {
            const res = await request(app)
                .post(`/api/invitations/${revokeInvitationId}/revoke`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.invitation.status).toBe('revoked');
        });

        it('should not revoke an already revoked invitation', async () => {
            const res = await request(app)
                .post(`/api/invitations/${revokeInvitationId}/revoke`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('Cannot revoke');
        });
    });

    // ==========================================
    // Audit Trail Tests
    // ==========================================

    describe('GET /api/invitations/:id/audit', () => {
        it('should return audit trail for invitation', async () => {
            const res = await request(app)
                .get(`/api/invitations/${testInvitationId}/audit`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);

            // Should have 'created', 'sent', and 'accepted' events
            const eventTypes = res.body.map(e => e.eventType);
            expect(eventTypes).toContain('created');
            expect(eventTypes).toContain('accepted');
        });
    });

    // ==========================================
    // Project Invitation Tests
    // ==========================================

    describe('POST /api/invitations/project', () => {
        it('should create a project invitation', async () => {
            const res = await request(app)
                .post('/api/invitations/project')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    projectId: testProjectId,
                    email: 'projectuser@test.com',
                    projectRole: 'member',
                    orgRole: 'USER'
                });

            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.invitation.projectRole).toBe('member');
        });

        it('should require project ID', async () => {
            const res = await request(app)
                .post('/api/invitations/project')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    email: 'noprojectid@test.com',
                    projectRole: 'member'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('Project ID');
        });
    });

    // ==========================================
    // Enterprise+ Security Tests
    // ==========================================

    describe('Enterprise+ Security - DEMO Org Blocking', () => {
        let demoOrgId;
        let demoAdminId;
        let demoAdminToken;

        beforeAll(async () => {
            // Create DEMO organization
            demoOrgId = uuidv4();
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO organizations (id, name, plan, status, organization_type) VALUES (?, ?, ?, ?, ?)`,
                    [demoOrgId, 'Demo Org', 'demo', 'active', 'DEMO'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            // Create admin user for demo org
            demoAdminId = uuidv4();
            const hashedPassword = bcrypt.hashSync('password123', 10);
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role, status) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [demoAdminId, demoOrgId, 'demoadmin@test.com', hashedPassword, 'Demo', 'Admin', 'ADMIN', 'active'],
                    (err) => err ? reject(err) : resolve()
                );
            });

            // Get demo admin auth token
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({ email: 'demoadmin@test.com', password: 'password123' });

            demoAdminToken = loginRes.body.token;
        });

        afterAll(async () => {
            await new Promise((resolve) => {
                db.run('DELETE FROM users WHERE organization_id = ?', [demoOrgId], resolve);
            });
            await new Promise((resolve) => {
                db.run('DELETE FROM organizations WHERE id = ?', [demoOrgId], resolve);
            });
        });

        it('should block invitations from DEMO organizations', async () => {
            const res = await request(app)
                .post('/api/invitations/org')
                .set('Authorization', `Bearer ${demoAdminToken}`)
                .send({
                    email: 'newdemomember@test.com',
                    role: 'USER'
                });

            expect(res.statusCode).toBe(400);
            expect(res.body.error).toContain('Demo');
        });
    });

    describe('Enterprise+ Security - Resend Limits', () => {
        let resendLimitInvitationId;

        beforeAll(async () => {
            // Create a new invitation for resend limit test
            const res = await request(app)
                .post('/api/invitations/org')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    email: 'resendlimittest@test.com',
                    role: 'USER'
                });
            resendLimitInvitationId = res.body.invitation.id;
        });

        it('should track resend count', async () => {
            // First resend
            const res1 = await request(app)
                .post(`/api/invitations/${resendLimitInvitationId}/resend`)
                .set('Authorization', `Bearer ${adminToken}`);
            expect(res1.statusCode).toBe(200);

            // Check resend count in DB
            const inv = await new Promise((resolve, reject) => {
                db.get('SELECT resend_count FROM invitations WHERE id = ?', [resendLimitInvitationId], (err, row) => err ? reject(err) : resolve(row));
            });
            expect(inv.resend_count).toBe(1);
        });
    });

    describe('Enterprise+ Security - Race Condition Protection', () => {
        let raceInvitationId;
        let raceInvitationToken;

        beforeAll(async () => {
            // Create invitation for race test
            const res = await request(app)
                .post('/api/invitations/org')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    email: 'racetest@test.com',
                    role: 'USER'
                });
            raceInvitationId = res.body.invitation.id;

            // Get token
            const inv = await new Promise((resolve, reject) => {
                db.get('SELECT token FROM invitations WHERE id = ?', [raceInvitationId], (err, row) => err ? reject(err) : resolve(row));
            });
            raceInvitationToken = inv.token;
        });

        it('should return 409 on double acceptance attempt', async () => {
            // First accept (should succeed)
            const res1 = await request(app)
                .post('/api/invitations/accept')
                .send({
                    token: raceInvitationToken,
                    email: 'racetest@test.com',
                    firstName: 'Race',
                    lastName: 'Test',
                    password: 'password123'
                });
            expect(res1.statusCode).toBe(200);

            // Second accept (should fail with 409)
            const res2 = await request(app)
                .post('/api/invitations/accept')
                .send({
                    token: raceInvitationToken,
                    email: 'racetest@test.com',
                    firstName: 'Race',
                    lastName: 'Test',
                    password: 'password123'
                });
            expect(res2.statusCode).toBe(409);
        });
    });
});
