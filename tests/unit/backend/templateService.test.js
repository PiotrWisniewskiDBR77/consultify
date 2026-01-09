/**
 * Template Service Unit Tests  
 * Tests template management and rendering
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Template service implementation
const createTemplateService = () => {
    const templates = new Map();
    let counter = 0;

    return {
        create: (name, content, options = {}) => {
            const id = `tpl-${Date.now()}-${++counter}`;
            const template = {
                id,
                name,
                content,
                type: options.type || 'html',
                variables: extractVariables(content),
                createdAt: new Date(),
                ...options
            };
            templates.set(id, template);
            return template;
        },

        get: (id) => templates.get(id) || null,

        getByName: (name) => {
            for (const template of templates.values()) {
                if (template.name === name) return template;
            }
            return null;
        },

        list: () => Array.from(templates.values()),

        update: (id, updates) => {
            const template = templates.get(id);
            if (!template) throw new Error('Template not found');
            Object.assign(template, updates);
            if (updates.content) {
                template.variables = extractVariables(updates.content);
            }
            return template;
        },

        delete: (id) => templates.delete(id),

        render: (id, context = {}) => {
            const template = templates.get(id);
            if (!template) throw new Error('Template not found');

            let result = template.content;
            for (const [key, value] of Object.entries(context)) {
                result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
            }
            return result;
        },

        validateVariables: (id, context) => {
            const template = templates.get(id);
            if (!template) throw new Error('Template not found');

            const missing = template.variables.filter(v => !(v in context));
            return {
                valid: missing.length === 0,
                missing
            };
        }
    };
};

function extractVariables(content) {
    const matches = content.match(/\{\{(\w+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/[{}]/g, '')))];
}

describe('TemplateService', () => {
    let templateService;

    beforeEach(() => {
        templateService = createTemplateService();
    });

    describe('Template CRUD', () => {
        it('should create template', () => {
            const template = templateService.create('Welcome Email', '<p>Hello {{name}}</p>');

            expect(template.id).toBeDefined();
            expect(template.name).toBe('Welcome Email');
        });

        it('should get template by ID', () => {
            const created = templateService.create('Test', '<p>Content</p>');
            const retrieved = templateService.get(created.id);

            expect(retrieved.name).toBe('Test');
        });

        it('should get template by name', () => {
            templateService.create('Unique Name', '<p>Content</p>');
            const found = templateService.getByName('Unique Name');

            expect(found).not.toBeNull();
        });

        it('should list all templates', () => {
            templateService.create('Template 1', 'Content 1');
            templateService.create('Template 2', 'Content 2');

            expect(templateService.list()).toHaveLength(2);
        });

        it('should update template', () => {
            const template = templateService.create('Original', 'Old content');
            templateService.update(template.id, { content: 'New content' });

            expect(templateService.get(template.id).content).toBe('New content');
        });

        it('should delete template', () => {
            const template = templateService.create('Delete Me', 'Content');
            templateService.delete(template.id);

            expect(templateService.get(template.id)).toBeNull();
        });
    });

    describe('Template Rendering', () => {
        it('should render template with variables', () => {
            const template = templateService.create('Greeting', 'Hello {{name}}!');
            const result = templateService.render(template.id, { name: 'John' });

            expect(result).toBe('Hello John!');
        });

        it('should render multiple variables', () => {
            const template = templateService.create('Full', 'Dear {{title}} {{name}}, welcome to {{company}}');
            const result = templateService.render(template.id, {
                title: 'Mr.',
                name: 'Smith',
                company: 'Acme'
            });

            expect(result).toBe('Dear Mr. Smith, welcome to Acme');
        });

        it('should handle missing variables', () => {
            const template = templateService.create('Partial', 'Hello {{name}}, your code is {{code}}');
            const result = templateService.render(template.id, { name: 'John' });

            expect(result).toContain('John');
            expect(result).toContain('{{code}}');
        });
    });

    describe('Variable Extraction', () => {
        it('should extract variables from template', () => {
            const template = templateService.create('Vars', '<p>{{greeting}} {{name}}</p>');

            expect(template.variables).toContain('greeting');
            expect(template.variables).toContain('name');
        });

        it('should validate required variables', () => {
            const template = templateService.create('Required', '{{a}} {{b}} {{c}}');

            const valid = templateService.validateVariables(template.id, { a: '1', b: '2', c: '3' });
            const invalid = templateService.validateVariables(template.id, { a: '1' });

            expect(valid.valid).toBe(true);
            expect(invalid.valid).toBe(false);
            expect(invalid.missing).toContain('b');
        });
    });

    describe('Template Types', () => {
        it('should support different types', () => {
            const htmlTemplate = templateService.create('HTML', '<p>HTML</p>', { type: 'html' });
            const textTemplate = templateService.create('Text', 'Plain text', { type: 'text' });
            const markdownTemplate = templateService.create('MD', '# Title', { type: 'markdown' });

            expect(htmlTemplate.type).toBe('html');
            expect(textTemplate.type).toBe('text');
            expect(markdownTemplate.type).toBe('markdown');
        });
    });
});
