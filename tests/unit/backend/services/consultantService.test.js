/**
 * Consultant Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockDb } from '../../../helpers/mockDb.js';

// Mock dependencies using hoisted to ensure they are available for top-level module imports
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
        uuid: vi.fn(() => 'test-uuid-123'),
        accessCode: {
            generateCode: vi.fn().mockResolvedValue({ code: 'MOCK-CODE-123' })
        }
    };
});

// Mock the modules
vi.mock('../../../../server/src/database/Database.js', () => ({
    getDatabase: () => mocks.db
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
    default: mocks.logger,
    _logger: mocks.logger
}));

vi.mock('uuid', () => ({
    v4: mocks.uuid
}));

vi.mock('../../../../server/src/services/accessCodeService.js', () => ({
    default: mocks.accessCode,
    ...mocks.accessCode
}));

let consultantService;

describe('ConsultantService', () => {
    beforeEach(async () => {
        vi.clearAllMocks();

        // Import service
        const module = await import('../../../../server/src/services/consultantService.js');
        consultantService = module.default || module;

        // Set dependencies for testing
        if (consultantService.setDependencies) {
        consultantService.setDependencies({
                db: mocks.db,
                uuidv4: mocks.uuid
        });
        }
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('getConsultantProfile()', () => {
        it('should retrieve consultant profile by user ID', async () => {
            const userId = 'user-123';
            const mockRecord = {
                id: 'consultant-456',
                display_name: 'John Consultant',
                status: 'active',
                created_at: '2024-01-01T00:00:00Z'
            };

            mocks.db.get.mockResolvedValueOnce(mockRecord);

            const result = await consultantService.getConsultantProfile(userId);

            expect(mocks.db.get).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM consultants WHERE id = ?'),
                [userId]
            );
            expect(result).toEqual({
                id: 'consultant-456',
                displayName: 'John Consultant',
                status: 'active',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: undefined
            });
        });

        it('should return null when user is not a consultant', async () => {
            const userId = 'regular-user';
            mocks.db.get.mockResolvedValueOnce(null);

            const result = await consultantService.getConsultantProfile(userId);
            expect(result).toBeNull();
        });
    });

    describe('registerConsultant()', () => {
        it('should register a new consultant', async () => {
            const userId = 'user-123';
            const displayName = 'John Doe Consultant';

            // 1. Check if user already a consultant -> null
            mocks.db.get.mockResolvedValueOnce(null);
            // 2. Insert new consultant -> success
            mocks.db.run.mockResolvedValueOnce({ lastID: 'user-123', changes: 1 });
            // 3. Get created profile -> return profile
            mocks.db.get.mockResolvedValueOnce({
                id: 'user-123',
                display_name: displayName,
                status: 'active'
            });

            const result = await consultantService.registerConsultant(userId, displayName);

            expect(result.displayName).toBe(displayName);
            expect(mocks.db.run).toHaveBeenCalled();
        });

        it('should update if user is already a consultant (UPSERT)', async () => {
            const userId = 'existing-consultant';
            mocks.db.run.mockResolvedValueOnce({ lastID: userId, changes: 1 });

            const result = await consultantService.registerConsultant(userId, 'New Name');

            expect(result.id).toBe(userId);
            expect(result.displayName).toBe('New Name');
            expect(mocks.db.run).toHaveBeenCalledWith(
                expect.stringContaining('ON CONFLICT(id) DO UPDATE'),
                expect.any(Array)
            );
        });
    });

    describe('getLinkedOrganizations()', () => {
        it('should retrieve organizations linked to a consultant', async () => {
            const consultantId = 'consultant-123';
            const mockLinks = [
                {
                    id: 'org-1',
                    name: 'Test Org 1',
                    status: 'active',
                    link_id: 'link-1',
                    link_status: 'active',
                    linked_at: '2024-01-01T00:00:00Z'
                }
            ];

            mocks.db.all.mockResolvedValueOnce(mockLinks);

            const result = await consultantService.getLinkedOrganizations(consultantId);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('org-1');
            expect(mocks.db.all).toHaveBeenCalled();
        });
    });

    describe('createInvite()', () => {
        it('should create a trial organization invite', async () => {
            const params = {
                consultantId: 'consultant-123',
                type: 'TRIAL_ORG',
                targetCompanyName: 'New Corp'
            };

            // Setup mock result from accessCodeService
            mocks.accessCode.generateCode.mockResolvedValueOnce({
                id: 'code-id-123',
                code: 'MOCK-CODE-123',
                expiresAt: '2025-01-01',
                maxUses: 1
            });

            const result = await consultantService.createInvite(params);

            expect(result).toBeDefined();
            expect(result.code).toBe('MOCK-CODE-123');
            expect(mocks.accessCode.generateCode).toHaveBeenCalledWith(expect.objectContaining({
                type: 'TRIAL',
                createdByConsultantId: params.consultantId
            }));
        });
    });
});
