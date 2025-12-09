import { describe, it, expect } from 'vitest';
import request from 'supertest';

// Note: In a real scenario, we would import the Express 'app' instance.
// Since 'index.js' starts the server immediately, we might need to refactor it to export 'app'.
// For this test proof-of-concept, we'll assume the server is running on localhost:3001
const API_URL = 'http://localhost:3001/api';

describe('Integration Test: API Health', () => {
    it('GET /health should return 200 OK', async () => {
        // We check if the dev server endpoint works
        const res = await request(API_URL).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
    });

    it('GET /non-existent-route should return 404', async () => {
        const res = await request(API_URL).get('/random-path-123');
        expect(res.status).toBe(404);
    });
});
