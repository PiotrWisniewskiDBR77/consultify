/**
 * Initiative Service - Unit Tests (REAL PRODUCTION CODE)
 * Tests for server/src/services/initiativeService.ts
 * 
 * This test imports the REAL production service and uses its setDependencies() for DI.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Use vi.hoisted() for mocks that need to be accessed in vi.mock factories
const { mockDb, mockLogger } = vi.hoisted(() => ({
    mockDb: {
        run: vi.fn(),
        get: vi.fn(),
        all: vi.fn(),
    },
    mockLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../../../server/src/database/Database.js', () => ({
    getDatabase: () => Promise.resolve(mockDb),
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
    default: mockLogger,
}));

// Import REAL production service
import { InitiativeService } from '../../../../server/src/services/initiativeService.js';

describe('InitiativeService - Real Production Tests', () => {
    let service: InitiativeService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.run.mockResolvedValue({ lastID: 1, changes: 1 });
        mockDb.get.mockResolvedValue(null);
        mockDb.all.mockResolvedValue([]);

        // Create a new service instance for each test
        service = new InitiativeService();
        // Inject mock database
        service.setDependencies({
            db: mockDb as any,
            uuidv4: () => 'test-uuid-12345',
        });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Service Structure', () => {
        it('should have all subservices initialized', () => {
            expect(service.definition).toBeDefined();
            expect(service.progress).toBeDefined();
            expect(service.financial).toBeDefined();
            expect(service.risk).toBeDefined();
        });

        it('should accept dependency injection via setDependencies', () => {
            const customDb = { run: vi.fn(), get: vi.fn(), all: vi.fn() };
            const customUuid = () => 'custom-uuid';

            expect(() => {
                service.setDependencies({ db: customDb as any, uuidv4: customUuid });
            }).not.toThrow();
        });
    });

    describe('getInitiatives', () => {
        it('should call definition.getInitiatives with correct params', async () => {
            const spy = vi.spyOn(service.definition, 'getInitiatives').mockResolvedValue([]);

            await service.getInitiatives('org-123', 10, 0);

            expect(spy).toHaveBeenCalledWith('org-123', 10, 0);
        });

        it('should return initiatives from definition service', async () => {
            const mockInitiatives = [
                { id: 'init-1', title: 'Initiative 1' },
                { id: 'init-2', title: 'Initiative 2' },
            ];
            vi.spyOn(service.definition, 'getInitiatives').mockResolvedValue(mockInitiatives as any);

            const result = await service.getInitiatives('org-123');

            expect(result).toEqual(mockInitiatives);
            expect(result).toHaveLength(2);
        });
    });

    describe('getInitiativeById', () => {
        it('should return null for non-existent initiative', async () => {
            vi.spyOn(service.definition, 'getInitiativeById').mockResolvedValue(null);

            const result = await service.getInitiativeById('non-existent');

            expect(result).toBeNull();
        });

        it('should return initiative when found', async () => {
            const mockInitiative = {
                id: 'init-123',
                title: 'Test Initiative',
                status: 'active',
            };
            vi.spyOn(service.definition, 'getInitiativeById').mockResolvedValue(mockInitiative as any);

            const result = await service.getInitiativeById('init-123');

            expect(result).toEqual(mockInitiative);
            expect(result?.title).toBe('Test Initiative');
        });
    });

    describe('createInitiative', () => {
        const createData = {
            title: 'New Initiative',
            organization_id: 'org-123',
            project_id: 'project-456',
            owner_id: 'user-789',
            summary: 'Test summary',
            start_date: '2026-02-01',
            end_date: '2026-06-30',
        };

        it('should call definition.createInitiative', async () => {
            const spy = vi.spyOn(service.definition, 'createInitiative').mockResolvedValue({
                id: 'init-new',
                ...createData,
            } as any);

            await service.createInitiative(createData);

            expect(spy).toHaveBeenCalledWith(createData);
        });

        it('should return created initiative', async () => {
            vi.spyOn(service.definition, 'createInitiative').mockResolvedValue({
                id: 'init-new',
                ...createData,
                created_at: '2026-01-23T00:00:00.000Z',
            } as any);

            const result = await service.createInitiative(createData);

            expect(result.id).toBe('init-new');
            expect(result.title).toBe('New Initiative');
        });
    });

    describe('updateInitiative', () => {
        it('should return true on successful update', async () => {
            vi.spyOn(service.definition, 'updateInitiative').mockResolvedValue(true);

            const result = await service.updateInitiative('init-123', { title: 'New Title' });

            expect(result).toBe(true);
        });

        it('should return false on failed update', async () => {
            vi.spyOn(service.definition, 'updateInitiative').mockResolvedValue(false);

            const result = await service.updateInitiative('non-existent', { title: 'New Title' });

            expect(result).toBe(false);
        });
    });

    describe('deleteInitiative', () => {
        it('should return true on successful delete', async () => {
            vi.spyOn(service.definition, 'deleteInitiative').mockResolvedValue(true);

            const result = await service.deleteInitiative('init-123');

            expect(result).toBe(true);
        });
    });

    describe('recalculateProgress', () => {
        it('should accept string parameter (legacy)', async () => {
            const spy = vi.spyOn(service.progress, 'recalculateProgress').mockResolvedValue(75);

            await service.recalculateProgress('init-123');

            expect(spy).toHaveBeenCalledWith('init-123', undefined);
        });

        it('should accept object parameter (new API)', async () => {
            const spy = vi.spyOn(service.progress, 'recalculateProgress').mockResolvedValue(85);

            await service.recalculateProgress({
                organizationId: 'org-123',
                initiativeId: 'init-456',
            });

            expect(spy).toHaveBeenCalledWith('init-456', 'org-123');
        });

        it('should return calculated progress percentage', async () => {
            vi.spyOn(service.progress, 'recalculateProgress').mockResolvedValue(50);

            const result = await service.recalculateProgress('init-123');

            expect(result).toBe(50);
        });
    });

    describe('updateFinancials', () => {
        it('should call financial.updateFinancials with all params', async () => {
            const spy = vi.spyOn(service.financial, 'updateFinancials').mockResolvedValue(true);

            await service.updateFinancials('init-123', 100000, 20000, 0.25);

            expect(spy).toHaveBeenCalledWith('init-123', 100000, 20000, 0.25);
        });

        it('should return true on successful update', async () => {
            vi.spyOn(service.financial, 'updateFinancials').mockResolvedValue(true);

            const result = await service.updateFinancials('init-123', 50000, 10000, 0.15);

            expect(result).toBe(true);
        });
    });

    describe('getFinancialStats', () => {
        it('should return financial statistics', async () => {
            const mockStats = {
                totalCapex: 750000,
                totalOpex: 150000,
                averageRoi: 0.18,
                initiativeCount: 10,
            };
            vi.spyOn(service.financial, 'getFinancialStats').mockResolvedValue(mockStats);

            const result = await service.getFinancialStats('org-123');

            expect(result.totalCapex).toBe(750000);
            expect(result.initiativeCount).toBe(10);
        });
    });
});
