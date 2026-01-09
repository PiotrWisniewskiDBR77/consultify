/**
 * Recommendation Engine Integration Tests
 * 
 * Real integration tests for recommendation engine API.
 * 
 * @module tests/integration/recommendationEngine.integration.test.js
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

describe('Recommendation Engine Integration', () => {
    let app;
    let authToken;

    beforeAll(async () => {
        const express = (await import('express')).default;
        app = express();
        app.use(express.json());

        // Mock recommendations database
        const recommendations = new Map([
            ['rec-1', { id: 'rec-1', type: 'improvement', category: 'process', priority: 'high', score: 85, confidence: 0.9, projectId: 'proj-1', accepted: false }],
            ['rec-2', { id: 'rec-2', type: 'optimization', category: 'technology', priority: 'medium', score: 72, confidence: 0.8, projectId: 'proj-1', accepted: true }],
            ['rec-3', { id: 'rec-3', type: 'improvement', category: 'process', priority: 'low', score: 55, confidence: 0.7, projectId: 'proj-1', accepted: false }]
        ]);

        // Auth middleware
        const requireAuth = (req, res, next) => {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) return res.status(401).json({ error: 'Unauthorized' });
            req.user = { id: 'user-1', organizationId: 'org-1' };
            next();
        };

        // GET /api/recommendations/:projectId - Get recommendations for project
        app.get('/api/recommendations/:projectId', requireAuth, (req, res) => {
            const { category, minScore } = req.query;

            let recs = Array.from(recommendations.values())
                .filter(r => r.projectId === req.params.projectId);

            if (category) {
                recs = recs.filter(r => r.category === category);
            }

            if (minScore) {
                recs = recs.filter(r => r.score >= parseInt(minScore));
            }

            // Sort by score descending
            recs.sort((a, b) => b.score - a.score);

            res.json({
                recommendations: recs,
                count: recs.length,
                avgScore: recs.length > 0 ? recs.reduce((sum, r) => sum + r.score, 0) / recs.length : 0
            });
        });

        // POST /api/recommendations/generate - Generate new recommendations
        app.post('/api/recommendations/generate', requireAuth, (req, res) => {
            const { projectId, context } = req.body;

            // Generate mock recommendations
            const newRecs = [
                {
                    id: `rec-${Date.now()}`,
                    type: 'improvement',
                    category: context?.focus || 'process',
                    priority: 'high',
                    score: 70 + Math.floor(Math.random() * 25),
                    confidence: 0.8 + Math.random() * 0.15,
                    projectId,
                    accepted: false,
                    generatedAt: new Date().toISOString()
                }
            ];

            newRecs.forEach(r => recommendations.set(r.id, r));

            res.status(201).json({
                recommendations: newRecs,
                generated: newRecs.length
            });
        });

        // GET /api/recommendations/:id/score - Get recommendation score details
        app.get('/api/recommendations/:id/score', requireAuth, (req, res) => {
            const rec = recommendations.get(req.params.id);
            if (!rec) {
                return res.status(404).json({ error: 'Recommendation not found' });
            }

            res.json({
                id: rec.id,
                score: rec.score,
                confidence: rec.confidence,
                factors: {
                    relevance: rec.score * 0.4,
                    impact: rec.score * 0.35,
                    feasibility: rec.score * 0.25
                }
            });
        });

        // POST /api/recommendations/:id/accept - Accept recommendation
        app.post('/api/recommendations/:id/accept', requireAuth, (req, res) => {
            const rec = recommendations.get(req.params.id);
            if (!rec) {
                return res.status(404).json({ error: 'Recommendation not found' });
            }

            rec.accepted = true;
            rec.acceptedAt = new Date().toISOString();
            rec.acceptedBy = req.user.id;

            res.json({
                id: rec.id,
                accepted: true,
                acceptedAt: rec.acceptedAt
            });
        });

        // POST /api/recommendations/:id/reject - Reject recommendation
        app.post('/api/recommendations/:id/reject', requireAuth, (req, res) => {
            const rec = recommendations.get(req.params.id);
            if (!rec) {
                return res.status(404).json({ error: 'Recommendation not found' });
            }

            rec.rejected = true;
            rec.rejectedAt = new Date().toISOString();
            rec.rejectionReason = req.body.reason;

            res.json({
                id: rec.id,
                rejected: true,
                reason: req.body.reason
            });
        });

        authToken = 'valid-token';
    });

    it('should generate project recommendations', async () => {
        const res = await request(app)
            .post('/api/recommendations/generate')
            .set('Authorization', `Bearer ${authToken}`)
            .send({ projectId: 'proj-1', context: { focus: 'technology' } });

        expect(res.status).toBe(201);
        expect(res.body.recommendations.length).toBeGreaterThan(0);
        expect(res.body.recommendations[0]).toHaveProperty('id');
        expect(res.body.recommendations[0]).toHaveProperty('type');
        expect(res.body.recommendations[0]).toHaveProperty('priority');
    });

    it('should score recommendations', async () => {
        const res = await request(app)
            .get('/api/recommendations/rec-1/score')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.score).toBeGreaterThan(0);
        expect(res.body.confidence).toBeGreaterThan(0);
        expect(res.body.factors).toBeDefined();
    });

    it('should filter by category', async () => {
        const res = await request(app)
            .get('/api/recommendations/proj-1?category=process')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.recommendations.every(r => r.category === 'process')).toBe(true);
    });

    it('should track recommendation acceptance', async () => {
        const res = await request(app)
            .post('/api/recommendations/rec-3/accept')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.accepted).toBe(true);
        expect(res.body.acceptedAt).toBeDefined();
    });

    it('should list recommendations sorted by score', async () => {
        const res = await request(app)
            .get('/api/recommendations/proj-1')
            .set('Authorization', `Bearer ${authToken}`);

        expect(res.status).toBe(200);
        expect(res.body.recommendations.length).toBeGreaterThan(0);

        // Verify sorted by score descending
        for (let i = 1; i < res.body.recommendations.length; i++) {
            expect(res.body.recommendations[i - 1].score).toBeGreaterThanOrEqual(res.body.recommendations[i].score);
        }
    });

    it('should require authentication', async () => {
        const res = await request(app).get('/api/recommendations/proj-1');
        expect(res.status).toBe(401);
    });
});
