/**
 * AI Memory Manager Tests
 * 
 * HIGH PRIORITY AI SERVICE - Must have 85%+ coverage
 * Tests memory management, decision recording, and project memory.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb } from '../../helpers/dependencyInjector.js';
import { testUsers, testProjects } from '../../fixtures/testData.js';

describe('AIMemoryManager', () => {
    let mockDb;
    let AIMemoryManager;
    let uuidCounter;

    beforeEach(async () => {
        vi.resetModules();
        uuidCounter = 0;
        
        mockDb = createMockDb();

        AIMemoryManager = (await import('../../../server/services/aiMemoryManager.js')).default;
        
        AIMemoryManager.setDependencies({
            db: mockDb,
            uuidv4: () => `memory-uuid-${++uuidCounter}`
        });
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

            let runCallCount = 0;
            
            // Mock db.get to return organization_id - this is called from within db.run callback
            mockDb.get.mockImplementation((query, params, callback) => {
                // Mock db.get to return organization_id
                expect(query).toContain('SELECT organization_id FROM projects');
                expect(params).toContain(projectId);
                // Call callback synchronously since it's called from within db.run callback
                callback(null, { organization_id: 'org-123' });
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                runCallCount++;
                if (runCallCount === 1) {
                    // First call: INSERT INTO ai_project_memory
                    expect(query).toContain('ai_project_memory');
                    expect(params).toContain(projectId);
                    expect(params).toContain(memoryType);
                    // Call callback synchronously - this will trigger db.get inside
                    if (callback) {
                        callback.call({ changes: 1 }, null);
                    }
                } else if (runCallCount === 2) {
                    // Second call: INSERT INTO activity_logs (called after db.get)
                    expect(query).toContain('activity_logs');
                    expect(params).toContain('org-123'); // organization_id
                    // Call callback synchronously
                    if (callback) {
                        callback.call({ changes: 1 }, null);
                    }
                } else if (callback) {
                    callback.call({ changes: 1 }, null);
                }
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
            expect(mockDb.get).toHaveBeenCalledTimes(1); // Get organization_id
        });

        it('should handle database errors', async () => {
            const projectId = testProjects.project1.id;
            const memoryType = AIMemoryManager.MEMORY_TYPES.DECISION;
            const content = { decision: 'test' };
            const userId = testUsers.user.id;

            // Mock db.get - won't be called if first INSERT fails
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { organization_id: 'org-123' });
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                // First INSERT fails - this should reject the promise
                if (query.includes('ai_project_memory')) {
                    if (callback) {
                        callback(new Error('DB Error'));
                    }
                } else if (callback) {
                    callback.call({ changes: 1 }, null);
                }
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

            // Mock db.get to return organization_id
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { organization_id: 'org-123' });
            });

            let runCallCount = 0;
            mockDb.run.mockImplementation((query, params, callback) => {
                runCallCount++;
                if (callback) {
                    callback.call({ changes: 1 }, null);
                }
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

            // Mock db.get to return organization_id
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { organization_id: 'org-123' });
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                if (callback) {
                    callback.call({ changes: 1 }, null);
                }
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

            // Mock db.get to return organization_id
            mockDb.get.mockImplementation((query, params, callback) => {
                callback(null, { organization_id: 'org-123' });
            });

            mockDb.run.mockImplementation((query, params, callback) => {
                if (callback) {
                    callback.call({ changes: 1 }, null);
                }
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

            // Reset mock to ensure clean state
            mockDb.all.mockClear();
            
            mockDb.all.mockImplementation((query, params, callback) => {
                // Verify query and params
                expect(query).toContain('SELECT');
                expect(query).toContain('ai_project_memory');
                expect(params).toContain(projectId);
                expect(params).toContain(20); // limit
                
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
            expect(mockDb.all).toHaveBeenCalledTimes(1);
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

    describe('buildProjectMemorySummary()', () => {
        it('should build project memory summary', async () => {
            const projectId = testProjects.project1.id;

            let callCount = 0;
            mockDb.all.mockImplementation((query, params, callback) => {
                callCount++;
                // Return different data for each call (decisions, transitions, recommendations)
                if (callCount === 1) {
                    // Decisions
                    callback(null, [
                        { id: 'mem-1', memory_type: AIMemoryManager.MEMORY_TYPES.DECISION, content: JSON.stringify({ decision: 'test' }) }
                    ]);
                } else if (callCount === 2) {
                    // Transitions
                    callback(null, [
                        { id: 'mem-2', memory_type: AIMemoryManager.MEMORY_TYPES.PHASE_TRANSITION, content: JSON.stringify({ transition: 'test' }) }
                    ]);
                } else {
                    // Recommendations
                    callback(null, [
                        { id: 'mem-3', memory_type: AIMemoryManager.MEMORY_TYPES.RECOMMENDATION, content: JSON.stringify({ recommendation: 'test' }) }
                    ]);
                }
            });

            const summary = await AIMemoryManager.buildProjectMemorySummary(projectId);

            expect(summary.projectId).toBe(projectId);
            expect(summary.majorDecisions).toBeDefined();
            expect(summary.phaseTransitions).toBeDefined();
            expect(summary.aiRecommendations).toBeDefined();
            expect(summary.memoryCount).toBeGreaterThan(0);
        });
    });
});
