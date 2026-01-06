import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Define mocks
const mocks = vi.hoisted(() => {
    return {
        db: {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn()
        },
        logger: {
            info: vi.fn(),
            error: vi.fn(),
            warn: vi.fn(),
            debug: vi.fn()
        },
        uuid: vi.fn(() => 'mock-uuid-1234')
    };
});

// Mock modules
vi.mock('../../../../server/src/database/Database.js', () => ({
    getDatabase: () => mocks.db,
    default: mocks.db
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
    default: mocks.logger
}));

vi.mock('uuid', () => ({
    v4: mocks.uuid
}));

let threatIntelligenceService;

describe('ThreatIntelligenceService', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        
        const module = await import('../../../../server/src/services/threatIntelligenceService.js');
        threatIntelligenceService = module.default || module;

        if (threatIntelligenceService.setDependencies) {
            threatIntelligenceService.setDependencies({
                db: mocks.db,
                uuidv4: mocks.uuid,
                logger: mocks.logger
            });
        }
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getThreats', () => {
        it('should return all threats', async () => {
            const mockThreats = [{ id: '1', indicator: '1.2.3.4' }];
            mocks.db.all.mockResolvedValueOnce(mockThreats);

            const result = await threatIntelligenceService.getThreats();

            expect(mocks.db.all).toHaveBeenCalled();
            expect(result).toEqual(mockThreats);
        });
    });

    describe('checkIPReputation', () => {
        it('should return reputation for an IP', async () => {
            mocks.db.get.mockResolvedValueOnce({ indicator: '1.2.3.4', severity: 'high', is_blocked: 1 });

            const result = await threatIntelligenceService.checkIPReputation('1.2.3.4');

            expect(result.ip).toBe('1.2.3.4');
            expect(result.score).toBeGreaterThan(80);
            expect(result.isBlocked).toBe(true);
        });
    });

    describe('blockThreat', () => {
        it('should mark threat as blocked', async () => {
            mocks.db.run.mockResolvedValueOnce({ changes: 1 });

            const result = await threatIntelligenceService.blockThreat('t1');

            expect(result).toBe(true);
            expect(mocks.db.run).toHaveBeenCalledWith(
                expect.stringContaining('is_blocked = 1'),
                ['t1']
            );
        });
    });
});
