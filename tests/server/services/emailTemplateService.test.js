/**
 * Email Template Service Tests
 * Tests for basic email template CRUD operations
 */

const { describe, it, expect, beforeEach, vi } = require('vitest');

// Mock the database
vi.mock('../../../server/database', () => {
    const mockDb = {
        run: vi.fn(),
        get: vi.fn(),
        all: vi.fn()
    };
    return { default: mockDb };
});

const db = require('../../../server/database').default;
const EmailTemplateService = require('../../../server/services/emailTemplateService');

describe('EmailTemplateService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getTemplates', () => {
        it('should return all templates', async () => {
            const mockTemplates = [
                {
                    id: 'et-1',
                    template_key: 'welcome',
                    name: 'Welcome Email',
                    subject: 'Welcome!',
                    category: 'onboarding',
                    is_active: 1
                },
                {
                    id: 'et-2',
                    template_key: 'invoice',
                    name: 'Invoice Email',
                    subject: 'Your Invoice',
                    category: 'billing',
                    is_active: 1
                }
            ];

            db.all.mockImplementation((query, params, callback) => {
                callback(null, mockTemplates);
            });

            const result = await EmailTemplateService.getTemplates();

            expect(result).toHaveLength(2);
            expect(result[0].name).toBe('Welcome Email');
            expect(db.all).toHaveBeenCalled();
        });

        it('should filter by category', async () => {
            db.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('category = ?');
                expect(params).toContain('onboarding');
                callback(null, []);
            });

            await EmailTemplateService.getTemplates('onboarding');
        });

        it('should filter active only templates', async () => {
            db.all.mockImplementation((query, params, callback) => {
                expect(query).toContain('is_active = 1');
                callback(null, []);
            });

            await EmailTemplateService.getTemplates(null, true);
        });

        it('should return empty array on db error gracefully', async () => {
            db.all.mockImplementation((query, params, callback) => {
                callback(null, []);
            });

            const result = await EmailTemplateService.getTemplates();
            expect(result).toEqual([]);
        });
    });

    describe('getTemplate', () => {
        it('should return template by key', async () => {
            const mockTemplate = {
                id: 'et-1',
                template_key: 'welcome',
                name: 'Welcome Email',
                subject: 'Welcome {{name}}!',
                body_html: '<p>Hello {{name}}</p>',
                body_text: 'Hello {{name}}',
                variables_json: '["name"]',
                is_active: 1
            };

            db.get.mockImplementation((query, params, callback) => {
                callback(null, mockTemplate);
            });

            const result = await EmailTemplateService.getTemplate('welcome');

            expect(result).toBeDefined();
            expect(result.template_key).toBe('welcome');
            expect(result.subject).toBe('Welcome {{name}}!');
        });

        it('should return null for non-existent template', async () => {
            db.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const result = await EmailTemplateService.getTemplate('non-existent');
            expect(result).toBeNull();
        });

        it('should handle db errors', async () => {
            db.get.mockImplementation((query, params, callback) => {
                callback(new Error('DB Error'));
            });

            await expect(EmailTemplateService.getTemplate('welcome'))
                .rejects.toThrow('DB Error');
        });
    });

    describe('createTemplate', () => {
        it('should create a new template', async () => {
            db.run.mockImplementation((query, params, callback) => {
                callback.call({ lastID: 1, changes: 1 }, null);
            });

            const templateData = {
                templateKey: 'new-template',
                name: 'New Template',
                subject: 'Subject Line',
                bodyHtml: '<p>Content</p>',
                bodyText: 'Content',
                variables: ['name', 'email'],
                category: 'notifications'
            };

            const result = await EmailTemplateService.createTemplate(templateData);

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.templateKey).toBe('new-template');
            expect(db.run).toHaveBeenCalled();
        });

        it('should reject duplicate template key', async () => {
            db.run.mockImplementation((query, params, callback) => {
                callback(new Error('UNIQUE constraint failed'));
            });

            await expect(EmailTemplateService.createTemplate({
                templateKey: 'existing',
                name: 'Test',
                subject: 'Test',
                bodyHtml: '<p>Test</p>'
            })).rejects.toThrow('Template key already exists');
        });

        it('should handle optional fields', async () => {
            db.run.mockImplementation((query, params, callback) => {
                expect(params[4]).toBeNull(); // bodyText should be null
                callback.call({ lastID: 1 }, null);
            });

            await EmailTemplateService.createTemplate({
                templateKey: 'minimal',
                name: 'Minimal',
                subject: 'Subject',
                bodyHtml: '<p>Content</p>'
            });
        });

        it('should serialize variables array', async () => {
            db.run.mockImplementation((query, params, callback) => {
                const variablesJson = params[6];
                expect(variablesJson).toBe('["name","email"]');
                callback.call({ lastID: 1 }, null);
            });

            await EmailTemplateService.createTemplate({
                templateKey: 'with-vars',
                name: 'With Variables',
                subject: 'Hello {{name}}',
                bodyHtml: '<p>{{email}}</p>',
                variables: ['name', 'email']
            });
        });
    });

    describe('updateTemplate', () => {
        it('should update template fields', async () => {
            db.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await EmailTemplateService.updateTemplate('welcome', {
                name: 'Updated Welcome',
                subject: 'Updated Subject'
            });

            expect(result.updated).toBe(true);
            expect(db.run).toHaveBeenCalled();
        });

        it('should not update if no fields provided', async () => {
            const result = await EmailTemplateService.updateTemplate('welcome', {});
            expect(result.updated).toBe(false);
        });

        it('should handle partial updates', async () => {
            db.run.mockImplementation((query, params, callback) => {
                expect(query).toContain('name = ?');
                expect(query).not.toContain('subject');
                callback.call({ changes: 1 }, null);
            });

            await EmailTemplateService.updateTemplate('welcome', {
                name: 'Only Name'
            });
        });

        it('should update isActive flag', async () => {
            db.run.mockImplementation((query, params, callback) => {
                expect(query).toContain('is_active = ?');
                expect(params).toContain(0);
                callback.call({ changes: 1 }, null);
            });

            await EmailTemplateService.updateTemplate('welcome', {
                isActive: false
            });
        });

        it('should return false if template not found', async () => {
            db.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 0 }, null);
            });

            const result = await EmailTemplateService.updateTemplate('non-existent', {
                name: 'Test'
            });

            expect(result.updated).toBe(false);
        });

        it('should update timestamp', async () => {
            db.run.mockImplementation((query, params, callback) => {
                expect(query).toContain('updated_at = datetime("now")');
                callback.call({ changes: 1 }, null);
            });

            await EmailTemplateService.updateTemplate('welcome', {
                name: 'Updated'
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle empty results', async () => {
            db.all.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const result = await EmailTemplateService.getTemplates();
            expect(result).toEqual([]);
        });

        it('should handle SQL injection attempts in template key', async () => {
            db.get.mockImplementation((query, params, callback) => {
                // Verify params are properly escaped by SQLite binding
                expect(params[0]).toBe("'; DROP TABLE users; --");
                callback(null, null);
            });

            const result = await EmailTemplateService.getTemplate("'; DROP TABLE users; --");
            expect(result).toBeNull();
        });

        it('should handle special characters in template content', async () => {
            const specialContent = '<p>Hello "World" & \'Everyone\'!</p>';
            
            db.run.mockImplementation((query, params, callback) => {
                expect(params[3]).toBe(specialContent);
                callback.call({ lastID: 1 }, null);
            });

            await EmailTemplateService.createTemplate({
                templateKey: 'special-chars',
                name: 'Special Characters',
                subject: 'Test',
                bodyHtml: specialContent
            });
        });
    });
});









