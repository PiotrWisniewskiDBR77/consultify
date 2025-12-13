import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

describe('Quota Middleware (Integration)', () => {
    let req, res, next;
    let quotaMiddleware;
    let db;

    beforeAll(async () => {
        // Load Database Once
        const dbModule = await import('../../../../server/database.js');
        db = dbModule.default || dbModule;
        await db.initPromise;

        // Load Middleware
        quotaMiddleware = await import('../../../../server/middleware/quotaMiddleware.js');
    });

    beforeEach(async () => {
        vi.clearAllMocks();

        req = {
            user: { organizationId: 'org-quota-middleware-test', id: 'user-quota-test' },
            path: '/api/generate',
            body: { model: 'gpt-4' }
        };
        res = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn(),
            set: vi.fn()
        };
        next = vi.fn();
    });

    const setupBilling = async (tokenLimit = 1000, storageGB = 1, overageRate = 0) => {
        const orgId = 'org-quota-middleware-test';

        // 1. Create Org
        await new Promise(r => db.run('INSERT OR REPLACE INTO organizations (id, name) VALUES (?, ?)', [orgId, 'Test Org'], r));

        // 2. Create Plan
        const planId = `plan-quota-test-${Math.random()}`; // unique
        await new Promise(r => db.run(`
            INSERT INTO subscription_plans (id, name, price_monthly, token_limit, storage_limit_gb, token_overage_rate)
            VALUES (?, 'Test Plan', 10, ?, ?, ?)
        `, [planId, tokenLimit, storageGB, overageRate], r));

        // 3. Link Org to Billing
        await new Promise(r => db.run(`INSERT OR REPLACE INTO organization_billing (id, organization_id, subscription_plan_id) VALUES (?, ?, ?)`,
            [`bill-${orgId}`, orgId, planId], r));

        // 4. Clear Usage
        await new Promise(r => db.run('DELETE FROM usage_records WHERE organization_id = ?', [orgId], r));
    };

    const addTokenUsage = async (amount) => {
        const orgId = 'org-quota-middleware-test';
        await new Promise(r => db.run(`
            INSERT INTO usage_records (id, organization_id, type, amount, recorded_at)
            VALUES (?, ?, 'token', ?, datetime('now'))
        `, [`rec-${Math.random()}`, orgId, amount], r));
    };

    const addStorageUsage = async (bytes) => {
        const orgId = 'org-quota-middleware-test';
        await new Promise(r => db.run(`
            INSERT INTO usage_records (id, organization_id, type, amount, recorded_at)
            VALUES (?, ?, 'storage', ?, datetime('now'))
        `, [`rec-${Math.random()}`, orgId, bytes], r));
    };

    describe('enforceTokenQuota', () => {
        it('should return 401 if no orgId', async () => {
            req.user = undefined;
            await quotaMiddleware.enforceTokenQuota(req, res, next);
            expect(res.status).toHaveBeenCalledWith(401);
        });

        it('should allow if usage is below limit', async () => {
            await setupBilling(1000); // Limit 1000
            await addTokenUsage(500); // Used 500

            await quotaMiddleware.enforceTokenQuota(req, res, next);
            expect(next).toHaveBeenCalled();
            expect(req.quotaInfo).toBeDefined();
            expect(req.quotaInfo.allowed).toBe(true);
        });

        it('should block 429 if usage exceeds limit', async () => {
            await setupBilling(1000); // Limit 1000
            await addTokenUsage(1500); // Used 1500

            await quotaMiddleware.enforceTokenQuota(req, res, next);
            expect(res.status).toHaveBeenCalledWith(429);
            expect(next).not.toHaveBeenCalled();
        });

        it('should allow if overage is enabled even if exceeded', async () => {
            await setupBilling(1000, 1, 0.05); // Overage rate 0.05
            await addTokenUsage(1500); // Exceeded

            await quotaMiddleware.enforceTokenQuota(req, res, next);
            expect(next).toHaveBeenCalled(); // Should allow because tracked as overage
        });

        it('should set warning headers if > 80%', async () => {
            await setupBilling(1000);
            await addTokenUsage(850); // 85%

            await quotaMiddleware.enforceTokenQuota(req, res, next);
            expect(res.set).toHaveBeenCalledWith('X-Quota-Warning', 'true');
        });
    });

    describe('enforceStorageQuota', () => {
        it('should allow if allowed', async () => {
            await setupBilling(1000, 10); // 10 GB limit
            await addStorageUsage(5 * 1024 * 1024 * 1024); // 5 GB used

            await quotaMiddleware.enforceStorageQuota(req, res, next);
            expect(next).toHaveBeenCalled();
        });

        it('should block 429 if exceeded', async () => {
            await setupBilling(1000, 1); // 1 GB limit
            await addStorageUsage(2 * 1024 * 1024 * 1024); // 2 GB used

            await quotaMiddleware.enforceStorageQuota(req, res, next);
            expect(res.status).toHaveBeenCalledWith(429);
        });
    });

    describe('recordTokenUsageAfterResponse', () => {
        it('should insert usage record into DB', async () => {
            const orgId = 'org-quota-middleware-test';
            await setupBilling();

            await quotaMiddleware.recordTokenUsageAfterResponse(req, res, 123, 'completion');

            // Allow DB write to finish
            await new Promise(r => setTimeout(r, 50));

            const rows = await new Promise((resolve, reject) => {
                db.all('SELECT * FROM usage_records WHERE organization_id = ? AND type = "token" AND amount = 123', [orgId], (err, rows) => {
                    if (err) reject(err); else resolve(rows);
                });
            });

            expect(rows.length).toBeGreaterThan(0);
            expect(rows[0].action).toBe('completion');
        });
    });
});
