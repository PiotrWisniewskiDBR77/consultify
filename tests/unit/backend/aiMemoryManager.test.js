import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
const mockDb = {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    serialize: vi.fn((cb) => cb()),
    initPromise: Promise.resolve()
};

vi.mock('../../../server/database', () => ({
    default: mockDb
}));

vi.mock('uuid', () => ({
    v4: () => 'mem-1234'
}));

import AIMemoryManager from '../../../server/services/aiMemoryManager.js';

describe('AIMemoryManager', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockDb.run.mockImplementation(function (...args) {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') {
                cb.call({ changes: 1 }, null);
            }
        });

        mockDb.all.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') {
                cb(null, []);
            }
        });

        mockDb.get.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') {
                cb(null, null);
            }
        });
    });

    describe('Session Memory (In-Memory)', () => {
        it('should create a session', () => {
            const session = AIMemoryManager.createSession();
            expect(session).toEqual([]);
        });

        it('should add messages to session', () => {
            const session = AIMemoryManager.createSession();

            AIMemoryManager.addMessage(session, 'user', 'Hello');
            AIMemoryManager.addMessage(session, 'assistant', 'Hi');

            expect(session).toHaveLength(2);
            expect(session[0]).toEqual({ role: 'user', content: 'Hello' });
        });

        it('should respect context window limit', () => {
            const session = AIMemoryManager.createSession();
            // Add 25 messages (limit is 20)
            for (let i = 0; i < 25; i++) {
                AIMemoryManager.addMessage(session, 'user', `Msg ${i}`);
            }

            expect(session).toHaveLength(20);
            expect(session[19].content).toBe('Msg 24');
        });
    });

    describe('Project Memory', () => {
        it('should record project memory', async () => {
            const result = await AIMemoryManager.recordProjectMemory(
                'proj-1',
                'DECISION',
                { decision: 'Go' },
                'user-1'
            );

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO ai_project_memory'),
                expect.arrayContaining(['proj-1', 'DECISION']),
                expect.any(Function)
            );
        });

        it('should record decision helper', async () => {
            const result = await AIMemoryManager.recordDecision(
                'proj-1', 'dec-1', 'Title', 'Outcome', 'Rationale', 'user-1'
            );

            expect(result.success).toBe(true);
            const callArgs = mockDb.run.mock.calls[0];
            expect(callArgs[1]).toContain(AIMemoryManager.MEMORY_TYPES.DECISION);
        });

        it('should record phase transition', async () => {
            const result = await AIMemoryManager.recordPhaseTransition(
                'proj-1', 'PLANNING', 'EXECUTION', 'Approved', 'user-1'
            );

            expect(result.success).toBe(true);
            const callArgs = mockDb.run.mock.calls[0];
            expect(callArgs[1]).toContain(AIMemoryManager.MEMORY_TYPES.PHASE_TRANSITION);
        });

        it('should get project memory', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [{ id: '1', content: JSON.stringify({ test: 1 }) }]);
                }
            });

            const memory = await AIMemoryManager.getProjectMemory('proj-1');

            expect(memory).toHaveLength(1);
            expect(memory[0].content.test).toBe(1);
        });

        it('should build project memory summary', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, [
                        { memory_type: 'DECISION', content: JSON.stringify({ title: 'Dec 1' }) },
                        { memory_type: 'PHASE_TRANSITION', content: JSON.stringify({ to: 'EXECUTION' }) }
                    ]);
                }
            });

            const summary = await AIMemoryManager.buildProjectMemorySummary('proj-1');

            expect(summary).toContain('Decisions:');
            expect(summary).toContain('Dec 1');
            expect(summary).toContain('Phase Transitions:');
            expect(summary).toContain('EXECUTION');
        });
    });

    describe('Organization Memory', () => {
        it('should create new org memory if not exists', async () => {
            const result = await AIMemoryManager.getOrganizationMemory('org-1');

            expect(result).toBeDefined();
            // Should verify CREATE was called
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT'),
                expect.any(Array),
                expect.any(Function)
            );
        });

        it('should return existing org memory', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, {
                        organization_id: 'org-1',
                        recurring_patterns: '[]',
                        learned_preferences: '[]'
                    });
                }
            });

            const result = await AIMemoryManager.getOrganizationMemory('org-1');
            expect(result.organization_id).toBe('org-1');
            // Mock get should prevent INSERT
            expect(mockDb.run).not.toHaveBeenCalled();
        });

        it('should update organization memory', async () => {
            const result = await AIMemoryManager.updateOrganizationMemory('org-1', {
                knowledge_base_version: 2
            });

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE ai_organization_memory'),
                expect.any(Array),
                expect.any(Function)
            );
        });

        it('should add recurring pattern', async () => {
            // First get existing
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, { recurring_patterns: '["old"]' });
                }
            });

            const result = await AIMemoryManager.addRecurringPattern('org-1', 'new-pattern');

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE'),
                expect.arrayContaining([JSON.stringify(['old', 'new-pattern'])]),
                expect.any(Function)
            );
        });
    });

    describe('User Preferences', () => {
        it('should get user preferences', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, { communication_style: 'verbose' });
                }
            });

            const prefs = await AIMemoryManager.getUserPreferences('user-1');
            expect(prefs.communication_style).toBe('verbose');
        });

        it('should update user preferences', async () => {
            // First get existing
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, { communication_style: 'verbose' });
                }
            });

            const result = await AIMemoryManager.updateUserPreferences('user-1', {
                communication_style: 'concise'
            });

            expect(result.success).toBe(true);
            expect(mockDb.run).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE ai_user_preferences'),
                expect.any(Array),
                expect.any(Function)
            );
        });
    });

    describe('Cleanup', () => {
        it('should clear project memory', async () => {
            const result = await AIMemoryManager.clearProjectMemory('proj-1');
            expect(result.success).toBe(true);
        });

        it('should clear organization memory', async () => {
            const result = await AIMemoryManager.clearOrganizationMemory('org-1');
            expect(result.success).toBe(true);
        });
    });
});
