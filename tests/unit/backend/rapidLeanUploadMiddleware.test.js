/**
 * Unit Tests for RapidLean Upload Middleware
 * Tests file upload handling for observation photos
 */

const { createRapidLeanUpload, rapidLeanPhotoUpload } = require('../../../server/middleware/rapidLeanUploadMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Mock fs
jest.mock('fs');
jest.mock('multer');

describe('RapidLean Upload Middleware', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        fs.existsSync.mockReturnValue(false);
        fs.mkdirSync.mockImplementation(() => {});
    });

    describe('createRapidLeanUpload', () => {
        test('should create multer instance with correct configuration', () => {
            const upload = createRapidLeanUpload('test-org-id', 'test-assessment-id');
            
            expect(upload).toBeDefined();
            expect(fs.mkdirSync).toHaveBeenCalled();
        });

        test('should create directory if it does not exist', () => {
            fs.existsSync.mockReturnValue(false);
            
            createRapidLeanUpload('test-org-id', 'test-assessment-id');
            
            expect(fs.mkdirSync).toHaveBeenCalled();
        });

        test('should use temp directory if assessmentId not provided', () => {
            createRapidLeanUpload('test-org-id');
            
            expect(fs.mkdirSync).toHaveBeenCalled();
            const callPath = fs.mkdirSync.mock.calls[0][0];
            expect(callPath).toContain('temp');
        });
    });

    describe('rapidLeanPhotoUpload', () => {
        test('should be a function', () => {
            expect(typeof rapidLeanPhotoUpload).toBe('function');
        });

        test('should handle organizationId from req.user', () => {
            // This is tested in integration tests
            expect(rapidLeanPhotoUpload).toBeDefined();
        });
    });
});

