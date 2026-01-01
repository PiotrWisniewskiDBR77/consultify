/**
 * ReportTemplateService Tests
 * 
 * Tests for report template management service.
 */

const { initTestDb, cleanTables, dbAll, dbRun } = require('../../helpers/dbHelper.cjs');
const ReportTemplateService = require('../../../server/services/reportTemplateService');
const { v4: uuidv4 } = require('uuid');

describe('ReportTemplateService', () => {
    let testOrgId;
    let testUserId;
    let testTemplateId;

    beforeAll(async () => {
        await initTestDb();
    });

    beforeEach(async () => {
        // Create test organization
        testOrgId = uuidv4();
        await dbRun(
            `INSERT INTO organizations (id, name, plan, status, organization_type) 
             VALUES (?, ?, ?, ?, ?)`,
            [testOrgId, 'Test Org', 'professional', 'active', 'PAID']
        );

        // Create test user
        testUserId = uuidv4();
        await dbRun(
            `INSERT INTO users (id, organization_id, email, name, role, created_at) 
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
            [testUserId, testOrgId, 'user@test.com', 'Test User', 'client']
        );

        // Create test template
        testTemplateId = uuidv4();
        await dbRun(
            `INSERT INTO management_report_templates 
             (id, organization_id, name, description, report_type, scope, sections, is_active, is_default, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [
                testTemplateId,
                testOrgId,
                'Test Template',
                'Test description',
                'STEERING_COMMITTEE',
                'PROJECT',
                JSON.stringify([{ type: 'summary', title: 'Summary' }]),
                1,
                0,
                testUserId
            ]
        );
    });

    afterEach(async () => {
        await cleanTables([
            'management_report_templates',
            'users',
            'organizations'
        ]);
    });

    describe('getTemplates', () => {
        it('should return templates for organization', async () => {
            const templates = await ReportTemplateService.getTemplates(testOrgId);

            expect(Array.isArray(templates)).toBe(true);
            expect(templates.length).toBeGreaterThanOrEqual(1);
        });

        it('should include system templates', async () => {
            // Create system template
            const systemTemplateId = uuidv4();
            await dbRun(
                `INSERT INTO management_report_templates 
                 (id, organization_id, name, report_type, is_active, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [systemTemplateId, 'system', 'System Template', 'TEAM_MEETING', 1]
            );

            const templates = await ReportTemplateService.getTemplates(testOrgId);

            expect(templates.some(t => t.isSystem === true)).toBe(true);
        });

        it('should order by default first, then name', async () => {
            // Create default template
            const defaultTemplateId = uuidv4();
            await dbRun(
                `INSERT INTO management_report_templates 
                 (id, organization_id, name, report_type, is_active, is_default, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [defaultTemplateId, testOrgId, 'Default Template', 'STEERING_COMMITTEE', 1, 1]
            );

            const templates = await ReportTemplateService.getTemplates(testOrgId);

            const defaultIndex = templates.findIndex(t => t.isDefault);
            const nonDefaultIndex = templates.findIndex(t => !t.isDefault && t.id !== defaultTemplateId);
            
            if (defaultIndex >= 0 && nonDefaultIndex >= 0) {
                expect(defaultIndex).toBeLessThan(nonDefaultIndex);
            }
        });

        it('should only return active templates', async () => {
            // Create inactive template
            const inactiveTemplateId = uuidv4();
            await dbRun(
                `INSERT INTO management_report_templates 
                 (id, organization_id, name, report_type, is_active, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [inactiveTemplateId, testOrgId, 'Inactive Template', 'TEAM_MEETING', 0]
            );

            const templates = await ReportTemplateService.getTemplates(testOrgId);

            expect(templates.every(t => t.isActive === true)).toBe(true);
        });
    });

    describe('getTemplate', () => {
        it('should return template by ID', async () => {
            const template = await ReportTemplateService.getTemplate(testTemplateId);

            expect(template).toBeDefined();
            expect(template.id).toBe(testTemplateId);
            expect(template.name).toBe('Test Template');
        });

        it('should parse sections JSON', async () => {
            const template = await ReportTemplateService.getTemplate(testTemplateId);

            expect(Array.isArray(template.sections)).toBe(true);
            expect(template.sections[0].type).toBe('summary');
        });

        it('should return null for non-existent template', async () => {
            const template = await ReportTemplateService.getTemplate(uuidv4());

            expect(template).toBeNull();
        });
    });

    describe('createTemplate', () => {
        it('should create new template', async () => {
            const templateData = {
                name: 'New Template',
                description: 'New description',
                reportType: 'TEAM_MEETING',
                scope: 'PROJECT',
                sections: [{ type: 'summary', title: 'Summary' }]
            };

            const template = await ReportTemplateService.createTemplate(
                testOrgId,
                templateData,
                testUserId
            );

            expect(template).toBeDefined();
            expect(template.name).toBe('New Template');
            expect(template.organizationId).toBe(testOrgId);
            expect(template.createdBy).toBe(testUserId);
        });

        it('should set default values correctly', async () => {
            const templateData = {
                name: 'Default Template',
                reportType: 'STEERING_COMMITTEE',
                scope: 'PROJECT'
            };

            const template = await ReportTemplateService.createTemplate(
                testOrgId,
                templateData,
                testUserId
            );

            expect(template.isDefault).toBe(false);
            expect(template.isActive).toBe(true);
        });
    });

    describe('updateTemplate', () => {
        it('should update existing template', async () => {
            const updates = {
                name: 'Updated Template',
                description: 'Updated description'
            };

            const template = await ReportTemplateService.updateTemplate(
                testTemplateId,
                updates,
                testUserId
            );

            expect(template.name).toBe('Updated Template');
            expect(template.description).toBe('Updated description');
        });

        it('should update sections', async () => {
            const newSections = [
                { type: 'summary', title: 'Summary' },
                { type: 'risks', title: 'Risks' }
            ];

            const template = await ReportTemplateService.updateTemplate(
                testTemplateId,
                { sections: newSections },
                testUserId
            );

            expect(template.sections).toHaveLength(2);
            expect(template.sections[1].type).toBe('risks');
        });
    });

    describe('deleteTemplate', () => {
        it('should soft delete template', async () => {
            await ReportTemplateService.deleteTemplate(testTemplateId, testUserId);

            const template = await ReportTemplateService.getTemplate(testTemplateId);
            expect(template.isActive).toBe(false);
        });

        it('should not delete system templates', async () => {
            const systemTemplateId = uuidv4();
            await dbRun(
                `INSERT INTO management_report_templates 
                 (id, organization_id, name, report_type, is_active, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [systemTemplateId, 'system', 'System Template', 'TEAM_MEETING', 1]
            );

            await expect(
                ReportTemplateService.deleteTemplate(systemTemplateId, testUserId)
            ).rejects.toThrow();
        });
    });
});


