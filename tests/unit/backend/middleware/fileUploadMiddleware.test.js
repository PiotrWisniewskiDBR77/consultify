import { describe, it, expect, vi } from 'vitest';
import { fileFilter } from '../../../../server/middleware/fileUploadMiddleware';

describe('File Upload Middleware', () => {
    describe('fileFilter', () => {
        const mockCb = vi.fn();

        it('should accept PDF files', () => {
            const file = { originalname: 'test.pdf', mimetype: 'application/pdf' };
            fileFilter({}, file, mockCb);
            expect(mockCb).toHaveBeenCalledWith(null, true);
        });

        it('should accept Excel files', () => {
            const file = { originalname: 'sheet.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
            fileFilter({}, file, mockCb);
            expect(mockCb).toHaveBeenCalledWith(null, true);
        });

        it('should accept Word files', () => {
            const file = { originalname: 'doc.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
            fileFilter({}, file, mockCb);
            expect(mockCb).toHaveBeenCalledWith(null, true);
        });

        it('should reject invalid extensions', () => {
            const file = { originalname: 'script.js', mimetype: 'application/javascript' };
            fileFilter({}, file, mockCb);
            expect(mockCb).toHaveBeenCalledWith(expect.any(Error));
            const error = mockCb.mock.calls[mockCb.mock.calls.length - 1][0];
            expect(error.message).toContain('Only PDF, Excel, and Word documents are allowed');
        });

        it('should reject invalid mimetypes for valid extensions', () => {
            // Spoofing attempt
            const file = { originalname: 'malicious.pdf', mimetype: 'application/x-executable' };
            fileFilter({}, file, mockCb);
            expect(mockCb).toHaveBeenCalledWith(expect.any(Error));
        });
    });
});
