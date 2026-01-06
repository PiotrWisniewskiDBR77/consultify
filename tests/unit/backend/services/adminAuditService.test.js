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

let adminAuditService;

describe('AdminAuditService', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        
        const module = await import('../../../../server/src/services/adminAuditService.js');
        adminAuditService = module.default || module;

        if (adminAuditService.setDependencies) {
            adminAuditService.setDependencies({
                db: mocks.db,
                uuidv4: mocks.uuid,
                logger: mocks.logger
            });
        }
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('calculateRiskScore', () => {
        it('should return high score for delete_organization', () => {
            const score = adminAuditService.calculateRiskScore('delete_organization');
            expect(score).toBeGreaterThanOrEqual(80);
        });

        it('should return low score for view_data', () => {
            const score = adminAuditService.calculateRiskScore('view_data');
            expect(score).toBeLessThan(30);
        });
    });

    describe('getRiskLevel', () => {
        it('should return critical for score >= 80', () => {
            expect(adminAuditService.getRiskLevel(85)).toBe('critical');
        });
    });

    describe('logAction', () => {
        it('should insert audit log into database', async () => {
            const data = { adminId: 'a1', actionType: 'create_user' };
            mocks.db.run.mockResolvedValueOnce({ changes: 1 });

            await adminAuditService.logAction(data);

            expect(mocks.db.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO admin_audit_logs'),
                expect.any(Array)
            );
        });
    });

    describe('getLogs', () => {
        it('should return paginated logs', async () => {
            mocks.db.all.mockResolvedValueOnce([{ id: '1' }]);
            const result = await adminAuditService.getLogs({ limit: 10, offset: 0 });
            expect(result).toHaveLength(1);
        });
    });
});
