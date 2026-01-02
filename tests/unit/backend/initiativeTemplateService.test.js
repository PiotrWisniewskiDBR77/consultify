/**
 * InitiativeTemplateService Tests
 * 
 * Tests for initiative template CRUD operations.
 */

const { initTestDb, cleanTables, dbAll, dbRun } = require('../../helpers/dbHelper.cjs');
const InitiativeTemplateService = require('../../../server/services/initiativeTemplateService');
const { v4: uuidv4 } = require('uuid');

describe('InitiativeTemplateService', () => {
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
            `INSERT INTO initiative_templates 
             (id, name, category, description, applicable_axes, template_data, is_public, organization_id, created_by, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [
                testTemplateId,
                'Test Template',
                'digital_transformation',
                'Test description',
                '["1A","2B"]',
                JSON.stringify({ problemStructured: 'Test problem' }),
                1,
                testOrgId,
                testUserId
            ]
        );
    });

    afterEach(async () => {
        await cleanTables([
            'initiative_templates',
            'users',
            'organizations'
        ]);
    });

    describe('getTemplates', () => {
        it('should return all public templates when no filters', async () => {
            const templates = await InitiativeTemplateService.getTemplates();

            expect(Array.isArray(templates)).toBe(true);
            expect(templates.length).toBeGreaterThanOrEqual(1);
        });

        it('should filter by category', async () => {
            const templates = await InitiativeTemplateService.getTemplates({
                category: 'digital_transformation'
            });

            expect(templates.every(t => t.category === 'digital_transformation')).toBe(true);
        });

        it('should filter by organization', async () => {
            const templates = await InitiativeTemplateService.getTemplates({
                organizationId: testOrgId
            });

            expect(templates.some(t => t.organizationId === testOrgId)).toBe(true);
        });

        it('should include public templates when includePublic is true', async () => {
            const templates = await InitiativeTemplateService.getTemplates({
                organizationId: testOrgId,
                includePublic: true
            });

            expect(templates.length).toBeGreaterThanOrEqual(1);
        });

        it('should exclude public templates when includePublic is false', async () => {
            const templates = await InitiativeTemplateService.getTemplates({
                organizationId: testOrgId,
                includePublic: false
            });

            expect(templates.every(t => t.organizationId === testOrgId)).toBe(true);
        });
    });

    describe('getTemplateById', () => {
        it('should return template by ID', async () => {
            const template = await InitiativeTemplateService.getTemplateById(testTemplateId);

            expect(template).toBeDefined();
            expect(template.id).toBe(testTemplateId);
            expect(template.name).toBe('Test Template');
        });

        it('should return null for non-existent template', async () => {
            const template = await InitiativeTemplateService.getTemplateById(uuidv4());

            expect(template).toBeNull();
        });
    });

    describe('createTemplate', () => {
        it('should create new template', async () => {
            const templateData = {
                name: 'New Template',
                category: 'process_improvement',
                description: 'New template description',
                applicableAxes: ['1A'],
                templateData: {
                    problemStructured: 'Problem',
                    targetState: 'Target',
                    killCriteria: ['Criteria 1']
                }
            };

            const template = await InitiativeTemplateService.createTemplate(
                templateData,
                testUserId
            );

            expect(template).toBeDefined();
            expect(template.name).toBe('New Template');
            expect(template.category).toBe('process_improvement');
            expect(template.createdBy).toBe(testUserId);
        });

        it('should use provided ID when given', async () => {
            const customId = uuidv4();
            const templateData = {
                id: customId,
                name: 'Custom ID Template',
                category: 'test'
            };

            const template = await InitiativeTemplateService.createTemplate(
                templateData,
                testUserId
            );

            expect(template.id).toBe(customId);
        });

        it('should parse template data correctly', async () => {
            const templateData = {
                name: 'Data Template',
                category: 'test',
                problemStructured: 'Problem',
                suggestedTasks: ['Task 1', 'Task 2'],
                suggestedRoles: ['Role 1']
            };

            const template = await InitiativeTemplateService.createTemplate(
                templateData,
                testUserId
            );

            expect(template.suggestedTasks).toEqual(['Task 1', 'Task 2']);
        });
    });

    describe('updateTemplate', () => {
        it('should update existing template', async () => {
            const updates = {
                name: 'Updated Template',
                description: 'Updated description'
            };

            const template = await InitiativeTemplateService.updateTemplate(
                testTemplateId,
                updates,
                testUserId
            );

            expect(template.name).toBe('Updated Template');
            expect(template.description).toBe('Updated description');
        });

        it('should reject update for non-existent template', async () => {
            await expect(
                InitiativeTemplateService.updateTemplate(
                    uuidv4(),
                    { name: 'Updated' },
                    testUserId
                )
            ).rejects.toThrow();
        });
    });

    describe('deleteTemplate', () => {
        it('should delete template', async () => {
            const result = await InitiativeTemplateService.deleteTemplate(testTemplateId, testUserId);
            expect(result).toBe(true);

            const template = await InitiativeTemplateService.getTemplateById(testTemplateId);
            expect(template).toBeNull();
        });

        it('should return false for delete of non-existent template', async () => {
            const result = await InitiativeTemplateService.deleteTemplate(uuidv4(), testUserId);
            expect(result).toBe(false);
        });
    });
});



