import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('PlanLimits Middleware', () => {
    let req, res, next;
    let checkPlanLimit;
    let db;

    beforeEach(async () => {
        // Load Database (Singleton)
        const dbModule = await import('../../../../server/database.js');
        db = dbModule.default || dbModule;
        await db.initPromise;

        // Import middleware (Shares same DB instance due to module cache)
        const mod = await import('../../../../server/middleware/planLimits.js');
        checkPlanLimit = mod.checkPlanLimit;

        req = {
            user: { organizationId: 'org-test-plan' },
            body: {}
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn()
        };
        next = vi.fn();

        // Clean DB tables
        await new Promise(r => db.run('DELETE FROM organizations WHERE id = ?', ['org-test-plan'], r));
        await new Promise(r => db.run('DELETE FROM users WHERE organization_id = ?', ['org-test-plan'], r));
        await new Promise(r => db.run('DELETE FROM projects WHERE organization_id = ?', ['org-test-plan'], r));
    });

    const setupOrg = async (plan, status = 'active') => {
        await new Promise((resolve, reject) => {
            db.run('INSERT OR REPLACE INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                ['org-test-plan', 'Test Org', plan, status], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
        });
    };

    const setProjectCount = async (count) => {
        await new Promise((resolve, reject) => db.run('DELETE FROM projects WHERE organization_id = ?', ['org-test-plan'], (err) => {
            if (err) reject(err); else resolve();
        }));

        for (let i = 0; i < count; i++) {
            await new Promise((resolve, reject) => {
                db.run('INSERT INTO projects (id, organization_id, name) VALUES (?, ?, ?)',
                    [`proj-${i}`, 'org-test-plan', `Project ${i}`], (err) => {
                        if (err) reject(err); else resolve();
                    });
            });
        }
    };

    it('should return 403 if no organization found in user', async () => {
        req.user.organizationId = null;
        const middleware = checkPlanLimit('max_projects');
        await middleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should return 404 if organization does not exist in DB', async () => {
        // Ensure DB is clean/org missing
        await new Promise(resolve => db.run('DELETE FROM organizations WHERE id = ?', ['org-test-plan'], resolve));

        const middleware = checkPlanLimit('max_projects');
        await middleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should allow request if within limit (Free plan)', async () => {
        await setupOrg('free');
        await setProjectCount(0); // Limit is 1

        const middleware = checkPlanLimit('max_projects');
        await middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should block request if limit reached (Free plan)', async () => {
        await setupOrg('free');
        await setProjectCount(1); // Limit is 1. If we have 1, we can't create another?
        // Code checks: if (currentCount >= limitValue)
        // If limit is 1, and we have 1 project. creating another makes 2.
        // Usually checked BEFORE creation. "You have 1, limit 1. Block."

        const middleware = checkPlanLimit('max_projects');
        await middleware(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('Plan limit reached') }));
    });

    it('should allow request if within limit (Pro plan)', async () => {
        await setupOrg('pro');
        await setProjectCount(5); // Limit 10

        const middleware = checkPlanLimit('max_projects');
        await middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should treat trial status as pro plan', async () => {
        await setupOrg('free', 'trial'); // Status is trial, so should be Pro
        await setProjectCount(5); // Limit 10 (Pro), 1 (Free). Should pass.

        const middleware = checkPlanLimit('max_projects');
        await middleware(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    it('should handle undefined limits gracefully (warn and allow)', async () => {
        await setupOrg('free');
        const middleware = checkPlanLimit('unknown_limit_key');

        const consoleSpy = vi.spyOn(console, 'warn');
        await middleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalled();
    });

    it('should check max_members limit', async () => {
        await setupOrg('free'); // Limit 1

        // Add users
        const orgId = 'org-test-plan';
        try {
            await new Promise((resolve, reject) => db.run('INSERT INTO users (id, organization_id, email, password, role) VALUES (?, ?, ?, ?, ?)', ['u1', orgId, 'u1@test.com', 'pass', 'USER'], function (err) {
                if (err) reject(err); else resolve();
            }));
            await new Promise((resolve, reject) => db.run('INSERT INTO users (id, organization_id, email, password, role) VALUES (?, ?, ?, ?, ?)', ['u2', orgId, 'u2@test.com', 'pass', 'USER'], function (err) {
                if (err) reject(err); else resolve();
            }));

            // Verify count in test
            await new Promise((resolve, reject) => db.get('SELECT COUNT(*) as c FROM users', (err, row) => err ? reject(err) : resolve(row)));
        } catch (e) {
            throw e;
        }

        // Current users = 2. Limit = 1.

        const middleware = checkPlanLimit('max_members');
        await middleware(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
    });
});
