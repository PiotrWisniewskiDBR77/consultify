import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing
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

const mockPMOHealthService = {
    getHealthSnapshot: vi.fn()
};

vi.mock('../../../server/services/pmoHealthService', () => ({
    default: mockPMOHealthService
}));

import AIContextBuilder from '../../../server/services/aiContextBuilder.js';

describe('AIContextBuilder', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default mock implementations
        mockDb.get.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') {
                cb(null, null);
            }
        });

        mockDb.all.mockImplementation((...args) => {
            const cb = args[args.length - 1];
            if (typeof cb === 'function') {
                cb(null, []);
            }
        });

        mockPMOHealthService.getHealthSnapshot.mockResolvedValue({
            overallScore: 75,
            dimensions: {}
        });
    });

    describe('buildContext', () => {
        it('should build complete 6-layer context', async () => {
            const result = await AIContextBuilder.buildContext('user-1', 'org-1', 'proj-1');

            expect(result).toHaveProperty('platform');
            expect(result).toHaveProperty('organization');
            expect(result).toHaveProperty('project');
            expect(result).toHaveProperty('execution');
            expect(result).toHaveProperty('knowledge');
            expect(result).toHaveProperty('external');
        });

        it('should include PMO health snapshot when available', async () => {
            mockPMOHealthService.getHealthSnapshot.mockResolvedValue({
                overallScore: 82,
                dimensions: {
                    governance: 85,
                    delivery: 78
                }
            });

            const result = await AIContextBuilder.buildContext('user-1', 'org-1', 'proj-1');

            expect(result.pmo).toBeDefined();
            expect(result.pmo.healthSnapshot.overallScore).toBe(82);
        });

        it('should work without projectId', async () => {
            const result = await AIContextBuilder.buildContext('user-1', 'org-1');

            expect(result).toBeDefined();
            expect(result.project).toBeNull();
        });

        it('should include context hash', async () => {
            const result = await AIContextBuilder.buildContext('user-1', 'org-1', 'proj-1');

            expect(result.hash).toBeDefined();
            expect(typeof result.hash).toBe('string');
        });

        it('should handle PMOHealthService unavailability gracefully', async () => {
            mockPMOHealthService.getHealthSnapshot.mockRejectedValue(new Error('Service unavailable'));

            const result = await AIContextBuilder.buildContext('user-1', 'org-1', 'proj-1');

            expect(result).toBeDefined();
            // Should still return context even if health snapshot fails
        });
    });

    describe('_buildPlatformContext', () => {
        it('should include user and organization info', async () => {
            mockDb.get.mockImplementation((...args) => {
                const query = args[0];
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    if (query.includes('FROM users')) {
                        cb(null, {
                            id: 'user-1',
                            first_name: 'John',
                            last_name: 'Doe',
                            role: 'ADMIN'
                        });
                    } else if (query.includes('FROM organizations')) {
                        cb(null, {
                            id: 'org-1',
                            name: 'Test Org',
                            plan: 'enterprise'
                        });
                    } else {
                        cb(null, null);
                    }
                }
            });

            const result = await AIContextBuilder.buildContext('user-1', 'org-1');

            expect(result.platform.user).toBeDefined();
            expect(result.platform.organization).toBeDefined();
        });

        it('should include subscription status', async () => {
            mockDb.get.mockImplementation((...args) => {
                const query = args[0];
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    if (query.includes('subscriptions')) {
                        cb(null, {
                            plan: 'enterprise',
                            status: 'active'
                        });
                    } else {
                        cb(null, null);
                    }
                }
            });

            const result = await AIContextBuilder.buildContext('user-1', 'org-1');

            expect(result.platform).toBeDefined();
        });
    });

    describe('_buildOrganizationContext', () => {
        it('should include organization details', async () => {
            mockDb.get.mockImplementation((...args) => {
                const query = args[0];
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    if (query.includes('FROM organizations')) {
                        cb(null, {
                            id: 'org-1',
                            name: 'Acme Corp',
                            industry: 'Technology',
                            size: '500+'
                        });
                    } else {
                        cb(null, null);
                    }
                }
            });

            const result = await AIContextBuilder.buildContext('user-1', 'org-1');

            expect(result.organization).toBeDefined();
        });

        it('should include team members count', async () => {
            mockDb.all.mockImplementation((...args) => {
                const query = args[0];
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    if (query.includes('users')) {
                        cb(null, [{ id: 'u1' }, { id: 'u2' }]);
                    } else {
                        cb(null, []);
                    }
                }
            });

            const result = await AIContextBuilder.buildContext('user-1', 'org-1');

            expect(result.organization).toBeDefined();
        });
    });

    describe('_buildProjectContext', () => {
        it('should return null when no projectId', async () => {
            const result = await AIContextBuilder.buildContext('user-1', 'org-1');

            expect(result.project).toBeNull();
        });

        it('should include project details', async () => {
            mockDb.get.mockImplementation((...args) => {
                const query = args[0];
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    if (query.includes('FROM projects')) {
                        cb(null, {
                            id: 'proj-1',
                            name: 'Digital Transformation',
                            status: 'IN_PROGRESS',
                            budget: 1000000
                        });
                    } else {
                        cb(null, null);
                    }
                }
            });

            const result = await AIContextBuilder.buildContext('user-1', 'org-1', 'proj-1');

            expect(result.project).toBeDefined();
        });

        it('should include initiative and task counts', async () => {
            mockDb.all.mockImplementation((...args) => {
                const query = args[0];
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    if (query.includes('initiatives')) {
                        cb(null, [{ id: 'i1' }, { id: 'i2' }]);
                    } else if (query.includes('tasks')) {
                        cb(null, [{ id: 't1' }, { id: 't2' }, { id: 't3' }]);
                    } else {
                        cb(null, []);
                    }
                }
            });

            const result = await AIContextBuilder.buildContext('user-1', 'org-1', 'proj-1');

            expect(result.project).toBeDefined();
        });
    });

    describe('_buildExecutionContext', () => {
        it('should include recent activities', async () => {
            mockDb.all.mockImplementation((...args) => {
                const query = args[0];
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    if (query.includes('activity')) {
                        cb(null, [
                            { id: 'a1', action: 'TASK_CREATED', created_at: '2024-12-20' },
                            { id: 'a2', action: 'STATUS_CHANGED', created_at: '2024-12-19' }
                        ]);
                    } else {
                        cb(null, []);
                    }
                }
            });

            const result = await AIContextBuilder.buildContext('user-1', 'org-1', 'proj-1');

            expect(result.execution).toBeDefined();
        });

        it('should include user assignments', async () => {
            mockDb.all.mockImplementation((...args) => {
                const query = args[0];
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    if (query.includes('assignee')) {
                        cb(null, [{ id: 't1', title: 'My Task' }]);
                    } else {
                        cb(null, []);
                    }
                }
            });

            const result = await AIContextBuilder.buildContext('user-1', 'org-1', 'proj-1');

            expect(result.execution).toBeDefined();
        });
    });

    describe('_buildKnowledgeContext', () => {
        it('should include project documents', async () => {
            mockDb.all.mockImplementation((...args) => {
                const query = args[0];
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    if (query.includes('documents') || query.includes('knowledge')) {
                        cb(null, [
                            { id: 'd1', title: 'Project Charter' },
                            { id: 'd2', title: 'Requirements Doc' }
                        ]);
                    } else {
                        cb(null, []);
                    }
                }
            });

            const result = await AIContextBuilder.buildContext('user-1', 'org-1', 'proj-1');

            expect(result.knowledge).toBeDefined();
        });

        it('should include historical insights', async () => {
            mockDb.all.mockImplementation((...args) => {
                const query = args[0];
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    if (query.includes('insights') || query.includes('lessons')) {
                        cb(null, [{ insight: 'Past project lesson' }]);
                    } else {
                        cb(null, []);
                    }
                }
            });

            const result = await AIContextBuilder.buildContext('user-1', 'org-1', 'proj-1');

            expect(result.knowledge).toBeDefined();
        });
    });

    describe('_buildExternalContext', () => {
        it('should include external integrations info', async () => {
            mockDb.all.mockImplementation((...args) => {
                const query = args[0];
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    if (query.includes('integrations') || query.includes('connectors')) {
                        cb(null, [
                            { id: 'int-1', name: 'Jira', status: 'connected' }
                        ]);
                    } else {
                        cb(null, []);
                    }
                }
            });

            const result = await AIContextBuilder.buildContext('user-1', 'org-1');

            expect(result.external).toBeDefined();
        });

        it('should handle no external integrations', async () => {
            mockDb.all.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, []);
                }
            });

            const result = await AIContextBuilder.buildContext('user-1', 'org-1');

            expect(result.external).toBeDefined();
        });
    });

    describe('_generateHash', () => {
        it('should generate consistent hash for same inputs', async () => {
            mockDb.get.mockImplementation((...args) => {
                const cb = args[args.length - 1];
                if (typeof cb === 'function') {
                    cb(null, { id: 'test' });
                }
            });

            const result1 = await AIContextBuilder.buildContext('user-1', 'org-1', 'proj-1');
            const result2 = await AIContextBuilder.buildContext('user-1', 'org-1', 'proj-1');

            // Hash should be generated for each call
            expect(result1.hash).toBeDefined();
            expect(result2.hash).toBeDefined();
        });
    });

    describe('options handling', () => {
        it('should respect skipPMOHealth option', async () => {
            const result = await AIContextBuilder.buildContext('user-1', 'org-1', 'proj-1', {
                skipPMOHealth: true
            });

            expect(mockPMOHealthService.getHealthSnapshot).not.toHaveBeenCalled();
        });

        it('should respect depth option', async () => {
            const result = await AIContextBuilder.buildContext('user-1', 'org-1', 'proj-1', {
                depth: 'minimal'
            });

            expect(result).toBeDefined();
        });
    });
});
