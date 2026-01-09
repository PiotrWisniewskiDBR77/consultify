import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

/**
 * Variable Resolver Service Tests
 * Tests for dynamic content resolution and variable processing
 * CRITICAL FOR ENTERPRISE CONTENT MANAGEMENT
 */
describe('Variable Resolver Service', () => {
    let VariableResolver;
    let resolver;
    let RUNTIME_FUNCTIONS;
    let mocks;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();

        mocks = setupStandardTest();

        // Mock console
        global.console = {
            ...console,
            warn: vi.fn()
        };

        const module = await import('../../../server/src/services/ai/variableResolver.js');
        VariableResolver = module.VariableResolver || module.default?.VariableResolver;
        RUNTIME_FUNCTIONS = module.RUNTIME_FUNCTIONS || module.default?.RUNTIME_FUNCTIONS;

        // Handle case where it might be a default export class
        if (!VariableResolver && typeof module.default === 'function') {
            VariableResolver = module.default;
        }

        resolver = new VariableResolver();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('VariableResolver class', () => {
        it('should create instance', () => {
            expect(resolver).toBeDefined();
            expect(resolver.variableCache).toBeDefined();
            expect(resolver.customFunctions).toBeDefined();
        });

        it('should resolve simple context variable', async () => {
            const template = 'Hello {{user.name}}';
            const context = {
                user: {
                    firstName: 'John',
                    language: 'en'
                }
            };

            const result = await resolver.resolveTemplate(template, context);
            expect(result).toContain('John');
        });

        it('should resolve multiple variables', async () => {
            const template = 'Hello {{user.name}}, your role is {{user.role}}';
            const context = {
                user: {
                    firstName: 'John',
                    role: 'admin'
                }
            };

            const result = await resolver.resolveTemplate(template, context);
            expect(result).toContain('John');
            expect(result).toContain('admin');
        });

        it('should use default value when variable not found', async () => {
            const template = 'Hello {{user.name}}';
            const context = {};

            const result = await resolver.resolveTemplate(template, context);
            expect(result).toBeDefined();
        });

        it('should resolve runtime function variables', async () => {
            const template = 'Today is {{runtime.date}}';
            const context = {};

            const result = await resolver.resolveTemplate(template, context);
            expect(result).toContain('202');
        });

        it('should resolve config variables', async () => {
            const template = 'App: {{config.app_name}}';
            const context = {};

            const result = await resolver.resolveTemplate(template, context);
            expect(result).toContain('Consultinity');
        });

        it('should handle unknown variables', async () => {
            const template = 'Hello {{unknown.variable}}';
            const context = {};

            const result = await resolver.resolveTemplate(template, context, { keepUnresolved: true });
            expect(result).toContain('{{unknown.variable}}');
        });

        it('should resolve nested context paths', async () => {
            const template = 'Project: {{context.project.name}}';
            const context = {
                project: {
                    name: 'Test Project'
                }
            };

            const result = await resolver.resolveTemplate(template, context);
            expect(result).toContain('Test Project');
        });

        it('should handle empty template', async () => {
            const result = await resolver.resolveTemplate('', {});
            expect(result).toBe('');
        });

        it('should handle template without variables', async () => {
            const template = 'No variables here';
            const result = await resolver.resolveTemplate(template, {});
            expect(result).toBe('No variables here');
        });
    });

    describe('Runtime functions', () => {
        it('should detect language from text', () => {
            expect(RUNTIME_FUNCTIONS.detectLanguage('Test', { user: { language: 'en' } })).toBe('en');
            expect(RUNTIME_FUNCTIONS.detectLanguage('', { user: { language: 'pl' } })).toBe('pl');
        });

        it('should get current date', () => {
            const date = RUNTIME_FUNCTIONS.getCurrentDate();
            expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        });

        it('should get time of day context', () => {
            const timeOfDay = RUNTIME_FUNCTIONS.getTimeOfDayContext();
            expect(['morning', 'afternoon', 'evening']).toContain(timeOfDay);
        });

        it('should format assessment summary', () => {
            const context = {
                project: {
                    assessment: {
                        overallScore: 4.5,
                        strengths: ['Strength1', 'Strength2'],
                        gaps: ['Gap1']
                    }
                }
            };

            const summary = RUNTIME_FUNCTIONS.formatAssessmentSummary(context);
            expect(summary).toContain('4.5');
            expect(summary).toContain('Strength1');
        });

        it('should format initiative list', () => {
            const context = {
                project: {
                    initiatives: [
                        { name: 'Initiative 1', status: 'planned' },
                        { name: 'Initiative 2', status: 'active' }
                    ]
                }
            };

            const list = RUNTIME_FUNCTIONS.formatInitiativeList(context);
            expect(list).toContain('Initiative 1');
            expect(list).toContain('Initiative 2');
        });

        it('should summarize conversation', () => {
            const context = {
                conversation: {
                    recentMessages: [
                        { content: 'Let\'s discuss assessment' },
                        { content: 'What about initiatives?' }
                    ]
                }
            };

            const summary = RUNTIME_FUNCTIONS.summarizeConversation(context);
            expect(summary).toBeDefined();
        });
    });
});






