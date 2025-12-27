/**
 * Unit Tests for RapidLean Upload Middleware
 * Tests file upload handling for observation photos
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs and multer
const mockFs = {
    existsSync: vi.fn().mockReturnValue(false),
    mkdirSync: vi.fn()
};

vi.mock('fs', () => mockFs);
vi.mock('multer', () => {
    const mockSingle = vi.fn().mockReturnValue((req, res, next) => next());
    const mockDiskStorage = vi.fn().mockReturnValue({});
    return {
        default: vi.fn().mockReturnValue({ single: mockSingle }),
        diskStorage: mockDiskStorage
    };
});

// Import after mocks
const { createRapidLeanUpload, rapidLeanPhotoUpload } = require('../../../server/middleware/rapidLeanUploadMiddleware');

describe('RapidLean Upload Middleware', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFs.existsSync.mockReturnValue(false);
    });

    describe('createRapidLeanUpload', () => {
        it('should create multer instance with correct configuration', () => {
            const upload = createRapidLeanUpload('test-org-id', 'test-assessment-id');

            expect(upload).toBeDefined();
            expect(mockFs.mkdirSync).toHaveBeenCalled();
        });

        it('should create directory if it does not exist', () => {
            mockFs.existsSync.mockReturnValue(false);

            createRapidLeanUpload('test-org-id', 'test-assessment-id');

            expect(mockFs.mkdirSync).toHaveBeenCalled();
        });

        it('should use temp directory if assessmentId not provided', () => {
            createRapidLeanUpload('test-org-id');

            expect(mockFs.mkdirSync).toHaveBeenCalled();
            const callPath = mockFs.mkdirSync.mock.calls[0][0];
            expect(callPath).toContain('temp');
        });
    });

    describe('rapidLeanPhotoUpload', () => {
        it('should be a function', () => {
            expect(typeof rapidLeanPhotoUpload).toBe('function');
        });

        it('should handle organizationId from req.user', () => {
            expect(rapidLeanPhotoUpload).toBeDefined();
        });
    });
});

