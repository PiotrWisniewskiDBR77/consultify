/**
 * API Performance Tests
 * Testing API response times and throughput
 * 
 * @module tests/performance/api/api-response-times.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';

describe('API Performance Tests', () => {
    let app: express.Application;
    const MAX_RESPONSE_TIME_MS = 100;

    beforeAll(() => {
        app = express();
        app.use(express.json());

        // Simulated endpoints with varying response times
        app.get('/api/fast', (req, res) => {
            res.json({ status: 'ok' });
        });

        app.get('/api/data', (req, res) => {
            const data = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `Item ${i}` }));
            res.json(data);
        });

        app.get('/api/health', (req, res) => {
            res.json({ status: 'healthy', uptime: process.uptime() });
        });
    });

    describe('Response Time Tests', () => {
        it('should respond to health check under 50ms', async () => {
            const start = Date.now();
            const response = await request(app).get('/api/health');
            const elapsed = Date.now() - start;

            expect(response.status).toBe(200);
            expect(elapsed).toBeLessThan(50);
        });

        it('should respond to fast endpoint under 20ms', async () => {
            const start = Date.now();
            const response = await request(app).get('/api/fast');
            const elapsed = Date.now() - start;

            expect(response.status).toBe(200);
            expect(elapsed).toBeLessThan(20);
        });

        it('should respond to data endpoint under 100ms', async () => {
            const start = Date.now();
            const response = await request(app).get('/api/data');
            const elapsed = Date.now() - start;

            expect(response.status).toBe(200);
            expect(elapsed).toBeLessThan(MAX_RESPONSE_TIME_MS);
        });
    });

    describe('Throughput Tests', () => {
        it('should handle 10 concurrent requests', async () => {
            const requests = Array.from({ length: 10 }, () =>
                request(app).get('/api/fast')
            );

            const start = Date.now();
            const responses = await Promise.all(requests);
            const elapsed = Date.now() - start;

            responses.forEach(response => {
                expect(response.status).toBe(200);
            });
            expect(elapsed).toBeLessThan(500);
        });

        it('should handle 50 sequential requests', async () => {
            const start = Date.now();

            for (let i = 0; i < 50; i++) {
                const response = await request(app).get('/api/fast');
                expect(response.status).toBe(200);
            }

            const elapsed = Date.now() - start;
            expect(elapsed).toBeLessThan(2000);
        });
    });

    describe('Payload Size Tests', () => {
        it('should handle large response payload', async () => {
            const start = Date.now();
            const response = await request(app).get('/api/data');
            const elapsed = Date.now() - start;

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(100);
            expect(elapsed).toBeLessThan(100);
        });
    });
});
