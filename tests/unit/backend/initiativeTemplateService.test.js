import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

// Import the service (TS source)
import InitiativeTemplateService from '../../../server/src/services/initiativeTemplateService.ts';

// Helper to mock DbPromise calls since the service uses helper methods
import DbPromise from '../../../server/src/utils/DbPromise.ts';

// We mock usage of DbPromise methods in the service
vi.mock('../../../server/src/utils/DbPromise.ts', () => ({
    default: {
        all: vi.fn(),
        get: vi.fn(),
        run: vi.fn(),
        transaction: vi.fn()
    }
}));

describe('InitiativeTemplateService', () => {
    let mocks;
    const testUserId = 'user-123';
    const testOrgId = 'org-123';

    beforeEach(() => {
        mocks = setupStandardTest();
        vi.clearAllMocks();

        // Set dependencies using unified pattern
        InitiativeTemplateService.setDependencies({ db: mocks.db });

        // Default mock responses
        vi.mocked(DbPromise.all).mockResolvedValue([]);
        vi.mocked(DbPromise.get).mockResolvedValue(null);
        vi.mocked(DbPromise.run).mockResolvedValue({ changes: 1, lastID: 1, success: true });
    });

    describe('getTemplates', () => {
        it('should return all public templates when no filters', async () => {
            const mockTemplates = [
                { id: 't1', name: 'T1', category: 'cat1', template_data: '{}', is_public: 1 }
            ];
            vi.mocked(DbPromise.all).mockResolvedValue(mockTemplates);

            const templates = await InitiativeTemplateService.getTemplates();

            expect(templates).toHaveLength(1);
            expect(templates[0].id).toBe('t1');
            expect(DbPromise.all).toHaveBeenCalled();
        });

        it('should filter by category', async () => {
            await InitiativeTemplateService.getTemplates({
                category: 'digital_transformation'
            });

            const [dbInstance, sql, params] = vi.mocked(DbPromise.all).mock.lastCall;
            expect(sql).toContain('category = ?');
            expect(params).toContain('digital_transformation');
        });

        it('should filter by organization', async () => {
            await InitiativeTemplateService.getTemplates({
                organizationId: testOrgId
            });

            const [dbInstance, sql, params] = vi.mocked(DbPromise.all).mock.lastCall;
            expect(sql).toContain('organization_id = ?');
            expect(params).toContain(testOrgId);
        });

        it('should include public templates when includePublic is true', async () => {
            await InitiativeTemplateService.getTemplates({
                organizationId: testOrgId,
                includePublic: true
            });

            const [dbInstance, sql, params] = vi.mocked(DbPromise.all).mock.lastCall;
            expect(sql).toContain('(organization_id = ? OR is_public = 1)');
        });
    });

    describe('getTemplateById', () => {
        it('should return template by ID', async () => {
            const mockTemplate = {
                id: 't1',
                name: 'Test Template',
                template_data: '{"problemStructured": "Problem"}'
            };
            vi.mocked(DbPromise.get).mockResolvedValue(mockTemplate);

            const template = await InitiativeTemplateService.getTemplateById('t1');

            expect(template).toBeDefined();
            expect(template.id).toBe('t1');
            expect(template.name).toBe('Test Template');
            expect(template.problemStructured).toBe('Problem');
        });

        it('should return null for non-existent template', async () => {
            vi.mocked(DbPromise.get).mockResolvedValue(null);
            const template = await InitiativeTemplateService.getTemplateById('non-existent');
            expect(template).toBeNull();
        });
    });

    describe('createTemplate', () => {
        it('should create new template', async () => {
            const templateData = {
                name: 'New Template',
                category: 'process_improvement',
                description: 'New template description',
                applicableAxes: ['1A']
            };

            const template = await InitiativeTemplateService.createTemplate(
                templateData,
                testUserId
            );

            expect(template).toBeDefined();
            expect(template.name).toBe('New Template');
            expect(template.createdBy).toBe(testUserId);

            expect(DbPromise.run).toHaveBeenCalled();
            const [dbInstance, sql, params] = vi.mocked(DbPromise.run).mock.lastCall;
            expect(sql).toContain('INSERT INTO');
            expect(params[1]).toBe('New Template'); // Name is 2nd param
        });
    });

    describe('updateTemplate', () => {
        it('should update existing template', async () => {
            // Setup existing
            vi.mocked(DbPromise.get).mockResolvedValue({
                id: 't1',
                name: 'Old Name',
                template_data: '{}'
            });

            const updates = {
                name: 'Updated Template'
            };

            const template = await InitiativeTemplateService.updateTemplate(
                't1',
                updates,
                testUserId
            );

            expect(template.name).toBe('Updated Template');

            expect(DbPromise.run).toHaveBeenCalled();
            const [dbInstance, sql, params] = vi.mocked(DbPromise.run).mock.lastCall;
            expect(sql).toContain('UPDATE');
        });

        it('should reject update for non-existent template', async () => {
            vi.mocked(DbPromise.get).mockResolvedValue(null);

            await expect(
                InitiativeTemplateService.updateTemplate(
                    'non-existent',
                    { name: 'Updated' },
                    testUserId
                )
            ).rejects.toThrow('Template not found');
        });
    });

    describe('deleteTemplate', () => {
        it('should delete template', async () => {
            vi.mocked(DbPromise.run).mockResolvedValue({ changes: 1, success: true });

            const result = await InitiativeTemplateService.deleteTemplate('t1', testUserId);
            expect(result).toBe(true);
        });

        it('should return false for delete of non-existent template', async () => {
            vi.mocked(DbPromise.run).mockResolvedValue({ changes: 0, success: true });

            const result = await InitiativeTemplateService.deleteTemplate('non-existent', testUserId);
            expect(result).toBe(false);
        });
    });
});











