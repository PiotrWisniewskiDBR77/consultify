/**
 * Vendors Integration Tests
 * Testing vendor endpoints
 * 
 * @module tests/integration/vendors/vendor-endpoints.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

describe('Vendor Endpoints Integration', () => {
    let app: express.Application;
    const vendors = new Map<string, any>();

    beforeAll(() => {
        app = express();
        app.use(express.json());

        const authMiddleware = (req: any, res: any, next: any) => {
            if (!req.headers.authorization) return res.status(401).json({ error: 'Unauthorized' });
            req.user = { id: '1', orgId: 'org-1' };
            next();
        };

        app.get('/api/vendors', authMiddleware, (req, res) => {
            res.json(Array.from(vendors.values()).filter(v => v.orgId === req.user.orgId));
        });

        app.get('/api/vendors/:id', authMiddleware, (req, res) => {
            const vendor = vendors.get(req.params.id);
            if (!vendor) return res.status(404).json({ error: 'Not found' });
            res.json(vendor);
        });

        app.post('/api/vendors', authMiddleware, (req, res) => {
            const { name, email, category } = req.body;
            if (!name) return res.status(400).json({ error: 'Name required' });
            const id = `vendor-${Date.now()}`;
            const vendor = { id, name, email, category, rating: 0, status: 'active', orgId: req.user.orgId };
            vendors.set(id, vendor);
            res.status(201).json(vendor);
        });

        app.put('/api/vendors/:id', authMiddleware, (req, res) => {
            const vendor = vendors.get(req.params.id);
            if (!vendor) return res.status(404).json({ error: 'Not found' });
            const updated = { ...vendor, ...req.body };
            vendors.set(req.params.id, updated);
            res.json(updated);
        });

        app.post('/api/vendors/:id/rate', authMiddleware, (req, res) => {
            const vendor = vendors.get(req.params.id);
            if (!vendor) return res.status(404).json({ error: 'Not found' });
            vendor.rating = req.body.rating;
            res.json(vendor);
        });
    });

    describe('GET /api/vendors', () => {
        it('should return vendors', async () => {
            const response = await request(app)
                .get('/api/vendors')
                .set('Authorization', 'Bearer token');
            expect(response.status).toBe(200);
        });
    });

    describe('POST /api/vendors', () => {
        it('should create vendor', async () => {
            const response = await request(app)
                .post('/api/vendors')
                .set('Authorization', 'Bearer token')
                .send({ name: 'Tech Supplies', email: 'contact@tech.com', category: 'IT' });

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Tech Supplies');
        });

        it('should require name', async () => {
            const response = await request(app)
                .post('/api/vendors')
                .set('Authorization', 'Bearer token')
                .send({});

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/vendors/:id/rate', () => {
        it('should rate vendor', async () => {
            const createRes = await request(app)
                .post('/api/vendors')
                .set('Authorization', 'Bearer token')
                .send({ name: 'Vendor' });

            const response = await request(app)
                .post(`/api/vendors/${createRes.body.id}/rate`)
                .set('Authorization', 'Bearer token')
                .send({ rating: 4.5 });

            expect(response.status).toBe(200);
            expect(response.body.rating).toBe(4.5);
        });
    });
});
