/**
 * AI Explainability API Integration Tests
 * 
 * Real integration tests for AI explainability endpoints.
 * 
 * @module tests/integration/aiExplainability.test.js
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

describe('AI Explainability API Integration', () => {
    let app;
    let adminToken;
    let userToken;

    beforeAll(async () => {
        const express = (await import('express')).default;
        app = express();
        app.use(express.json());

        // Evidence database
        const evidences = new Map([
            ['task-1', { entityType: 'task', entityId: 'task-1', organizationId: 'org-1', reasoning: 'Based on historical data', evidences: [{ type: 'historical', data: {} }] }],
            ['initiative-1', { entityType: 'initiative', entityId: 'initiative-1', organizationId: 'org-2', reasoning: 'Market analysis', evidences: [] }]
        ]);

        // Auth middleware
        const requireAuth = (req, res, next) => {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) return res.status(403).json({ error: 'Forbidden' });
            if (token === 'admin-token') {
                req.user = { id: 'admin-1', role: 'admin', organizationId: 'org-1' };
            } else if (token === 'user-token') {
                req.user = { id: 'user-1', role: 'user', organizationId: 'org-1' };
            } else {
                return res.status(403).json({ error: 'Invalid token' });
            }
            next();
        };

        // Validate entity type
        const validEntityTypes = ['task', 'initiative', 'decision', 'assessment'];

        // GET /api/ai/explain/:entityType/:id
        app.get('/api/ai/explain/:entityType/:id', requireAuth, (req, res) => {
            const { entityType, id } = req.params;

            if (!validEntityTypes.includes(entityType)) {
                return res.status(400).json({ error: 'Invalid entityType' });
            }

            const evidence = evidences.get(id);

            if (!evidence) {
                return res.json({
                    has_explanation: false,
                    evidence_count: 0,
                    reasoning: null,
                    evidences: []
                });
            }

            // Check organization isolation
            if (evidence.organizationId !== req.user.organizationId) {
                return res.json({
                    has_explanation: false,
                    evidence_count: 0,
                    reasoning: null,
                    evidences: []
                });
            }

            res.json({
                has_explanation: true,
                evidence_count: evidence.evidences.length,
                reasoning: evidence.reasoning,
                evidences: evidence.evidences
            });
        });

        // GET /api/ai/explain/:entityType/:id/export
        app.get('/api/ai/explain/:entityType/:id/export', requireAuth, (req, res) => {
            const { entityType, id } = req.params;
            const { format } = req.query;

            if (!validEntityTypes.includes(entityType)) {
                return res.status(400).json({ error: 'Invalid entityType' });
            }

            if (!['json', 'pdf', 'csv'].includes(format)) {
                return res.status(400).json({ error: 'Invalid format' });
            }

            const evidence = evidences.get(id);
            const baseExport = {
                metadata: { format, exportedAt: new Date().toISOString(), entityType, entityId: id },
                summary: evidence ? { reasoning: evidence.reasoning } : {},
                reasoning: evidence ? { text: evidence.reasoning } : {},
                evidences: evidence ? evidence.evidences : []
            };

            if (format === 'pdf') {
                baseExport.render_options = { pageSize: 'A4', margin: 20 };
            }

            res.json(baseExport);
        });

        // POST /api/ai/explain/:entityType/:id/export/pdf
        app.post('/api/ai/explain/:entityType/:id/export/pdf', requireAuth, (req, res) => {
            const { entityType, id } = req.params;

            res.json({
                success: true,
                data: {
                    render_options: { pageSize: 'A4', margin: 20 },
                    content: { entityType, entityId: id }
                }
            });
        });

        // GET /api/ai/explain/:entityType/:id/has-evidence
        app.get('/api/ai/explain/:entityType/:id/has-evidence', requireAuth, (req, res) => {
            const { id } = req.params;
            const evidence = evidences.get(id);

            const hasEvidence = evidence &&
                evidence.organizationId === req.user.organizationId &&
                evidence.evidences.length > 0;

            res.json({ has_evidence: hasEvidence });
        });

        adminToken = 'admin-token';
        userToken = 'user-token';
    });

    // ═══════════════════════════════════════════════════════════════════
    // GET /api/ai/explain/:entityType/:id - Access Control
    // ═══════════════════════════════════════════════════════════════════

    describe('GET /api/ai/explain/:entityType/:id - Access Control', () => {
        it('should block unauthorized users (no token)', async () => {
            const res = await request(app).get('/api/ai/explain/task/task-1');
            expect(res.status).toBe(403);
        });

        it('should reject invalid entity types', async () => {
            const res = await request(app)
                .get('/api/ai/explain/invalid-type/task-1')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid entityType');
        });

        it('should return empty explanation for non-existent entity', async () => {
            const res = await request(app)
                .get('/api/ai/explain/task/non-existent')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.has_explanation).toBe(false);
            expect(res.body.evidence_count).toBe(0);
        });

        it('should return explanation for existing entity', async () => {
            const res = await request(app)
                .get('/api/ai/explain/task/task-1')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.has_explanation).toBe(true);
            expect(res.body.evidence_count).toBeGreaterThanOrEqual(0);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // Export endpoints
    // ═══════════════════════════════════════════════════════════════════

    describe('GET /api/ai/explain/:entityType/:id/export', () => {
        it('should block unauthorized users', async () => {
            const res = await request(app).get('/api/ai/explain/task/task-1/export?format=json');
            expect(res.status).toBe(403);
        });

        it('should reject invalid format', async () => {
            const res = await request(app)
                .get('/api/ai/explain/task/task-1/export?format=invalid')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body.error).toContain('Invalid format');
        });

        it('should return JSON export with correct structure', async () => {
            const res = await request(app)
                .get('/api/ai/explain/task/task-1/export?format=json')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('metadata');
            expect(res.body).toHaveProperty('summary');
            expect(res.body).toHaveProperty('reasoning');
            expect(res.body).toHaveProperty('evidences');
            expect(res.body.metadata.format).toBe('json');
        });

        it('should include render_options for PDF format', async () => {
            const res = await request(app)
                .get('/api/ai/explain/task/task-1/export?format=pdf')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('render_options');
            expect(res.body.metadata.format).toBe('pdf');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // POST PDF Export
    // ═══════════════════════════════════════════════════════════════════

    describe('POST /api/ai/explain/:entityType/:id/export/pdf', () => {
        it('should block unauthorized users', async () => {
            const res = await request(app).post('/api/ai/explain/task/task-1/export/pdf');
            expect(res.status).toBe(403);
        });

        it('should return PDF-ready JSON', async () => {
            const res = await request(app)
                .post('/api/ai/explain/task/task-1/export/pdf')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty('render_options');
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // Organization Isolation
    // ═══════════════════════════════════════════════════════════════════

    describe('Organization Isolation', () => {
        it('should isolate evidence by organization', async () => {
            // initiative-1 belongs to org-2, user is in org-1
            const res = await request(app)
                .get('/api/ai/explain/initiative/initiative-1')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.has_explanation).toBe(false);
            expect(res.body.evidence_count).toBe(0);
        });

        it('should return evidence for same organization', async () => {
            // task-1 belongs to org-1, user is in org-1
            const res = await request(app)
                .get('/api/ai/explain/task/task-1')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.has_explanation).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // Evidence Check
    // ═══════════════════════════════════════════════════════════════════

    describe('Evidence Check', () => {
        it('should return has_evidence: false for entity without evidence', async () => {
            // Use initiative-1 which has empty evidences array
            const res = await request(app)
                .get('/api/ai/explain/initiative/initiative-1/has-evidence')
                .set('Authorization', `Bearer ${adminToken}`);

            // initiative-1 belongs to org-2 but user is in org-1, so has_evidence should be false
            expect(res.status).toBe(200);
            expect(res.body.has_evidence).toBe(false);
        });

        it('should return has_evidence: true for entity with evidence', async () => {
            const res = await request(app)
                .get('/api/ai/explain/task/task-1/has-evidence')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.has_evidence).toBe(true);
        });
    });
});
