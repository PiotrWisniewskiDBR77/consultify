import { describe, it, expect, vi, beforeEach, beforeAll, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Project Quota Middleware (Integration)', () => {
    let req, res, next;
    let enforceProjectQuota;
    let db;
    const tempFilePath = path.join('/tmp', `testfile-${Date.now()}`);

    beforeAll(async () => {
        // Load Database Once
        const dbModule = await import('../../../../server/database.js');
        db = dbModule.default || dbModule;
        await db.initPromise;

        // Load Middleware
        const mod = await import('../../../../server/middleware/projectQuotaMiddleware.js');
        enforceProjectQuota = mod.default || mod;
    });

    beforeEach(async () => {
        // Create dummy file for testing cleanup
        try { fs.writeFileSync(tempFilePath, 'dummy content'); } catch (e) { }

        req = {
            body: { project_id: 'proj-quota-test' },
            query: {}, // Initialize query
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
    });

    const setupProject = async (limitGB, usedBytes) => {
        // Ensure org exists
        await new Promise(resolve =>
            db.run('INSERT OR IGNORE INTO organizations (id, name) VALUES (?, ?)', ['org-quota', 'Quota Org'], resolve)
        );

        // Delete existing project
        await new Promise(resolve => db.run('DELETE FROM projects WHERE id = ?', ['proj-quota-test'], resolve));

        // Insert project
        await new Promise(resolve => {
            db.run(`INSERT INTO projects(id, organization_id, name, storage_limit_gb, storage_used_bytes)
                    VALUES(?, ?, ?, ?, ?)`,
                ['proj-quota-test', 'org-quota', 'Test Project', limitGB, usedBytes], resolve);
        });
    };

    it('should skip check if no project_id provided', async () => {
        req.body = {};
        await enforceProjectQuota(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should allow request if quota is sufficient', async () => {
        await setupProject(10, 5 * 1024 * 1024 * 1024); // 10GB limit, 5GB used

        await enforceProjectQuota(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow request if limit is NULL (unlimited)', async () => {
        await setupProject(null, 500 * 1024 * 1024 * 1024); // Unlimited, 500GB used

        await enforceProjectQuota(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    it('should block 429 if quota exceeded', async () => {
        await setupProject(10, 11 * 1024 * 1024 * 1024); // 10GB limit, 11GB used

        await enforceProjectQuota(req, res, next);

        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'PROJECT_STORAGE_EXCEEDED',
            usage: expect.any(Object)
        }));
        expect(next).not.toHaveBeenCalled();
    });

    it('should cleanup temp file if quota exceeded', async () => {
        await setupProject(1, 2 * 1024 * 1024 * 1024); // 1GB limit, 2GB used

        await enforceProjectQuota(req, res, next);

        // Verify file is gone
        expect(fs.existsSync(tempFilePath)).toBe(false);
    });

    it('should handle errors gracefully (e.g. project not found)', async () => {
        req.body.project_id = 'non-existent-project';

        await enforceProjectQuota(req, res, next);

        // usageService throws "Project not found", caught by middleware -> 500
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Failed to verify project quota' }));
    });
});
