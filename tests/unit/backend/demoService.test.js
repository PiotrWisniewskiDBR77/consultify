/**
 * DemoService Tests
 * 
 * Tests for demo organization creation and management.
 */

const { initTestDb, cleanTables, dbAll, dbRun } = require('../../helpers/dbHelper.cjs');
const DemoService = require('../../../server/services/demoService');
const { v4: uuidv4 } = require('uuid');

describe('DemoService', () => {
    beforeAll(async () => {
        await initTestDb();
    });

    afterEach(async () => {
        await cleanTables([
            'organizations',
            'users',
            'access_policy_limits'
        ]);
    });

    describe('createDemoOrganization', () => {
        it('should create demo organization', async () => {
            const result = await DemoService.createDemoOrganization();

            expect(result).toHaveProperty('organizationId');
            expect(result).toHaveProperty('userId');
            expect(result).toHaveProperty('expiresAt');
            expect(result.organizationId).toMatch(/^demo-/);
        });

        it('should create demo organization with email', async () => {
            const email = 'test@example.com';
            const result = await DemoService.createDemoOrganization(null, email);

            expect(result.userId).toBeDefined();

            // Verify user was created with email
            const users = await dbAll(
                'SELECT * FROM users WHERE id = ?',
                [result.userId]
            );
            expect(users[0].email).toBe(email);
        });

        it('should create demo organization with template', async () => {
            // Create a template first
            const templateId = uuidv4();
            await dbRun(
                `INSERT INTO demo_templates (id, name, seed_data_json, created_at)
                 VALUES (?, ?, ?, datetime('now'))`,
                [templateId, 'Test Template', JSON.stringify({ test: 'data' })]
            );

            const result = await DemoService.createDemoOrganization(templateId);

            expect(result.organizationId).toBeDefined();
        });

        it('should set expiration to 24 hours', async () => {
            const result = await DemoService.createDemoOrganization();

            const expiresAt = new Date(result.expiresAt);
            const now = new Date();
            const hoursDiff = (expiresAt - now) / (1000 * 60 * 60);

            expect(hoursDiff).toBeCloseTo(24, 1);
        });

        it('should create organization with DEMO type', async () => {
            const result = await DemoService.createDemoOrganization();

            const orgs = await dbAll(
                'SELECT * FROM organizations WHERE id = ?',
                [result.organizationId]
            );
            expect(orgs[0].organization_type).toBe('DEMO');
        });
    });

    describe('cleanupExpiredDemos', () => {
        it('should remove expired demo organizations', async () => {
            // Create expired demo
            const expiredOrgId = `demo-${uuidv4().split('-')[0]}`;
            const pastDate = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
            await dbRun(
                `INSERT INTO organizations (id, name, plan, status, organization_type, trial_started_at, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [expiredOrgId, 'Expired Demo', 'demo', 'active', 'DEMO', pastDate.toISOString(), pastDate.toISOString()]
            );

            await DemoService.cleanupExpiredDemos();

            const orgs = await dbAll(
                'SELECT * FROM organizations WHERE id = ?',
                [expiredOrgId]
            );
            expect(orgs.length).toBe(0);
        });

        it('should not remove active demo organizations', async () => {
            const result = await DemoService.createDemoOrganization();

            await DemoService.cleanupExpiredDemos();

            const orgs = await dbAll(
                'SELECT * FROM organizations WHERE id = ?',
                [result.organizationId]
            );
            expect(orgs.length).toBe(1);
        });
    });
});

