// AI Core Layer Tests
// Tests for AI Context Builder, Policy Engine, Memory Manager, Orchestrator
// Focus on exports and structure (database integration tests are in integration suite)

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database
vi.mock('../../../server/database', () => ({
    default: {
        get: vi.fn((sql, params, callback) => callback(null, null)),
        run: vi.fn((sql, params, callback) => callback && callback.call({ changes: 1 }, null)),
        all: vi.fn((sql, params, callback) => callback(null, []))
    }
}));

describe('AIContextBuilder', () => {
    let AIContextBuilder;

    beforeEach(async () => {
        vi.clearAllMocks();
        AIContextBuilder = (await import('../../../server/services/aiContextBuilder.js')).default;
    });

    describe('Service Structure', () => {
        it('should export buildContext function', () => {
            expect(typeof AIContextBuilder.buildContext).toBe('function');
        });

        it('should export _buildPlatformContext function', () => {
            expect(typeof AIContextBuilder._buildPlatformContext).toBe('function');
        });

        it('should export _buildOrganizationContext function', () => {
            expect(typeof AIContextBuilder._buildOrganizationContext).toBe('function');
        });

        it('should export _buildProjectContext function', () => {
            expect(typeof AIContextBuilder._buildProjectContext).toBe('function');
        });

        it('should export _buildExecutionContext function', () => {
            expect(typeof AIContextBuilder._buildExecutionContext).toBe('function');
        });

        it('should export _buildKnowledgeContext function', () => {
            expect(typeof AIContextBuilder._buildKnowledgeContext).toBe('function');
        });

        it('should export _buildExternalContext function', () => {
            expect(typeof AIContextBuilder._buildExternalContext).toBe('function');
        });

        it('should export _generateHash function', () => {
            expect(typeof AIContextBuilder._generateHash).toBe('function');
        });
    });

    describe('_generateHash', () => {
        it('should generate consistent hash', () => {
            const platform = { tenantId: 'org-1' };
            const organization = { organizationId: 'org-1' };
            const project = { projectId: 'proj-1' };

            const hash1 = AIContextBuilder._generateHash(platform, organization, project);

            expect(hash1).toBeTruthy();
            expect(typeof hash1).toBe('string');
        });

        it('should generate different hash for different inputs', () => {
            const hash1 = AIContextBuilder._generateHash({ tenantId: 'org-1' }, {}, {});
            const hash2 = AIContextBuilder._generateHash({ tenantId: 'org-2' }, {}, {});

            expect(hash1).not.toBe(hash2);
        });
    });
});

describe('AIPolicyEngine', () => {
    let AIPolicyEngine;

    beforeEach(async () => {
        vi.clearAllMocks();
        AIPolicyEngine = (await import('../../../server/services/aiPolicyEngine.js')).default;
    });

    describe('POLICY_LEVELS', () => {
        it('should define ADVISORY level', () => {
            expect(AIPolicyEngine.POLICY_LEVELS.ADVISORY).toBe('ADVISORY');
        });

        it('should define ASSISTED level', () => {
            expect(AIPolicyEngine.POLICY_LEVELS.ASSISTED).toBe('ASSISTED');
        });

        it('should define PROACTIVE level', () => {
            expect(AIPolicyEngine.POLICY_LEVELS.PROACTIVE).toBe('PROACTIVE');
        });

        it('should define AUTOPILOT level', () => {
            expect(AIPolicyEngine.POLICY_LEVELS.AUTOPILOT).toBe('AUTOPILOT');
        });
    });

    describe('AI_ROLES', () => {
        it('should define ADVISOR role', () => {
            expect(AIPolicyEngine.AI_ROLES.ADVISOR).toBe('ADVISOR');
        });

        it('should define PMO_MANAGER role', () => {
            expect(AIPolicyEngine.AI_ROLES.PMO_MANAGER).toBe('PMO_MANAGER');
        });

        it('should define EXECUTOR role', () => {
            expect(AIPolicyEngine.AI_ROLES.EXECUTOR).toBe('EXECUTOR');
        });

        it('should define EDUCATOR role', () => {
            expect(AIPolicyEngine.AI_ROLES.EDUCATOR).toBe('EDUCATOR');
        });
    });

    describe('Service Structure', () => {
        it('should export getEffectivePolicy function', () => {
            expect(typeof AIPolicyEngine.getEffectivePolicy).toBe('function');
        });

        it('should export canPerformAction function', () => {
            expect(typeof AIPolicyEngine.canPerformAction).toBe('function');
        });

        it('should export getPolicySummary function', () => {
            expect(typeof AIPolicyEngine.getPolicySummary).toBe('function');
        });

        it('should export updatePolicy function', () => {
            expect(typeof AIPolicyEngine.updatePolicy).toBe('function');
        });
    });
});

