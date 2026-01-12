const request = require('supertest');
const express = require('express');
const demoGuard = require('../../server/middleware/demoGuard');

describe('Demo Guard Middleware', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Mock Auth Middleware to inject user
        app.use((req, res, next) => {
            if (req.headers['x-demo-user']) {
                req.user = { id: 'demo-123', isDemo: true };
            } else if (req.headers['x-regular-user']) {
                req.user = { id: 'user-123', isDemo: false };
            }
            next();
        });

        app.use(demoGuard);

        // Test Routes
        app.get('/api/dashboard', (req, res) => res.status(200).json({ success: true }));
        app.post('/api/tasks', (req, res) => res.status(201).json({ success: true }));
        app.post('/api/ai/chat', (req, res) => res.status(200).json({ success: true }));
        app.post('/api/auth/logout', (req, res) => res.status(200).json({ success: true }));
    });

    test('should allow regular users to perform write operations', async () => {
        const res = await request(app)
            .post('/api/tasks')
            .set('x-regular-user', 'true');
        expect(res.status).toBe(201);
    });

    test('should allow demo users to perform read operations', async () => {
        const res = await request(app)
            .get('/api/dashboard')
            .set('x-demo-user', 'true');
        expect(res.status).toBe(200);
    });

    test('should BLOCK demo users from performing write operations on protected routes', async () => {
        const res = await request(app)
            .post('/api/tasks')
            .set('x-demo-user', 'true');
        expect(res.status).toBe(403);
        expect(res.body.errorCode).toBe('DEMO_ACTION_BLOCKED');
    });

    test('should ALLOW demo users to perform write operations on ALLOWED routes (AI Chat)', async () => {
        const res = await request(app)
            .post('/api/ai/chat')
            .set('x-demo-user', 'true');
        expect(res.status).toBe(200);
    });

    test('should ALLOW demo users to perform write operations on ALLOWED routes (Logout)', async () => {
        const res = await request(app)
            .post('/api/auth/logout')
            .set('x-demo-user', 'true');
        expect(res.status).toBe(200);
    });

    test('should passthrough if no user matches (unauthenticated requests handled elsewhere)', async () => {
        const res = await request(app).post('/api/tasks');
        // demoGuard relies on req.user. If not present, it skips.
        // In real app, auth middleware would block this before demoGuard if required.
        // Here it hits the route.
        expect(res.status).toBe(201);
    });
});
