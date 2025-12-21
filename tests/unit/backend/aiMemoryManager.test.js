/**
 * AI Memory Manager Tests
 * 
 * HIGH PRIORITY AI SERVICE - Must have 85%+ coverage
 * Tests memory management, decision recording, and project memory.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testUsers, testProjects } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);

describe('AIMemoryManager', () => {
    let mockDb;
    let AIMemoryManager;

    beforeEach(() => {
        mockDb = createMockDb();
        
        vi.mock('../../../server/database', () => ({
            default: mockDb
        }));

        AIMemoryManager = require('../../../server/services/aiMemoryManager.js');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createSession()', () => {
        it('should create new session', () => {
            const session = AIMemoryManager.createSession();

            expect(session).toBeDefined();
            expect(session.conversationId).toBeDefined();
            expect(session.messages).toEqual([]);
            expect(session.startedAt).toBeDefined();
        });

        it('should create unique session IDs', () => {
            const session1 = AIMemoryManager.createSession();
            const session2 = AIMemoryManager.createSession();

            expect(session1.conversationId).not.toBe(session2.conversationId);
        });
    });

    describe('addMessage()', () => {
        it('should add message to session', () => {
            const session = AIMemoryManager.createSession();
            const updatedSession = AIMemoryManager.addMessage(session, 'user', 'Hello');

            expect(updatedSession.messages).toHaveLength(1);
            expect(updatedSession.messages[0].role).toBe('user');
            expect(updatedSession.messages[0].content).toBe('Hello');
            expect(updatedSession.messages[0].timestamp).toBeDefined();
        });

        it('should add multiple messages', () => {
            const session = AIMemoryManager.createSession();
            AIMemoryManager.addMessage(session, 'user', 'Hello');
            AIMemoryManager.addMessage(session, 'assistant', 'Hi there');

            expect(session.messages).toHaveLength(2);
        });
    });

    describe('recordProjectMemory()', () => {
        it('should record project memory', async () => {
            const projectId = testProjects.project1.id;
            const memoryType = AIMemoryManager.MEMORY_TYPES.DECISION;
            const content = { decision: 'test decision' };
            const userId = testUsers.user.id;

            let callCount = 0;
            mockDb.run.mockImplementation((query, params, callback) => {
                callCount++;
                if (callCount === 1) {
                    // First call: INSERT INTO ai_project_memory
                    expect(query).toContain('ai_project_memory');
                    expect(params).toContain(projectId);
                    expect(params).toContain(memoryType);
                } else {
                    // Second call: INSERT INTO activity_logs
                    expect(query).toContain('activity_logs');
                }
                callback.call({ changes: 1 }, null);
            });

            const result = await AIMemoryManager.recordProjectMemory(
                projectId,
                memoryType,
                content,
                userId
            );

            expect(result.id).toBeDefined();
            expect(result.projectId).toBe(projectId);
            expect(result.memoryType).toBe(memoryType);
            expect(mockDb.run).toHaveBeenCalledTimes(2); // Memory + audit log
        });

        it('should handle database errors', async () => {
            const projectId = testProjects.project1.id;
            const memoryType = AIMemoryManager.MEMORY_TYPES.DECISION;
            const content = { decision: 'test' };
            const userId = testUsers.user.id;

            mockDb.run.mockImplementation((query, params, callback) => {
                callback(new Error('DB Error'));
            });

            await expect(
                AIMemoryManager.recordProjectMemory(projectId, memoryType, content, userId)
            ).rejects.toThrow('DB Error');
        });
    });

    describe('recordDecision()', () => {
        it('should record decision with rationale', async () => {
            const projectId = testProjects.project1.id;
            const decisionId = 'decision-123';
            const title = 'Test Decision';
            const outcome = 'approved';
            const rationale = 'Test rationale';
            const userId = testUsers.user.id;

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await AIMemoryManager.recordDecision(
                projectId,
                decisionId,
                title,
                outcome,
                rationale,
                userId
            );

            expect(result.id).toBeDefined();
            expect(result.projectId).toBe(projectId);
            expect(result.memoryType).toBe(AIMemoryManager.MEMORY_TYPES.DECISION);
        });
    });

    describe('recordPhaseTransition()', () => {
        it('should record phase transition', async () => {
            const projectId = testProjects.project1.id;
            const fromPhase = 'Assessment';
            const toPhase = 'Initiatives';
            const reason = 'Assessment complete';
            const userId = testUsers.user.id;

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await AIMemoryManager.recordPhaseTransition(
                projectId,
                fromPhase,
                toPhase,
                reason,
                userId
            );

            expect(result.memoryType).toBe(AIMemoryManager.MEMORY_TYPES.PHASE_TRANSITION);
        });
    });

    describe('recordRecommendation()', () => {
        it('should record recommendation and user response', async () => {
            const projectId = testProjects.project1.id;
            const recommendation = 'Test recommendation';
            const accepted = true;
            const userFeedback = 'Good suggestion';
            const userId = testUsers.user.id;

            mockDb.run.mockImplementation((query, params, callback) => {
                callback.call({ changes: 1 }, null);
            });

            const result = await AIMemoryManager.recordRecommendation(
                projectId,
                recommendation,
                accepted,
                userFeedback,
                userId
            );

            expect(result.memoryType).toBe(AIMemoryManager.MEMORY_TYPES.RECOMMENDATION);
        });
    });

    describe('getProjectMemory()', () => {
        it('should retrieve project memories', async () => {
            const projectId = testProjects.project1.id;

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [
                    {
                        id: 'mem-1',
                        memory_type: AIMemoryManager.MEMORY_TYPES.DECISION,
                        content: JSON.stringify({ decision: 'test' })
                    },
                    {
                        id: 'mem-2',
                        memory_type: AIMemoryManager.MEMORY_TYPES.RECOMMENDATION,
                        content: JSON.stringify({ recommendation: 'test' })
                    }
                ]);
            });

            const memories = await AIMemoryManager.getProjectMemory(projectId);

            expect(memories).toHaveLength(2);
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                expect.arrayContaining([projectId]),
                expect.any(Function)
            );
        });

        it('should filter by memory type', async () => {
            const projectId = testProjects.project1.id;
            const memoryType = AIMemoryManager.MEMORY_TYPES.DECISION;

            mockDb.all.mockImplementation((query, params, callback) => {
                // Verify query filters by memory_type
                expect(params).toContain(memoryType);
                callback(null, []);
            });

            await AIMemoryManager.getProjectMemory(projectId, memoryType);
        });
    });

    describe('getRelevantMemories()', () => {
        it('should return relevant memories for context', async () => {
            const projectId = testProjects.project1.id;
            const context = 'test context';

            mockDb.all.mockImplementation((query, params, callback) => {
                callback(null, [
                    {
                        id: 'mem-1',
                        memory_type: AIMemoryManager.MEMORY_TYPES.DECISION,
                        content: JSON.stringify({ decision: 'test' })
                    }
                ]);
            });

            const memories = await AIMemoryManager.getRelevantMemories(projectId, context);

            expect(Array.isArray(memories)).toBe(true);
        });
    });
});
