import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';

// Import Real Dependencies (Singleton)
import db from '../../../server/database.js';
import aiMemoryRouter from '../../../server/routes/ai-memory.js';

// Mock auth middleware globally (must be done before other imports or handled via consistent mock)
// But since we imported Real Route at top level, it has already 'require'd the middleware.
// If middleware is CJS, mock might be tricky if not hoisted.
// However, we confirmed Real Middleware has a BYPASS mechanism for 'test' env.
// So we relying on Real Middleware is Safer.
// We just need to ensure process.env.NODE_ENV is 'test'.
process.env.NODE_ENV = 'test';

describe('AI Memory Routes (Integration - Singleton)', () => {
    let app;

    // Helper for DB Run
    const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
        db.run(sql, params, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });

    beforeAll(async () => {
        // Ensure clean state
        vi.restoreAllMocks();
    });

    beforeEach(async () => {
        // 1. Clear Data in the Singleton DB
        await dbRun('DELETE FROM ai_user_memory');

        // 2. Seed Dependencies (Align with Real Auth Middleware 'test-user-id')
        // We use INSERT OR IGNORE to handle if they persist across tests
        await dbRun("INSERT OR IGNORE INTO organizations (id, name) VALUES ('test-org-id', 'Test Org')");
        await dbRun("INSERT OR IGNORE INTO users (id, email, password, organization_id, role, first_name, last_name) VALUES ('test-user-id', 'test@example.com', 'hash', 'test-org-id', 'client', 'Test', 'User')");

        // 3. Seed Memories
        await dbRun(`
            INSERT INTO ai_user_memory (id, user_id, organization_id, key, value, source, confidence, created_at, updated_at)
            VALUES 
            ('mem-1', 'test-user-id', 'test-org-id', 'preference', 'value1', 'explicit', 1.0, datetime('now'), datetime('now')),
            ('mem-2', 'test-user-id', 'test-org-id', 'other', 'value2', 'inferred', 0.8, datetime('now'), datetime('now'))
        `);

        // 4. Initialize App
        app = express();
        app.use(express.json());
        // Use the imported router (which uses the same db singleton)
        // We use the 'default' export if it exists, roughly handling CJS/ESM
        // server/routes/ai-memory.js usually exports 'router' (module.exports = router)
        // In ESM import, it's default.
        app.use('/api/ai-memory', aiMemoryRouter.default || aiMemoryRouter);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /api/ai-memory', () => {
        it('should list user memories', async () => {
            const response = await request(app)
                .get('/api/ai-memory')
                .expect(200);

            expect(response.body.memories).toBeDefined();
            expect(response.body.memories.length).toBeGreaterThanOrEqual(2);
            expect(response.body.memories.find(m => m.key === 'preference')).toBeDefined();
        });

        it('should filter by source', async () => {
            const response = await request(app)
                .get('/api/ai-memory?source=explicit')
                .expect(200);

            expect(response.body.memories).toBeDefined();
            expect(response.body.memories.length).toBe(1);
            expect(response.body.memories[0].source).toBe('explicit');
        });
    });

    describe('GET /api/ai-memory/context', () => {
        it('should get formatted memory context', async () => {
            const response = await request(app)
                .get('/api/ai-memory/context')
                .expect(200);

            expect(response.body.context).toBeDefined();
            expect(JSON.stringify(response.body)).toContain('preference');
        });
    });

    describe('PUT /api/ai-memory/:key', () => {
        it('should create/update a memory', async () => {
            const response = await request(app)
                .put('/api/ai-memory/new_key')
                .send({ value: 'new-value', source: 'explicit' })
                .expect(200);

            expect(response.body).toBeDefined();
            expect(response.body.key).toBe('new_key');
            expect(response.body.value).toBe('new-value');
        });
    });
});








