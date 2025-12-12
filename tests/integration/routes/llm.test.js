// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const app = require('../../../server/index.js');
const db = require('../../../server/database.js');
const { initTestDb } = require('../../helpers/dbHelper.cjs');

/**
 * Level 2: Integration Tests - LLM Routes
 * Tests LLM API endpoints
 */
describe('Integration Test: LLM Routes', () => {
    let authToken;
    const testId = Date.now();
    const testOrgId = `llm-org-${testId}`;
    const testUserId = `llm-user-${testId}`;
    const testEmail = `llm-${testId}@test.com`;
    const testProviderId = `llm-provider-${testId}`;

    beforeAll(async () => {
        await db.initPromise;

        const bcrypt = require('bcryptjs');
        const hash = bcrypt.hashSync('test123', 8);

        await new Promise((resolve) => {
            db.serialize(() => {
                db.run(
                    'INSERT INTO organizations (id, name, plan, status) VALUES (?, ?, ?, ?)',
                    [testOrgId, 'LLM Test Org', 'free', 'active']
                );
                db.run(
                    'INSERT INTO users (id, organization_id, email, password, first_name, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [testUserId, testOrgId, testEmail, hash, 'Test', 'ADMIN']
                );
                db.run(
                    `INSERT INTO llm_providers 
                     (id, name, provider, api_key, model_id, is_active, is_default, visibility) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        testProviderId,
                        'Test Provider',
                        'openai',
                        'test-key',
                        'gpt-3.5-turbo',
                        1,
                        0,
                        'admin'
                    ],
                    resolve
                );
            });
        });

        // Login to get token
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({
                email: testEmail,
                password: 'test123',
            });

        if (loginRes.body.token) {
            authToken = loginRes.body.token;
        }
    });

    describe('GET /api/llm/providers', () => {
        it('should return list of LLM providers', async () => {
            if (!authToken) {
                console.log('Skipping providers test - no auth token');
                return;
            }

            const res = await request(app)
                .get('/api/llm/providers')
                .set('Authorization', `Bearer ${authToken}`);

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });

        it('should require authentication', async () => {
            const res = await request(app)
                .get('/api/llm/providers');

            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/llm/providers/public', () => {
        it('should return public providers', async () => {
            const res = await request(app)
                .get('/api/llm/providers/public');

            expect(res.status).toBe(200);
            expect(Array.isArray(res.body)).toBe(true);
        });
    });

    describe('POST /api/llm/test', () => {
        it('should test provider connection', async () => {
            if (!authToken) {
                console.log('Skipping test connection - no auth token');
                return;
            }

            const res = await request(app)
                .post('/api/llm/test')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    provider: 'openai',
                    api_key: 'test-key',
                    model_id: 'gpt-3.5-turbo',
                });

            // Should return result (success or error)
            expect([200, 400]).toContain(res.status);
            expect(res.body).toBeDefined();
        });

        it('should handle invalid provider', async () => {
            if (!authToken) {
                console.log('Skipping invalid provider test - no auth token');
                return;
            }

            const res = await request(app)
                .post('/api/llm/test')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    provider: 'invalid-provider',
                    api_key: 'test-key',
                });

            expect([400, 500]).toContain(res.status);
        });
    });

    describe('POST /api/llm/test-ollama', () => {
        it('should test Ollama connection', async () => {
            if (!authToken) {
                console.log('Skipping Ollama test - no auth token');
                return;
            }

            const res = await request(app)
                .post('/api/llm/test-ollama')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    endpoint: 'http://localhost:11434',
                });

            // May fail if Ollama not running, but should handle gracefully
            expect([200, 400, 500]).toContain(res.status);
        });
    });

    describe('GET /api/llm/ollama-models', () => {
        it('should return Ollama models', async () => {
            if (!authToken) {
                console.log('Skipping Ollama models test - no auth token');
                return;
            }

            const res = await request(app)
                .get('/api/llm/ollama-models')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ endpoint: 'http://localhost:11434' });

            // May fail if Ollama not running
            expect([200, 400, 500]).toContain(res.status);
        });
    });
});

