/**
 * RegulatoryModeGuard Tests
 * 
 * Tests for regulatory mode enforcement service.
 */

const { initTestDb, cleanTables, dbAll, dbRun, createTestOrg } = require('../../helpers/dbHelper.cjs');
const RegulatoryModeGuard = require('../../../server/services/regulatoryModeGuard');
const { v4: uuidv4 } = require('uuid');

describe('RegulatoryModeGuard', () => {
    let testProjectId;
    let testOrgId;

    beforeAll(async () => {
        await initTestDb();
    });

    beforeEach(async () => {
        testOrgId = uuidv4();
        testProjectId = uuidv4();
        // Create organization before projects (FOREIGN KEY constraint)
        await createTestOrg(testOrgId, 'Test Org');
    });

    afterEach(async () => {
        await cleanTables(['projects', 'organizations']);
    });

    describe('isEnabled', () => {
        it('should return false when no project ID', async () => {
            const enabled = await RegulatoryModeGuard.isEnabled(null);

            expect(enabled).toBe(false);
        });

        it('should return true when regulatory mode enabled', async () => {
            await dbRun(
                `INSERT INTO projects (id, name, organization_id, regulatory_mode_enabled, created_at)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [testProjectId, 'Test Project', testOrgId, 1]
            );

            const enabled = await RegulatoryModeGuard.isEnabled(testProjectId);

            expect(enabled).toBe(true);
        });

        it('should return false when regulatory mode disabled', async () => {
            await dbRun(
                `INSERT INTO projects (id, name, organization_id, regulatory_mode_enabled, created_at)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [testProjectId, 'Test Project', testOrgId, 0]
            );

            const enabled = await RegulatoryModeGuard.isEnabled(testProjectId);

            expect(enabled).toBe(false);
        });

        it('should default to enabled when column is null', async () => {
            await dbRun(
                `INSERT INTO projects (id, name, organization_id, created_at)
                 VALUES (?, ?, ?, datetime('now'))`,
                [testProjectId, 'Test Project', testOrgId]
            );

            const enabled = await RegulatoryModeGuard.isEnabled(testProjectId);

            expect(enabled).toBe(true); // Fail-safe default
        });
    });

    describe('canPerformAction', () => {
        it('should allow EXPLAIN_CONTEXT in regulatory mode', async () => {
            // Create a project with regulatory mode enabled
            await dbRun(
                `INSERT INTO projects (id, name, organization_id, regulatory_mode_enabled, created_at)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [testProjectId, 'Test Project', testOrgId, 1]
            );

            const canPerform = await RegulatoryModeGuard.canPerformAction(
                testProjectId,
                'EXPLAIN_CONTEXT'
            );

            expect(canPerform).toBe(true);
        });

        it('should block CREATE_DRAFT_TASK in regulatory mode', async () => {
            // Create a project with regulatory mode enabled
            await dbRun(
                `INSERT INTO projects (id, name, organization_id, regulatory_mode_enabled, created_at)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [testProjectId, 'Test Project', testOrgId, 1]
            );

            const canPerform = await RegulatoryModeGuard.canPerformAction(
                testProjectId,
                'CREATE_DRAFT_TASK'
            );

            expect(canPerform).toBe(false);
        });

        it('should allow all actions when regulatory mode disabled', async () => {
            // Create a project with regulatory mode disabled
            await dbRun(
                `INSERT INTO projects (id, name, organization_id, regulatory_mode_enabled, created_at)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [testProjectId, 'Test Project', testOrgId, 0]
            );

            const canPerform = await RegulatoryModeGuard.canPerformAction(
                testProjectId,
                'CREATE_DRAFT_TASK'
            );

            expect(canPerform).toBe(true);
        });

        it('should allow all allowed actions', async () => {
            // Create a project with regulatory mode enabled
            await dbRun(
                `INSERT INTO projects (id, name, organization_id, regulatory_mode_enabled, created_at)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [testProjectId, 'Test Project', testOrgId, 1]
            );

            for (const action of RegulatoryModeGuard.ALLOWED_ACTIONS) {
                const canPerform = await RegulatoryModeGuard.canPerformAction(testProjectId, action);
                expect(canPerform).toBe(true);
            }
        });

        it('should block all blocked actions', async () => {
            // Create a project with regulatory mode enabled
            await dbRun(
                `INSERT INTO projects (id, name, organization_id, regulatory_mode_enabled, created_at)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [testProjectId, 'Test Project', testOrgId, 1]
            );

            for (const action of RegulatoryModeGuard.BLOCKED_ACTIONS) {
                const canPerform = await RegulatoryModeGuard.canPerformAction(testProjectId, action);
                expect(canPerform).toBe(false);
            }
        });
    });

    describe('filterPrompt', () => {
        it('should remove forbidden verbs from prompt', () => {
            const prompt = 'Create a new task and execute it';
            const filtered = RegulatoryModeGuard.filterPrompt(prompt);

            expect(filtered).not.toContain('create');
            expect(filtered).not.toContain('execute');
            expect(filtered).toContain('[RESTRICTED]');
        });

        it('should replace forbidden verbs with [RESTRICTED]', () => {
            const prompt = 'Create a new task';
            const filtered = RegulatoryModeGuard.filterPrompt(prompt);

            // filterPrompt always filters - it doesn't check regulatory mode
            // It replaces forbidden verbs with [RESTRICTED]
            expect(filtered).toContain('[RESTRICTED]');
        });

        it('should not modify prompt without forbidden verbs', () => {
            const prompt = 'Analyze the current situation';
            const filtered = RegulatoryModeGuard.filterPrompt(prompt);

            // No forbidden verbs, so should remain unchanged
            expect(filtered).toBe(prompt);
        });
    });

    describe('setEnabled', () => {
        it('should enable regulatory mode for project', async () => {
            await dbRun(
                `INSERT INTO projects (id, name, organization_id, created_at)
                 VALUES (?, ?, ?, datetime('now'))`,
                [testProjectId, 'Test Project', testOrgId]
            );

            await RegulatoryModeGuard.setEnabled(testProjectId, true);

            const enabled = await RegulatoryModeGuard.isEnabled(testProjectId);
            expect(enabled).toBe(true);
        });

        it('should disable regulatory mode for project', async () => {
            await dbRun(
                `INSERT INTO projects (id, name, organization_id, regulatory_mode_enabled, created_at)
                 VALUES (?, ?, ?, ?, datetime('now'))`,
                [testProjectId, 'Test Project', testOrgId, 1]
            );

            await RegulatoryModeGuard.setEnabled(testProjectId, false);

            const enabled = await RegulatoryModeGuard.isEnabled(testProjectId);
            expect(enabled).toBe(false);
        });
    });
});