describe('AIMemoryManager', () => {
    let AIMemoryManager;

    beforeEach(async () => {
        vi.clearAllMocks();
        AIMemoryManager = (await import('../../../server/services/aiMemoryManager.js')).default;
    });

    describe('MEMORY_TYPES', () => {
        it('should define DECISION type', () => {
            expect(AIMemoryManager.MEMORY_TYPES.DECISION).toBe('DECISION');
        });

        it('should define PHASE_TRANSITION type', () => {
            expect(AIMemoryManager.MEMORY_TYPES.PHASE_TRANSITION).toBe('PHASE_TRANSITION');
        });

        it('should define RECOMMENDATION type', () => {
            expect(AIMemoryManager.MEMORY_TYPES.RECOMMENDATION).toBe('RECOMMENDATION');
        });

        it('should define PATTERN type', () => {
            expect(AIMemoryManager.MEMORY_TYPES.PATTERN).toBe('PATTERN');
        });
    });

    describe('createSession', () => {
        it('should create session with unique conversationId', () => {
            const session1 = AIMemoryManager.createSession();
            const session2 = AIMemoryManager.createSession();

            expect(session1.conversationId).toBeTruthy();
            expect(session2.conversationId).toBeTruthy();
            expect(session1.conversationId).not.toBe(session2.conversationId);
        });

        it('should create session with empty messages array', () => {
            const session = AIMemoryManager.createSession();

            expect(session.messages).toEqual([]);
        });

        it('should create session with startedAt timestamp', () => {
            const session = AIMemoryManager.createSession();

            expect(session.startedAt).toBeTruthy();
        });
    });

    describe('addMessage', () => {
        it('should add message to session', () => {
            const session = AIMemoryManager.createSession();

            AIMemoryManager.addMessage(session, 'user', 'Hello');

            expect(session.messages).toHaveLength(1);
            expect(session.messages[0].role).toBe('user');
            expect(session.messages[0].content).toBe('Hello');
        });

        it('should add timestamp to message', () => {
            const session = AIMemoryManager.createSession();

            AIMemoryManager.addMessage(session, 'ai', 'Hello back');

            expect(session.messages[0].timestamp).toBeTruthy();
        });
    });

    describe('Service Structure', () => {
        it('should export recordProjectMemory function', () => {
            expect(typeof AIMemoryManager.recordProjectMemory).toBe('function');
        });

        it('should export getUserPreferences function', () => {
            expect(typeof AIMemoryManager.getUserPreferences).toBe('function');
        });

        it('should export updateUserPreferences function', () => {
            expect(typeof AIMemoryManager.updateUserPreferences).toBe('function');
        });
    });
});

