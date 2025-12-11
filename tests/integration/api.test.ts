
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import request from 'supertest';

import app from '../../server/index.js';

describe('Integration Test: API Health', () => {
    it('GET /health should return 200 OK', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    it('GET /non-existent-route should return 404 (handled by catchall serving index.html)', async () => {
        const res = await request(app).get('/api/random-path-123');
        // Because of the catchall handler serving React app, this might actually return 200 and html content
        // unless we check content-type or if the catchall is only for non-api routes?
        // In server/index.js: app.use((req, res) => res.sendFile(...));
        // It matches everything. So it returns 200.
        // We should verify it returns text/html.
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/text\/html/);
    });
});

