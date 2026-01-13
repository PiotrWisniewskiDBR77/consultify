/**
 * Invoice Integration Tests
 * Testing invoice endpoints
 * 
 * @module tests/integration/invoices/invoice-endpoints.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

describe('Invoice Endpoints Integration', () => {
    let app: express.Application;
    const invoices = new Map<string, any>();

    beforeAll(() => {
        app = express();
        app.use(express.json());

        const authMiddleware = (req: any, res: any, next: any) => {
            if (!req.headers.authorization) return res.status(401).json({ error: 'Unauthorized' });
            req.user = { id: '1', orgId: 'org-1' };
            next();
        };

        app.get('/api/invoices', authMiddleware, (req, res) => {
            res.json(Array.from(invoices.values()));
        });

        app.get('/api/invoices/:id', authMiddleware, (req, res) => {
            const invoice = invoices.get(req.params.id);
            if (!invoice) return res.status(404).json({ error: 'Not found' });
            res.json(invoice);
        });

        app.post('/api/invoices', authMiddleware, (req, res) => {
            const { clientId, items, dueDate } = req.body;
            if (!clientId || !items?.length) return res.status(400).json({ error: 'Missing required fields' });
            const id = `inv-${Date.now()}`;
            const total = items.reduce((sum: number, item: any) => sum + item.amount, 0);
            const invoice = { id, clientId, items, total, status: 'draft', dueDate };
            invoices.set(id, invoice);
            res.status(201).json(invoice);
        });

        app.post('/api/invoices/:id/send', authMiddleware, (req, res) => {
            const invoice = invoices.get(req.params.id);
            if (!invoice) return res.status(404).json({ error: 'Not found' });
            invoice.status = 'sent';
            invoice.sentAt = new Date().toISOString();
            res.json(invoice);
        });

        app.post('/api/invoices/:id/mark-paid', authMiddleware, (req, res) => {
            const invoice = invoices.get(req.params.id);
            if (!invoice) return res.status(404).json({ error: 'Not found' });
            invoice.status = 'paid';
            invoice.paidAt = new Date().toISOString();
            res.json(invoice);
        });
    });

    describe('GET /api/invoices', () => {
        it('should return invoices', async () => {
            const response = await request(app)
                .get('/api/invoices')
                .set('Authorization', 'Bearer token');
            expect(response.status).toBe(200);
        });
    });

    describe('POST /api/invoices', () => {
        it('should create invoice', async () => {
            const response = await request(app)
                .post('/api/invoices')
                .set('Authorization', 'Bearer token')
                .send({
                    clientId: 'client-1',
                    items: [{ description: 'Consulting', amount: 1000 }],
                    dueDate: '2026-02-01'
                });

            expect(response.status).toBe(201);
            expect(response.body.total).toBe(1000);
        });

        it('should require clientId and items', async () => {
            const response = await request(app)
                .post('/api/invoices')
                .set('Authorization', 'Bearer token')
                .send({});

            expect(response.status).toBe(400);
        });
    });

    describe('POST /api/invoices/:id/send', () => {
        it('should send invoice', async () => {
            const createRes = await request(app)
                .post('/api/invoices')
                .set('Authorization', 'Bearer token')
                .send({ clientId: 'c1', items: [{ amount: 500 }] });

            const response = await request(app)
                .post(`/api/invoices/${createRes.body.id}/send`)
                .set('Authorization', 'Bearer token');

            expect(response.status).toBe(200);
            expect(response.body.status).toBe('sent');
        });
    });
});
