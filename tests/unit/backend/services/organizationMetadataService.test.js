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

let organizationMetadataService;

describe('OrganizationMetadataService', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        
        const module = await import('../../../../server/src/services/organizationMetadataService.js');
        organizationMetadataService = module.default || module;

        if (organizationMetadataService.setDependencies) {
            organizationMetadataService.setDependencies({
                db: mocks.db,
                logger: mocks.logger
            });
        }
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getMetadata', () => {
        it('should return metadata for an organization', async () => {
            const mockMeta = [{ key: 'plan', value: 'pro' }];
            mocks.db.all.mockResolvedValueOnce(mockMeta);

            const result = await organizationMetadataService.getMetadata('org-1');

            expect(mocks.db.all).toHaveBeenCalled();
            expect(result).toEqual(mockMeta);
        });
    });

    describe('setMetadata', () => {
        it('should insert or update metadata', async () => {
            mocks.db.run.mockResolvedValueOnce({ changes: 1 });

            await organizationMetadataService.setMetadata('org-1', 'region', 'EU');

            expect(mocks.db.run).toHaveBeenCalledWith(
                expect.stringContaining('INSERT INTO organization_metadata'),
                expect.arrayContaining(['org-1', 'region', 'EU'])
            );
        });
    });
});
