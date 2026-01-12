import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import {
    validateCreateAnalysis,
    validateBulkScores,
    validateCreateComparison,
    validateSingleScore
} from '../../../../server/middleware/economicsValidation';

describe('Economics Validation Middleware', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());

        // Setup test routes
        app.post('/analysis', validateCreateAnalysis, (req, res) => res.status(200).json({ ok: true }));
        app.post('/scores/:id', validateBulkScores, (req, res) => res.status(200).json({ ok: true }));
        app.put('/score/:id', validateSingleScore, (req, res) => res.status(200).json({ ok: true }));
        app.post('/comparison', validateCreateComparison, (req, res) => res.status(200).json({ ok: true }));
    });

    describe('validateCreateAnalysis', () => {
        it('should pass with valid data', async () => {
            const res = await request(app)
                .post('/analysis')
                .send({ name: 'My Analysis', projectId: '123' });
            expect(res.status).toBe(200);
        });

        it('should fail without name', async () => {
            const res = await request(app)
                .post('/analysis')
                .send({ projectId: '123' });
            expect(res.status).toBe(400);
            expect(res.body.details).toEqual(expect.arrayContaining([
                expect.objectContaining({ field: 'name' })
            ]));
        });

        it('should fail if too many tags', async () => {
            const tags = Array(21).fill('tag');
            const res = await request(app)
                .post('/analysis')
                .send({ name: 'Analysis', tags });
            expect(res.status).toBe(400);
        });
    });

    describe('validateBulkScores', () => {
        it('should fail if scores is not array', async () => {
            const res = await request(app)
                .post('/scores/123')
                .send({ scores: 'not-array' });
            expect(res.status).toBe(400);
        });

        it('should fail if score items missing fields', async () => {
            const res = await request(app)
                .post('/scores/123')
                .send({ scores: [{ currentLevel: 5 }] }); // missing axisId
            expect(res.status).toBe(400);
        });

        it('should validate levels range', async () => {
            const res = await request(app)
                .post('/scores/123')
                .send({ scores: [{ axisId: 'a', areaId: 'b', currentLevel: 8 }] }); // > 7
            expect(res.status).toBe(400);
        });
    });

    describe('validateSingleScore', () => {
        it('should pass valid score', async () => {
            const res = await request(app)
                .put('/score/123')
                .send({ axisId: 'a1', areaId: 'ar1', currentLevel: 3 });
            expect(res.status).toBe(200);
        });
    });

    describe('validateCreateComparison', () => {
        it('should pass valid comparison', async () => {
            const res = await request(app)
                .post('/comparison')
                .send({ analysisIds: ['id1', 'id2'], name: 'Comp1' });
            expect(res.status).toBe(200);
        });

        it('should fail with less than 2 IDs', async () => {
            const res = await request(app)
                .post('/comparison')
                .send({ analysisIds: ['id1'] });
            expect(res.status).toBe(400);
        });
    });
});
