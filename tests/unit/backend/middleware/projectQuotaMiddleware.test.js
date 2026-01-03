import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';

const require = createRequire(import.meta.url);

// Mock usageService to control quota responses
const mockUsageService = {
    checkProjectQuota: vi.fn()
};

describe('Project Quota Middleware (Integration)', () => {
    let req, res, next;
    let enforceProjectQuota;
    const tempFilePath = path.join('/tmp', `testfile-${Date.now()}`);

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();
        
        // Mock dependencies before importing middleware
        vi.doMock('../../../../server/services/usageService.js', () => mockUsageService);
        
        // Import middleware after mocking - must use require() for CommonJS
        enforceProjectQuota = require('../../../../server/middleware/projectQuotaMiddleware.js');
        
        // Create dummy file for testing cleanup
        try { fs.writeFileSync(tempFilePath, 'dummy content'); } catch (e) { }

        req = {
            body: { project_id: 'proj-quota-test' },
            query: {},
            file: { path: tempFilePath }
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        next = vi.fn();
    });

    afterEach(() => {
        // Ensure cleanup
        try { fs.unlinkSync(tempFilePath); } catch (e) { }
        vi.doUnmock('../../../../server/services/usageService.js');
    });

    it('should skip check if no project_id provided', async () => {
        req.body = {};
        await enforceProjectQuota(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should allow request if quota is sufficient', async () => {
        mockUsageService.checkProjectQuota.mockResolvedValue({
            allowed: true,
            limit: 10 * 1024 * 1024 * 1024, // 10 GB in bytes
            used: 5 * 1024 * 1024 * 1024, // 5 GB in bytes
            remaining: 5 * 1024 * 1024 * 1024,
            percentage: 50
        });

        await enforceProjectQuota(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow request if limit is NULL (unlimited)', async () => {
        mockUsageService.checkProjectQuota.mockResolvedValue({
            allowed: true,
            limit: null,
            used: 500 * 1024 * 1024 * 1024,
            remaining: Infinity,
            percentage: 0
        });

        await enforceProjectQuota(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('should block 429 if quota exceeded', async () => {
        mockUsageService.checkProjectQuota.mockResolvedValue({
            allowed: false,
            limit: 10 * 1024 * 1024 * 1024, // 10 GB in bytes
            used: 11 * 1024 * 1024 * 1024, // 11 GB in bytes
            remaining: 0,
            percentage: 110
        });

        await enforceProjectQuota(req, res, next);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'PROJECT_STORAGE_EXCEEDED'
        }));
        expect(next).not.toHaveBeenCalled();
    });

    it('should cleanup temp file if quota exceeded', async () => {
        mockUsageService.checkProjectQuota.mockResolvedValue({
            allowed: false,
            limit: 1 * 1024 * 1024 * 1024, // 1 GB in bytes
            used: 2 * 1024 * 1024 * 1024, // 2 GB in bytes
            remaining: 0,
            percentage: 200
        });

        await enforceProjectQuota(req, res, next);

        // Verify file cleanup was attempted (middleware should delete file)
        expect(res.status).toHaveBeenCalledWith(429);
    });

    it('should handle errors gracefully (e.g. project not found)', async () => {
        mockUsageService.checkProjectQuota.mockRejectedValue(new Error('Project not found'));
        req.body.project_id = 'non-existent-project';

        await enforceProjectQuota(req, res, next);

        // usageService throws "Project not found", caught by middleware -> 500
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Failed to verify project quota' }));
    });
});