describe('AIOrchestrator', () => {
    let AIOrchestrator;

    beforeEach(async () => {
        vi.clearAllMocks();
        AIOrchestrator = (await import('../../../server/services/aiOrchestrator.js')).default;
    });

    describe('AI_ROLES', () => {
        it('should define all 4 roles', () => {
            expect(Object.keys(AIOrchestrator.AI_ROLES)).toHaveLength(4);
        });
    });

    describe('CHAT_MODES', () => {
        it('should define EXPLAIN mode', () => {
            expect(AIOrchestrator.CHAT_MODES.EXPLAIN).toBe('EXPLAIN');
        });

        it('should define GUIDE mode', () => {
            expect(AIOrchestrator.CHAT_MODES.GUIDE).toBe('GUIDE');
        });

        it('should define ANALYZE mode', () => {
            expect(AIOrchestrator.CHAT_MODES.ANALYZE).toBe('ANALYZE');
        });

        it('should define DO mode', () => {
            expect(AIOrchestrator.CHAT_MODES.DO).toBe('DO');
        });

        it('should define TEACH mode', () => {
            expect(AIOrchestrator.CHAT_MODES.TEACH).toBe('TEACH');
        });
    });

    describe('_detectIntent', () => {
        it('should detect EXPLAIN intent', () => {
            expect(AIOrchestrator._detectIntent('explain this')).toBe('EXPLAIN');
            expect(AIOrchestrator._detectIntent('what is this?')).toBe('EXPLAIN');
            expect(AIOrchestrator._detectIntent('wyjaśnij mi')).toBe('EXPLAIN');
        });

        it('should detect GUIDE intent', () => {
            expect(AIOrchestrator._detectIntent('what should I do next?')).toBe('GUIDE');
            expect(AIOrchestrator._detectIntent('co powinienem zrobić')).toBe('GUIDE');
        });

        it('should detect ANALYZE intent', () => {
            expect(AIOrchestrator._detectIntent('analyze risks')).toBe('ANALYZE');
            expect(AIOrchestrator._detectIntent('sprawdź ryzyko')).toBe('ANALYZE');
        });

        it('should detect DO intent', () => {
            expect(AIOrchestrator._detectIntent('create a draft')).toBe('DO');
            expect(AIOrchestrator._detectIntent('przygotuj raport')).toBe('DO');
        });

        it('should detect TEACH intent', () => {
            expect(AIOrchestrator._detectIntent('why is this important?')).toBe('TEACH');
            expect(AIOrchestrator._detectIntent('dlaczego to jest ważne')).toBe('TEACH');
        });

        it('should default to EXPLAIN', () => {
            expect(AIOrchestrator._detectIntent('hello')).toBe('EXPLAIN');
        });
    });

    describe('_selectRole', () => {
        it('should select ADVISOR for EXPLAIN intent', () => {
            const policy = { activeRoles: ['ADVISOR', 'PMO_MANAGER', 'EXECUTOR', 'EDUCATOR'] };
            expect(AIOrchestrator._selectRole('EXPLAIN', policy)).toBe('ADVISOR');
        });

        it('should select PMO_MANAGER for GUIDE intent', () => {
            const policy = { activeRoles: ['ADVISOR', 'PMO_MANAGER', 'EXECUTOR', 'EDUCATOR'] };
            expect(AIOrchestrator._selectRole('GUIDE', policy)).toBe('PMO_MANAGER');
        });

        it('should select EXECUTOR for DO intent', () => {
            const policy = { activeRoles: ['ADVISOR', 'PMO_MANAGER', 'EXECUTOR', 'EDUCATOR'] };
            expect(AIOrchestrator._selectRole('DO', policy)).toBe('EXECUTOR');
        });

        it('should select EDUCATOR for TEACH intent', () => {
            const policy = { activeRoles: ['ADVISOR', 'PMO_MANAGER', 'EXECUTOR', 'EDUCATOR'] };
            expect(AIOrchestrator._selectRole('TEACH', policy)).toBe('EDUCATOR');
        });

        it('should fallback to ADVISOR if role not active', () => {
            const policy = { activeRoles: ['ADVISOR'] };
            expect(AIOrchestrator._selectRole('DO', policy)).toBe('ADVISOR');
        });
    });

    describe('getRoleDescription', () => {
        it('should return description for ADVISOR', () => {
            const desc = AIOrchestrator.getRoleDescription('ADVISOR');
            expect(desc).toContain('Explains');
        });

        it('should return description for PMO_MANAGER', () => {
            const desc = AIOrchestrator.getRoleDescription('PMO_MANAGER');
            expect(desc).toContain('risks');
        });

        it('should return description for EXECUTOR', () => {
            const desc = AIOrchestrator.getRoleDescription('EXECUTOR');
            expect(desc).toContain('drafts');
        });

        it('should return description for EDUCATOR', () => {
            const desc = AIOrchestrator.getRoleDescription('EDUCATOR');
            expect(desc).toContain('Teaches');
        });
    });

    describe('Service Structure', () => {
        it('should export processMessage function', () => {
            expect(typeof AIOrchestrator.processMessage).toBe('function');
        });
    });
});
