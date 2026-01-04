import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupStandardTest } from '../../helpers/unifiedMockSetup.js';

// Import after mock is set up
import DecisionTriggerService from '../../../server/src/services/decisionTriggerService';

describe('DecisionTriggerService', () => {
    let mocks;

    beforeEach(() => {
        mocks = setupStandardTest();
        vi.clearAllMocks();

        // Setup database mocks using unified pattern
        mocks.db.run.mockImplementation(function(sql, params, callback) {
            if (typeof callback === 'function') {
                callback.call({ lastID: 1, changes: 1 }, null);
            }
        });

        mocks.db.get.mockImplementation((sql, params, callback) => {
            if (typeof callback === 'function') {
                callback(null, { owner_id: 'owner-123', first_name: 'John', last_name: 'Doe' });
            }
        });
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






