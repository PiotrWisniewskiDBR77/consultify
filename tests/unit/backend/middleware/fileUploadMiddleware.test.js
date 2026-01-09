/**
 * File Upload Middleware Test
 * 
 * Tests for file upload validation middleware.
 * 
 * @module tests/unit/backend/middleware/fileUploadMiddleware.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create file upload middleware
const createFileUploadMiddleware = (options = {}) => {
    const {
        maxSize = 5 * 1024 * 1024, // 5MB
        allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'],
        maxFiles = 10
    } = options;

    return (req, res, next) => {
        // Skip if no files
        if (!req.files && !req.file) {
            return next();
        }

        const files = req.files || [req.file];

        // Check number of files
        if (files.length > maxFiles) {
            return res.status(400).json({
                error: 'Too many files',
                code: 'TOO_MANY_FILES',
                maxFiles,
                uploadedFiles: files.length
            });
        }

        for (const file of files) {
            // Check file size
            if (file.size > maxSize) {
                return res.status(400).json({
                    error: 'File too large',
                    code: 'FILE_TOO_LARGE',
                    filename: file.originalname,
                    maxSize,
                    fileSize: file.size
                });
            }

            // Check file type
            if (!allowedTypes.includes(file.mimetype)) {
                return res.status(400).json({
                    error: 'Invalid file type',
                    code: 'INVALID_FILE_TYPE',
                    filename: file.originalname,
                    mimetype: file.mimetype,
                    allowedTypes
                });
            }

            // Check for malicious patterns in filename
            if (/\.\.|\/|\\/.test(file.originalname)) {
                return res.status(400).json({
                    error: 'Invalid filename',
                    code: 'INVALID_FILENAME',
                    message: 'Filename contains invalid characters'
                });
            }
        }

        return next();
    };
};

describe('File Upload Middleware', () => {
    let middleware;
    let mockReq;
    let mockRes;
    let mockNext;

    beforeEach(() => {
        middleware = createFileUploadMiddleware();

        mockReq = {
            file: {
                originalname: 'test.jpg',
                mimetype: 'image/jpeg',
                size: 1024 * 1024 // 1MB
            }
        };

        mockRes = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnThis()
        };

        mockNext = vi.fn();
    });

    describe('Valid Files', () => {
        it('should allow valid image upload', () => {
            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow PDF upload', () => {
            mockReq.file.mimetype = 'application/pdf';
            mockReq.file.originalname = 'document.pdf';

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should skip when no files', () => {
            delete mockReq.file;

            middleware(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('File Size Validation', () => {
        it('should reject files over size limit', () => {
            mockReq.file.size = 10 * 1024 * 1024; // 10MB

            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'FILE_TOO_LARGE',
                    maxSize: 5 * 1024 * 1024
                })
            );
        });
    });

    describe('File Type Validation', () => {
        it('should reject disallowed file types', () => {
            mockReq.file.mimetype = 'application/x-executable';
            mockReq.file.originalname = 'malware.exe';

            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'INVALID_FILE_TYPE',
                    allowedTypes: expect.arrayContaining(['image/jpeg'])
                })
            );
        });
    });

    describe('Filename Validation', () => {
        it('should reject path traversal attempts', () => {
            mockReq.file.originalname = '../../../etc/passwd';

            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({ code: 'INVALID_FILENAME' })
            );
        });
    });

    describe('Multiple Files', () => {
        it('should reject too many files', () => {
            mockReq.files = Array(15).fill({
                originalname: 'test.jpg',
                mimetype: 'image/jpeg',
                size: 1024
            });
            delete mockReq.file;

            middleware(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'TOO_MANY_FILES',
                    maxFiles: 10
                })
            );
        });
    });
});
