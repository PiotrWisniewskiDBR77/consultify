import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const mockDb = {
    run: vi.fn(),
    get: vi.fn()
};

vi.mock('../../../server/database', () => ({
    default: mockDb
}));

describe('DecisionTriggerService', () => {
    let DecisionTriggerService;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.resetModules();
        
        mockDb.run.mockImplementation((sql, params, callback) => {
            callback(null, { lastID: 1, changes: 1 });
        });

        mockDb.get.mockImplementation((sql, params, callback) => {
            callback(null, { owner_id: 'owner-123', first_name: 'John', last_name: 'Doe' });
        });

        DecisionTriggerService = require('../../../server/services/decisionTriggerService');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('createDecision', () => {
        it('should create a decision', async () => {
            const result = await DecisionTriggerService.createDecision({
                projectId: 'project-123',
                decisionType: 'TEST_DECISION',
                relatedObjectType: 'TASK',
                relatedObjectId: 'task-123',
                decisionOwnerId: 'owner-123',
                title: 'Test Decision',
                description: 'Test description',
                requestedById: 'user-123'
            });

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.status).toBe('PENDING');
            expect(mockDb.run).toHaveBeenCalled();
        });
    });

    describe('onInitiativeStatusChange', () => {
        it('should create decision when initiative moves from PLANNING to REVIEW', async () => {
            const initiative = {
                id: 'initiative-123',
                project_id: 'project-123',
                name: 'Test Initiative',
                priority: 'HIGH'
            };

            const result = await DecisionTriggerService.onInitiativeStatusChange(
                initiative,
                'PLANNING',
                'REVIEW',
                'user-123'
            );

            expect(result).toBeDefined();
            expect(mockDb.get).toHaveBeenCalled();
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should not create decision for other status transitions', async () => {
            const initiative = {
                id: 'initiative-123',
                project_id: 'project-123',
                name: 'Test Initiative'
            };

            const result = await DecisionTriggerService.onInitiativeStatusChange(
                initiative,
                'DRAFT',
                'PLANNING',
                'user-123'
            );

            expect(result).toBeUndefined();
        });
    });
});

