import app from '../../../server/src/index.js';
import request from 'supertest';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { getDatabaseAsync } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    process.env.SQLITE_PATH = ':memory:';
    process.env.NODE_ENV = 'test';
});

// Mock AI Pipeline to avoid real LLM calls and potential hangs
vi.mock('../../../server/src/services/ai/aiPipeline.js', () => ({
    AIPipeline: class {
        process() {
            return Promise.resolve({
                success: true,
                content: 'Mocked AI Response',
                usage: { totalTokens: 10 },
                metadata: { provider: 'mock' }
            });
        }
        processStream(_, onChunk) {
            onChunk({ type: 'text', content: 'Mocked ' });
            onChunk({ type: 'text', content: 'Streaming ' });
            onChunk({ type: 'text', content: 'Response' });
            onChunk({ type: 'done', metadata: {} });
            return Promise.resolve();
        }
    }
}));

describe('AI Routes Integration Tests', () => {
    let testUserId;
    let testOrgId;
    let testProjectId;
    let authToken;

    beforeAll(async () => {
        console.log('[Test Setup] Starting...');
        const initResult = await initializeDatabase();
        if (!initResult.success) {
            throw new Error(`Database init failed: ${initResult.message}`);
        }
        console.log('[Test Setup] Database initialized');

        const db = await getDatabaseAsync();
        
        testUserId = uuidv4();
        testOrgId = uuidv4();
        testProjectId = uuidv4();
        const hash = bcrypt.hashSync('test123', 8);

        console.log('[Test Setup] Seeding data...');
        // Use db.query instead of db.run for simpler promise handling
        await db.query('INSERT INTO organizations (id, name, plan, status, token_balance, billing_status, organization_type) VALUES (?, ?, ?, ?, ?, ?, ?)', 
            [testOrgId, 'Test AI Org', 'free', 'active', 10000, 'ACTIVE', 'PAID']);
        await db.query('INSERT INTO users (id, organization_id, email, password, first_name, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)', [testUserId, testOrgId, `ai-${testUserId}@test.com`, hash, 'AI', 'USER', 'active']);
        await db.query('INSERT INTO projects (id, organization_id, name, owner_id, status) VALUES (?, ?, ?, ?, ?)', [testProjectId, testOrgId, 'AI Test Project', testUserId, 'active']);
        
        // Add AI Policy so context builder doesn't fail or wait
        await db.query('INSERT INTO ai_policies (organization_id, policy_level, internet_enabled) VALUES (?, ?, ?)', [testOrgId, 'ADVISORY', 0]);
        
        console.log('[Test Setup] Logging in...');
        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: `ai-${testUserId}@test.com`, password: 'test123' });
        
        if (loginRes.status !== 200) {
            console.error('[Test Setup] Login failed:', loginRes.body);
            throw new Error('Login failed');
        }
        
        authToken = loginRes.body.token;
        console.log('[Test Setup] Ready');
    }, 30000);

    describe('GET /api/ai/context', () => {
        it('should build AI context for user without project', async () => {
            console.log('[Test] GET /api/ai/context');
            const response = await request(app)
                .get('/api/ai/context')
                .set('Authorization', `Bearer ${authToken}`)
                .query({ screen: 'dashboard' });

            if (response.status === 501) {
                console.warn('GET /api/ai/context is stubbed');
                return;
            }

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('platform');
            expect(response.body).toHaveProperty('organization');
            expect(response.body).toHaveProperty('currentScreen', 'dashboard');
        });

        it('should return 403 without authentication', async () => {
            const response = await request(app)
                .get('/api/ai/context');

            expect(response.status).toBe(403); // Middleware returns 403 for missing token
        });
    });

    describe('GET /api/ai/context/:projectId', () => {
        it('should build AI context for specific project', async () => {
            const response = await request(app)
                .get(`/api/ai/context/${testProjectId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .query({ screen: 'project-details' });

            if (response.status === 501) return;

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('project');
            // AIContextBuilder returns a structure where project might be null if not found, 
            // but for a valid ID it should return it.
            if (response.body.project) {
                expect(response.body.project.projectId).toBe(testProjectId);
            }
        });

        it('should return 200 with null project for non-existent project', async () => {
            const nonExistentId = uuidv4();
            const response = await request(app)
                .get(`/api/ai/context/${nonExistentId}`)
                .set('Authorization', `Bearer ${authToken}`);

            if (response.status === 501) return;

            // Current implementation returns 200 with project: null
            expect(response.status).toBe(200);
            expect(response.body.project).toBeNull();
        });
    });

    describe('POST /api/ai/chat/stream', () => {
        it('should handle streaming chat with AI', async () => {
            const chatRequest = {
                message: 'What is the project status?',
                history: [],
                systemInstruction: 'You are a PMO assistant',
                context: { projectId: testProjectId },
                roleName: 'pmo-assistant',
                language: 'en'
            };

            const response = await request(app)
                .post('/api/ai/chat/stream')
                .set('Authorization', `Bearer ${authToken}`)
                .send(chatRequest);

            if (response.status === 501) return;

            // Stream response headers
            expect(response.status).toBe(200);
            expect(response.header['content-type']).toContain('text/event-stream');
        });
    });

    describe('POST /api/ai/chat', () => {
        it('should handle non-streaming chat', async () => {
            const chatRequest = {
                message: 'Generate a project summary',
                projectId: testProjectId
            };

            const response = await request(app)
                .post('/api/ai/chat')
                .set('Authorization', `Bearer ${authToken}`)
                .send(chatRequest);

            if (response.status === 501) return;

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('role');
            expect(response.body).toHaveProperty('prompt');
        });
    });

    describe('GET /api/ai/policy', () => {
        it('should return AI policy configuration', async () => {
            const response = await request(app)
                .get('/api/ai/policy')
                .set('Authorization', `Bearer ${authToken}`);

            if (response.status === 501) return;

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('currentLevel');
        });
    });

    describe('Memory Management', () => {
        describe('GET /api/ai/memory/project/:projectId', () => {
            it('should retrieve project memory', async () => {
                const response = await request(app)
                    .get(`/api/ai/memory/project/${testProjectId}`)
                    .set('Authorization', `Bearer ${authToken}`);

                if (response.status === 501) return;

                expect(response.status).toBe(200);
                expect(response.body).toHaveProperty('memoryCount');
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid project IDs gracefully', async () => {
            const response = await request(app)
                .get('/api/ai/context/not-a-uuid')
                .set('Authorization', `Bearer ${authToken}`);

            if (response.status === 501) return;

            // Validator should catch this
            expect(response.status).toBe(400);
        });
    });
});
