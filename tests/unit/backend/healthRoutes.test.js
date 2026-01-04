import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import healthRoutes from '../../../server/src/routes/healthRoutes';

// Mock HealthCheckController
vi.mock('../../../server/src/controllers/HealthCheckController', () => ({
    HealthCheckController: {
        ping: (req, res) => res.status(200).send('pong'),
        checkHealth: (req, res) => res.json({ status: 'ok', database: 'connected' }),
        checkReadiness: (req, res) => res.status(200).json({ status: 'ready', checks: { database: true } }),
        checkLiveness: (req, res) => res.status(200).json({ status: 'alive' }),
    },
}));

const app = express();
app.use('/api/health', healthRoutes);

describe('Health Routes', () => {
    it('GET /api/health should return 200 via Controller', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok', database: 'connected' });
    });

    it('GET /api/health/ping should return 200 via Controller', async () => {
        const res = await request(app).get('/api/health/ping');
        expect(res.status).toBe(200);
        expect(res.text).toBe('pong');
    });

    it('GET /api/health/ready should return 200 via Controller', async () => {
        const res = await request(app).get('/api/health/ready');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ready', checks: { database: true } });
    });

    it('GET /api/health/live should return 200 via Controller', async () => {
        const res = await request(app).get('/api/health/live');
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'alive' });
    });
});
