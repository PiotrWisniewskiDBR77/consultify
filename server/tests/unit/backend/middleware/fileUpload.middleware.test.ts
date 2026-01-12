/**
 * File Upload Middleware Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 * ETAP 10.4: Testy dla Middleware - 95%+ coverage
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fileFilter, upload } from '../../../../src/middleware/fileUpload.middleware.js';

describe('File Upload Middleware', () => {
    let mockReq: Partial<{ user?: { organizationId?: string } }>;
    let mockFile: Partial<Express.Multer.File>;
    let mockCallback: (error: Error | null, acceptFile: boolean) => void;

    beforeEach(() => {
        mockFile = {
            originalname: 'test.pdf',
            mimetype: 'application/pdf',
        };
        mockCallback = vi.fn();
    });

    describe('fileFilter', () => {
        it('should accept PDF files', () => {
            fileFilter(mockReq as any, mockFile as Express.Multer.File, mockCallback);

            expect(mockCallback).toHaveBeenCalledWith(null, true);
        });

        it('should accept Excel files', () => {
            mockFile.originalname = 'test.xlsx';
            mockFile.mimetype = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            fileFilter(mockReq as any, mockFile as Express.Multer.File, mockCallback);

            expect(mockCallback).toHaveBeenCalledWith(null, true);
        });

        it('should accept Word files', () => {
            mockFile.originalname = 'test.docx';
            mockFile.mimetype = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            fileFilter(mockReq as any, mockFile as Express.Multer.File, mockCallback);

            expect(mockCallback).toHaveBeenCalledWith(null, true);
        });

        it('should reject unsupported file types', () => {
            mockFile.originalname = 'test.exe';
            mockFile.mimetype = 'application/x-msdownload';
            fileFilter(mockReq as any, mockFile as Express.Multer.File, mockCallback);

            expect(mockCallback).toHaveBeenCalledWith(expect.any(Error), false);
        });

        it('should reject files with wrong extension', () => {
            mockFile.originalname = 'test.txt';
            mockFile.mimetype = 'text/plain';
            fileFilter(mockReq as any, mockFile as Express.Multer.File, mockCallback);

            expect(mockCallback).toHaveBeenCalledWith(expect.any(Error), false);
        });
    });

    describe('upload middleware', () => {
        it('should be configured with correct limits', () => {
            expect(upload).toBeDefined();
            expect(upload.limits).toBeDefined();
            expect(upload.limits?.fileSize).toBe(10 * 1024 * 1024); // 10MB
            expect(upload.limits?.files).toBe(1);
        });

        it('should have storage configured', () => {
            expect(upload.storage).toBeDefined();
        });

        it('should have fileFilter configured', () => {
            expect(upload.fileFilter).toBeDefined();
        });
    });
});

