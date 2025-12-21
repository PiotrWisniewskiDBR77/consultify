/**
 * AI Analytics Integration Tests
 * Step 18: Outcomes, ROI & Continuous Learning Loop
 * 
 * Tests for AI analytics endpoints with org isolation and proper authentication.
 */

const request = require('supertest');
const app = require('../../server/index');
const db = require('../../server/database');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');

describe('AI Analytics Routes', () => {
    let authToken;
    let testOrgId;
    let testUserId;
    let otherOrgId;
    let otherUserId;
    let otherAuthToken;

    beforeAll(async () => {
        // Wait for DB initialization
        await db.initPromise;

        // Create test organization
        testOrgId = `org-test-analytics-${uuidv4().slice(0, 8)}`;
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
                [testOrgId, 'Analytics Test Org', 'enterprise', 'active'],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Create test user
        testUserId = `user-test-analytics-${uuidv4().slice(0, 8)}`;
        const hashedPassword = bcrypt.hashSync('testpass123', 8);
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [testUserId, testOrgId, 'analytics-test@example.com', hashedPassword, 'Test', 'User', 'ADMIN'],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Create another org for isolation tests
        otherOrgId = `org-other-analytics-${uuidv4().slice(0, 8)}`;
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)`,
                [otherOrgId, 'Other Analytics Org', 'pro', 'active'],
                (err) => err ? reject(err) : resolve()
            );
        });

        otherUserId = `user-other-analytics-${uuidv4().slice(0, 8)}`;
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [otherUserId, otherOrgId, 'other-analytics@example.com', hashedPassword, 'Other', 'User', 'ADMIN'],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Login to get auth token
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'analytics-test@example.com', password: 'testpass123' });
        authToken = loginRes.body.token;

        const otherLoginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'other-analytics@example.com', password: 'testpass123' });
        otherAuthToken = otherLoginRes.body.token;

        // Seed some test data for testOrg
        await seedTestData(testOrgId);
    });

    afterAll(async () => {
        // Cleanup test data
        await cleanup(testOrgId, testUserId);
        await cleanup(otherOrgId, otherUserId);
    });

    async function seedTestData(orgId) {
        // Seed action executions
        for (let i = 0; i < 5; i++) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO action_executions (id, decision_id, proposal_id, action_type, organization_id, correlation_id, status, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                    [`exec-${uuidv4()}`, `dec-${uuidv4()}`, `prop-${uuidv4()}`, 'TASK_CREATE', orgId, `corr-${uuidv4()}`, i < 4 ? 'SUCCESS' : 'FAILED'],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }

        // Seed action decisions (mix of manual and auto)
        for (let i = 0; i < 6; i++) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO action_decisions (id, proposal_id, organization_id, decision, decided_by_user_id, action_type, scope, policy_rule_id, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                    [
                        `adec-${uuidv4()}`,
                        `prop-${uuidv4()}`,
                        orgId,
                        i < 5 ? 'APPROVED' : 'REJECTED',
                        i % 2 === 0 ? 'SYSTEM_POLICY_ENGINE' : testUserId,
                        'TASK_CREATE',
                        'USER',
                        i % 2 === 0 ? `policy-${uuidv4()}` : null
                    ],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }

        // Seed playbook template
        const templateId = `tmpl-${uuidv4()}`;
        await new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO ai_playbook_templates (id, key, title, description, is_active)
                 VALUES (?, ?, ?, ?, 1)`,
                [templateId, 'test_playbook', 'Test Playbook', 'A test playbook'],
                (err) => err ? reject(err) : resolve()
            );
        });

        // Seed playbook runs
        for (let i = 0; i < 3; i++) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO ai_playbook_runs (id, template_id, organization_id, correlation_id, initiated_by, status, started_at, completed_at, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-1 hour'), ?, datetime('now'))`,
                    [
                        `run-${uuidv4()}`,
                        templateId,
                        orgId,
                        `corr-${uuidv4()}`,
                        'SYSTEM',
                        i < 2 ? 'COMPLETED' : 'FAILED',
                        i < 2 ? new Date().toISOString() : null
                    ],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }

        // Seed async jobs (some dead-letter)
        for (let i = 0; i < 10; i++) {
            await new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO async_jobs (id, type, organization_id, correlation_id, entity_id, status, created_at)
                     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
                    [
                        `job-${uuidv4()}`,
                        'EXECUTE_DECISION',
                        orgId,
                        `corr-${uuidv4()}`,
                        `entity-${uuidv4()}`,
                        i < 8 ? 'SUCCESS' : (i < 9 ? 'FAILED' : 'DEAD_LETTER')
                    ],
                    (err) => err ? reject(err) : resolve()
                );
            });
        }
    }

    async function cleanup(orgId, userId) {
        const tables = [
            'action_executions', 'action_decisions', 'ai_playbook_runs',
            'async_jobs', 'outcome_measurements', 'outcome_definitions', 'roi_models'
        ];

        for (const table of tables) {
            await new Promise((resolve) => {
                db.run(`DELETE FROM ${table} WHERE organization_id = ?`, [orgId], () => resolve());
            });
        }

        await new Promise((resolve) => {
            db.run(`DELETE FROM ai_playbook_templates WHERE key = 'test_playbook'`, [], () => resolve());
        });

        await new Promise((resolve) => {
            db.run(`DELETE FROM users WHERE id = ?`, [userId], () => resolve());
        });

        await new Promise((resolve) => {
            db.run(`DELETE FROM organizations WHERE id = ?`, [orgId], () => resolve());
        });
    }

    // ==========================================
    // DASHBOARD ENDPOINT TESTS
    // ==========================================

    describe('GET /api/analytics/ai/dashboard', () => {
        it('should return dashboard summary with all sections', async () => {
            const res = await request(app)
                .get('/api/analytics/ai/dashboard')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('actions');
            expect(res.body).toHaveProperty('approvals');
            expect(res.body).toHaveProperty('playbooks');
            expect(res.body).toHaveProperty('deadLetter');
            expect(res.body).toHaveProperty('timeToResolution');
            expect(res.body).toHaveProperty('roi');
        });

        it('should require authentication', async () => {
            await request(app)
                .get('/api/analytics/ai/dashboard')
                .expect(401);
        });
    });

    // ==========================================
    // ACTION STATS TESTS
    // ==========================================

    describe('GET /api/analytics/ai/actions', () => {
        it('should return action execution statistics', async () => {
            const res = await request(app)
                .get('/api/analytics/ai/actions')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('total_executions');
            expect(res.body).toHaveProperty('success_count');
            expect(res.body).toHaveProperty('failed_count');
            expect(res.body).toHaveProperty('success_rate');
            expect(res.body.total_executions).toBeGreaterThanOrEqual(5);
        });

        it('should respect date range filter', async () => {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

            const res = await request(app)
                .get('/api/analytics/ai/actions')
                .query({ from: yesterday, to: tomorrow })
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body.total_executions).toBeGreaterThanOrEqual(0);
        });
    });

    // ==========================================
    // APPROVAL STATS TESTS
    // ==========================================

    describe('GET /api/analytics/ai/approvals', () => {
        it('should return approval breakdown', async () => {
            const res = await request(app)
                .get('/api/analytics/ai/approvals')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('total_decisions');
            expect(res.body).toHaveProperty('approved');
            expect(res.body).toHaveProperty('rejected');
            expect(res.body).toHaveProperty('auto_approved');
            expect(res.body).toHaveProperty('manual_approved');
            expect(res.body).toHaveProperty('auto_approval_rate');
        });
    });

    // ==========================================
    // PLAYBOOK STATS TESTS
    // ==========================================

    describe('GET /api/analytics/ai/playbooks', () => {
        it('should return playbook completion statistics', async () => {
            const res = await request(app)
                .get('/api/analytics/ai/playbooks')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('total_runs');
            expect(res.body).toHaveProperty('completed');
            expect(res.body).toHaveProperty('failed');
            expect(res.body).toHaveProperty('completion_rate');
            expect(res.body).toHaveProperty('by_playbook');
        });
    });

    // ==========================================
    // DEAD-LETTER STATS TESTS
    // ==========================================

    describe('GET /api/analytics/ai/dead-letter', () => {
        it('should return dead-letter job statistics', async () => {
            const res = await request(app)
                .get('/api/analytics/ai/dead-letter')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('total_jobs');
            expect(res.body).toHaveProperty('dead_letter_count');
            expect(res.body).toHaveProperty('dead_letter_rate');
        });
    });

    // ==========================================
    // ROI ENDPOINT TESTS
    // ==========================================

    describe('GET /api/analytics/roi', () => {
        it('should return ROI summary', async () => {
            const res = await request(app)
                .get('/api/analytics/ai/roi')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('hours_saved');
            expect(res.body).toHaveProperty('cost_saved');
            expect(res.body).toHaveProperty('currency');
        });
    });

    describe('GET /api/analytics/roi/hours-saved', () => {
        it('should return detailed hours saved', async () => {
            const res = await request(app)
                .get('/api/analytics/ai/roi/hours-saved')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('hours_saved');
            expect(res.body).toHaveProperty('minutes_saved');
        });
    });

    describe('GET /api/analytics/roi/cost-reduction', () => {
        it('should return cost reduction estimate', async () => {
            const res = await request(app)
                .get('/api/analytics/ai/roi/cost-reduction')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('cost_saved');
            expect(res.body).toHaveProperty('direct_labor_saved');
        });
    });

    // ==========================================
    // ORGANIZATION ISOLATION TESTS
    // ==========================================

    describe('Organization Isolation', () => {
        it('should not return data from other organizations', async () => {
            // Query with other org's token
            const res = await request(app)
                .get('/api/analytics/ai/actions')
                .set('Authorization', `Bearer ${otherAuthToken}`)
                .expect(200);

            // Other org has no seeded data, should be 0
            expect(res.body.total_executions).toBe(0);
        });

        it('should isolate playbook stats by org', async () => {
            const res = await request(app)
                .get('/api/analytics/ai/playbooks')
                .set('Authorization', `Bearer ${otherAuthToken}`)
                .expect(200);

            expect(res.body.total_runs).toBe(0);
        });
    });

    // ==========================================
    // EXPORT TESTS
    // ==========================================

    describe('GET /api/analytics/ai/export', () => {
        it('should export JSON data', async () => {
            const res = await request(app)
                .get('/api/analytics/ai/export')
                .query({ format: 'json' })
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.body).toHaveProperty('exported_at');
            expect(res.body).toHaveProperty('actions');
            expect(res.body).toHaveProperty('roi');
        });

        it('should export CSV data', async () => {
            const res = await request(app)
                .get('/api/analytics/ai/export')
                .query({ format: 'csv' })
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(res.headers['content-type']).toContain('text/csv');
            expect(res.text).toContain('Metric,Value');
        });
    });
});
