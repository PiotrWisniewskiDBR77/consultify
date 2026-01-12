const request = require('supertest');
const express = require('express');
const bodyParser = require('body-parser');
const demoGuard = require('../../server/middleware/demoGuard');

describe('Demo Guard Isolation Extension', () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(bodyParser.json());

        // 1. Mock Auth Middleware
        app.use((req, res, next) => {
            const token = req.headers.authorization;
            if (token === 'demo') {
                req.user = { id: 'u1', organizationId: 'org-demo', isDemo: true };
            } else if (token === 'regular') {
                req.user = { id: 'u2', organizationId: 'org-real', isDemo: false };
            }
            next();
        });

        // 2. Register Demo Guard
        app.use(demoGuard);

        // 3. Test Route
        app.use((req, res, next) => {
            // Simulate a route that accepts organizationId in various ways
            // but normally relies on req.user.organizationId.
            // Howver, we want to see if DemoGuard BLOCKS explicit attempts to access other data via parameters
            // IF the application logic were to be "loose" enough to accept them.
            // Since DemoGuard is a security layer, it should prevent the request from even reaching the route logic
            // if it detects cross-tenant targeting.
            req.targetOrg = (req.query || {}).organizationId || (req.body || {}).organizationId || req.user.organizationId;
            next();
        });

        app.get('/api/data', (req, res) => {
            res.json({ success: true, targetOrg: req.targetOrg });
        });

        app.post('/api/data', (req, res) => {
            res.json({ success: true, targetOrg: req.targetOrg });
        });

        app.use((err, req, res, next) => {
            console.error('TEST APP ERROR:', err);
            res.status(500).json({ error: err.message });
        });
    });

    test('should allow Normal GET for demo user', async () => {
        const res = await request(app)
            .get('/api/data')
            .set('Authorization', 'demo');
        expect(res.status).toBe(200);
        expect(res.body.targetOrg).toBe('org-demo');
    });

    // Strategy: We want to BLOCK if query/body contains organizationId != user.organizationId
    // Currently, demoGuard does NOT do this (it only blocks writes). 
    // We expect this test to FAIL (return 200) until we implement the fix.
    // However, if we want to enforce isolation, we SHOULD block this.
    test('should BLOCK demo user if they try to switch context via Query Param', async () => {
        const res = await request(app)
            .get('/api/data?organizationId=org-real')
            .set('Authorization', 'demo');

        // If not implemented, this returns 200. We want 403.
        if (res.status === 200) {
            console.warn('Test Failed: Isolation NOT enforced yet');
        }

        expect(res.status).toBe(403);
        expect(res.body.code).toBe('DEMO_BLOCKED');
    });

    test('should BLOCK demo user if they try to switch context via Body', async () => {
        const res = await request(app)
            .post('/api/data') // POST is usually blocked by guard anyway, but if we allowed it...
            // Wait, POST is blocked by guard regardless for demo users unless allowed path.
            // So this test checks if it returns DEMO_BLOCKED vs generic block.
            // Actually, we want to check if it blocks strictly for isolation EVEN IF it was an allowed method?
            // DemoGuard blocks ALL writes. So POST is safe.
            // The danger is GET with ?organizationId=...

            .set('Authorization', 'demo')
            .send({ organizationId: 'org-real' });

        expect(res.status).toBe(403);
    });
});
