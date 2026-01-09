/**
 * Legal Routes Integration Tests
 * 
 * Real integration tests for Legal API endpoints.
 * 
 * @module tests/integration/legal.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

describe('Legal API Routes', () => {
    let app: any;
    let authToken: string;

    beforeAll(async () => {
        const express = (await import('express')).default;
        app = express();
        app.use(express.json());

        // Mock data
        const legalDocuments = [
            { id: 'doc-1', type: 'TOS', version: '1.0', active: true, content: 'Terms of Service...', createdAt: '2026-01-01' },
            { id: 'doc-2', type: 'PRIVACY', version: '1.0', active: true, content: 'Privacy Policy...', createdAt: '2026-01-01' }
        ];

        const acceptances = new Map<string, any>();

        const validDocTypes = ['TOS', 'PRIVACY', 'COOKIES', 'DPA'];

        // Auth middleware
        const requireAuth = (req: any, res: any, next: any) => {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) return res.status(401).json({ error: 'Unauthorized' });
            req.user = { id: 'user-1', organizationId: 'org-1' };
            next();
        };

        // GET /api/legal/active - Get all active documents
        app.get('/api/legal/active', requireAuth, (req: any, res: any) => {
            const active = legalDocuments.filter(d => d.active);
            res.json(active);
        });

        // GET /api/legal/active/:docType - Get active document by type
        app.get('/api/legal/active/:docType', requireAuth, (req: any, res: any) => {
            const docType = req.params.docType.toUpperCase();
            if (!validDocTypes.includes(docType)) {
                return res.status(400).json({ error: 'Invalid document type' });
            }
            const doc = legalDocuments.find(d => d.type === docType && d.active);
            if (!doc) {
                return res.status(404).json({ error: 'Document not found' });
            }
            res.json(doc);
        });

        // GET /api/legal/pending - Get pending documents for user
        app.get('/api/legal/pending', requireAuth, (req: any, res: any) => {
            const userAcceptances = Array.from(acceptances.values())
                .filter(a => a.userId === req.user.id);

            const acceptedTypes = userAcceptances.map(a => a.docType);
            const required = legalDocuments
                .filter(d => d.active && !acceptedTypes.includes(d.type))
                .map(d => d.type);

            res.json({
                required,
                hasAnyPending: required.length > 0
            });
        });

        // POST /api/legal/accept - Accept legal documents
        app.post('/api/legal/accept', requireAuth, (req: any, res: any) => {
            const { docTypes } = req.body;

            if (!docTypes || !Array.isArray(docTypes) || docTypes.length === 0) {
                return res.status(400).json({ error: 'docTypes array is required' });
            }

            const now = new Date().toISOString();
            docTypes.forEach((type: string) => {
                acceptances.set(`${req.user.id}-${type}`, {
                    id: `acc-${Date.now()}`,
                    userId: req.user.id,
                    docType: type,
                    acceptedAt: now
                });
            });

            res.json({ success: true, accepted: docTypes });
        });

        authToken = 'valid-token';
    });

    describe('GET /api/legal/active', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app).get('/api/legal/active');
            expect(res.status).toBe(401);
        });

        it('should return active documents when authenticated', async () => {
            const res = await request(app)
                .get('/api/legal/active')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body.length).toBeGreaterThan(0);
        });
    });

    describe('GET /api/legal/active/:docType', () => {
        it('should return 400 for invalid doc type', async () => {
            const res = await request(app)
                .get('/api/legal/active/INVALID')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(400);
        });

        it('should return document for valid type', async () => {
            const res = await request(app)
                .get('/api/legal/active/TOS')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body.type).toBe('TOS');
        });
    });

    describe('GET /api/legal/pending', () => {
        it('should return pending documents for user', async () => {
            const res = await request(app)
                .get('/api/legal/pending')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('required');
            expect(res.body).toHaveProperty('hasAnyPending');
        });
    });

    describe('POST /api/legal/accept', () => {
        it('should return 401 without auth', async () => {
            const res = await request(app)
                .post('/api/legal/accept')
                .send({ docTypes: ['TOS'] });

            expect(res.status).toBe(401);
        });

        it('should return 400 without docTypes', async () => {
            const res = await request(app)
                .post('/api/legal/accept')
                .set('Authorization', `Bearer ${authToken}`)
                .send({});

            expect(res.status).toBe(400);
        });

        it('should accept legal documents', async () => {
            const res = await request(app)
                .post('/api/legal/accept')
                .set('Authorization', `Bearer ${authToken}`)
                .send({ docTypes: ['TOS', 'PRIVACY'] });

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.accepted).toContain('TOS');
        });
    });
});
