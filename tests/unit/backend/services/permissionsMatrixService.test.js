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
        }
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

let permissionsMatrixService;

describe('PermissionsMatrixService', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        
        const module = await import('../../../../server/src/services/permissionsMatrixService.js');
        permissionsMatrixService = module.default || module;

        if (permissionsMatrixService.setDependencies) {
            permissionsMatrixService.setDependencies({
                db: mocks.db,
                logger: mocks.logger
            });
        }
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getMatrix', () => {
        it('should return all role-permission mappings', async () => {
            const mockMatrix = [{ role_id: 'admin', permission_key: 'edit_users', enabled: 1 }];
            mocks.db.all.mockResolvedValueOnce(mockMatrix);

            const result = await permissionsMatrixService.getMatrix();

            expect(mocks.db.all).toHaveBeenCalled();
            expect(result).toEqual(mockMatrix);
        });
    });

    describe('togglePermission', () => {
        it('should update specific permission', async () => {
            mocks.db.run.mockResolvedValueOnce({ changes: 1 });

            await permissionsMatrixService.togglePermission('admin', 'delete_org', true);

            expect(mocks.db.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO role_permissions'),
                expect.arrayContaining(['admin', 'delete_org', 1])
            );
        });
    });
});
