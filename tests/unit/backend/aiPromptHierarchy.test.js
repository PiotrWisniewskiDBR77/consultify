/**
 * AI Prompt Hierarchy Tests
 * 
 * HIGH PRIORITY AI SERVICE - Must have 85%+ coverage
 * Tests prompt stacking, layer priority, and user preference filtering.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testUsers, testProjects } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);

describe('AIPromptHierarchy', () => {
    let mockDb;
    let AIPromptHierarchy;

    beforeEach(() => {
        mockDb = createMockDb();
        
        vi.mock('../../../server/database', () => ({
            default: mockDb
        }));

        AIPromptHierarchy = require('../../../server/services/aiPromptHierarchy.js');
        
        // Inject mock dependencies
        AIPromptHierarchy._setDependencies({
            db: mockDb
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('buildPromptStack()', () => {
        it('should build prompt stack with all layers', async () => {
            const organizationId = 'org-123';
            const projectId = testProjects.project1.id;
            const userId = testUsers.user.id;
            const role = 'ADVISOR';
            const phase = 'Context';

            mockDb.get.mockImplementation((query, params, callback) => {
                if (query.includes('system_prompts')) {
                    callback(null, { content: 'System prompt' });
                } else if (query.includes('ai_user_preferences')) {
                    callback(null, {
                        preferred_tone: 'FRIENDLY',
                        response_length: 'medium'
                    });
                } else {
                    callback(null, null);
                }
            });

            const stack = await AIPromptHierarchy.buildPromptStack(
                organizationId,
                projectId,
                userId,
                role,
                phase
            );

            expect(stack).toBeDefined();
            expect(stack.system).toBeDefined();
            expect(stack.role).toBeDefined();
            expect(stack.phase).toBeDefined();
            expect(stack.user).toBeDefined();
        });

        it('should use default prompts when custom not found', async () => {
            const organizationId = 'org-123';
            const projectId = testProjects.project1.id;
            const userId = testUsers.user.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const stack = await AIPromptHierarchy.buildPromptStack(
                organizationId,
                projectId,
                userId,
                'ADVISOR',
                'Context'
            );

            expect(stack.system).toBeDefined();
            expect(stack.role).toBeDefined();
            expect(stack.phase).toBeDefined();
        });
    });

    describe('_getSystemPrompt()', () => {
        it('should return custom system prompt when available', async () => {
            const organizationId = 'org-123';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { content: 'Custom system prompt' });
            });

            const prompt = await AIPromptHierarchy._getSystemPrompt(organizationId);

            expect(prompt).toBe('Custom system prompt');
        });

        it('should return default system prompt when not found', async () => {
            const organizationId = 'org-123';

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const prompt = await AIPromptHierarchy._getSystemPrompt(organizationId);

            expect(prompt).toBeDefined();
            expect(prompt).toContain('SYSTEM ROLE');
        });
    });

    describe('_getRolePrompt()', () => {
        it('should return role prompt for ADVISOR', async () => {
            const prompt = await AIPromptHierarchy._getRolePrompt('ADVISOR');
            expect(prompt).toBeDefined();
            expect(prompt).toContain('ADVISOR');
        });

        it('should return role prompt for PMO_MANAGER', async () => {
            const prompt = await AIPromptHierarchy._getRolePrompt('PMO_MANAGER');
            expect(prompt).toBeDefined();
            expect(prompt).toContain('PMO');
        });

        it('should return default for unknown role', async () => {
            const prompt = await AIPromptHierarchy._getRolePrompt('UNKNOWN');
            expect(prompt).toBeDefined();
        });
    });

    describe('_getPhasePrompt()', () => {
        it('should return phase prompt for Context', async () => {
            const prompt = await AIPromptHierarchy._getPhasePrompt('Context');
            expect(prompt).toBeDefined();
            expect(prompt).toContain('Context');
        });

        it('should return phase prompt for Execution', async () => {
            const prompt = await AIPromptHierarchy._getPhasePrompt('Execution');
            expect(prompt).toBeDefined();
            expect(prompt).toContain('Execution');
        });

        it('should return empty string for unknown phase', async () => {
            const prompt = await AIPromptHierarchy._getPhasePrompt('UNKNOWN');
            expect(prompt).toBe('');
        });
    });

    describe('_getUserOverlay()', () => {
        it('should return user preferences overlay', async () => {
            const userId = testUsers.user.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    preferred_tone: 'FRIENDLY',
                    response_length: 'medium',
                    education_mode: 1
                });
            });

            const overlay = await AIPromptHierarchy._getUserOverlay(userId);

            expect(overlay).toBeDefined();
            expect(overlay).toContain('FRIENDLY');
        });

        it('should filter out disallowed preferences', async () => {
            const userId = testUsers.user.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, {
                    preferred_tone: 'INVALID_TONE', // Not in ALLOWED_USER_PREFERENCES
                    response_length: 'medium'
                });
            });

            const overlay = await AIPromptHierarchy._getUserOverlay(userId);

            // Should not include invalid tone
            expect(overlay).not.toContain('INVALID_TONE');
        });

        it('should return empty string when no preferences', async () => {
            const userId = testUsers.user.id;

            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, null);
            });

            const overlay = await AIPromptHierarchy._getUserOverlay(userId);

            expect(overlay).toBe('');
        });
    });

    describe('combinePrompts()', () => {
        it('should combine prompts in correct order', () => {
            const stack = {
                system: 'System prompt',
                role: 'Role prompt',
                phase: 'Phase prompt',
                user: 'User overlay'
            };

            const combined = AIPromptHierarchy.combinePrompts(stack);

            expect(combined).toContain('System prompt');
            expect(combined).toContain('Role prompt');
            expect(combined).toContain('Phase prompt');
            expect(combined).toContain('User overlay');
            
            // System should come first
            expect(combined.indexOf('System prompt')).toBeLessThan(combined.indexOf('Role prompt'));
        });

        it('should handle missing layers', () => {
            const stack = {
                system: 'System prompt',
                role: null,
                phase: 'Phase prompt',
                user: ''
            };

            const combined = AIPromptHierarchy.combinePrompts(stack);

            expect(combined).toContain('System prompt');
            expect(combined).toContain('Phase prompt');
        });
    });

    describe('_validateUserPreference()', () => {
        it('should allow valid tone preference', () => {
            const isValid = AIPromptHierarchy._validateUserPreference('tone', 'FRIENDLY');
            expect(isValid).toBe(true);
        });

        it('should reject invalid tone preference', () => {
            const isValid = AIPromptHierarchy._validateUserPreference('tone', 'INVALID');
            expect(isValid).toBe(false);
        });

        it('should allow valid response length', () => {
            const isValid = AIPromptHierarchy._validateUserPreference('responseLength', 'medium');
            expect(isValid).toBe(true);
        });
    });
});
