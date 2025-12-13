import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('AuditLog Middleware', () => {
    let req, res, next;
    let auditLogMiddleware;
    let db;

    beforeEach(async () => {
        vi.resetModules();
        vi.unstubAllGlobals(); // Ensure everything is clean

        // Load Database
        const dbModule = await import('../../../../server/database.js');
        db = dbModule.default || dbModule;
        await db.initPromise;

        // Clean activity_logs table
        await new Promise((resolve) => db.run('DELETE FROM activity_logs', resolve));

        // Load middleware (it uses real ActivityService -> real DB)
        const mod = await import('../../../../server/middleware/auditLog.js');
        auditLogMiddleware = mod.default || mod;

        req = {
            method: 'POST',
            originalUrl: '/api/projects/123',
            user: { id: 10, organizationId: 99 },
            ip: '127.0.0.1',
            headers: { 'user-agent': 'test-agent' },
            body: { name: 'New Project' },
            get: (key) => key === 'user-agent' ? 'test-agent' : null
        };
        res = {
            statusCode: 200,
            end: vi.fn()
        };
        next = vi.fn();
    });

    it('should call next() and override res.end', () => {
        const originalEnd = res.end;
        auditLogMiddleware(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.end).not.toBe(originalEnd);
    });

    it('should log activity when res.end is called for 2xx POST', async () => {
        auditLogMiddleware(req, res, next);

        // Simulate response finish
        res.statusCode = 201;
        res.end('chunk', 'utf8');

        // Wait for async operations (DB write)
        await new Promise(resolve => setTimeout(resolve, 50)); // Give it a bit more time for DB I/O

        // Verify DB content
        const logs = await new Promise((resolve, reject) => {
            db.all('SELECT * FROM activity_logs', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });

        expect(logs.length).toBe(1);
        expect(logs[0]).toMatchObject({
            action: 'created',
            entity_type: 'project', // DB column is snake_case
            organization_id: '99', // DB stores as string/text likely 
            user_id: '10'
        });
    });

    it('should NOT log for GET requests', () => {
        req.method = 'GET';
        const originalEnd = res.end;
        auditLogMiddleware(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.end).toBe(originalEnd);
    });
});
