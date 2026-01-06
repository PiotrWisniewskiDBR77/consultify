import app from '../../../server/src/index.js';
import express from 'express';
import request from 'supertest';
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { getDatabase, getDatabaseInstance } from '../../../server/src/database/Database.js';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';

vi.hoisted(() => {
    process.env.MOCK_DB = 'false';
    process.env.SQLITE_PATH = ':memory:';
});

/**
 * Initiatives Routes Integration Tests
 */

describe('Initiatives Routes', () => {
    let db;
    
    beforeAll(async () => {
        await initializeDatabase();
        db = getDatabaseInstance();
    });

    let testApp;

    beforeEach(async () => {
        vi.clearAllMocks();
        
        // Clear initiatives table before each test to avoid UNIQUE constraint errors
        await db.run('DELETE FROM initiatives');
        
        // Enable Auth Bypass for this test suite
        process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
        process.env.NODE_ENV = 'test';

        testApp = express();
        testApp.use(express.json());
        
        // Mock authentication middleware
        testApp.use((req, res, next) => {
            req.user = { id: 'user-1', organizationId: 'org-1', role: 'ADMIN' };
            next();
        });

        const initiativesRouter = (await import('../../../server/src/routes/pmo/initiatives.routes.ts')).default;
        testApp.use('/api/initiatives', initiativesRouter);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /api/initiatives', () => {
        it('returns list of initiatives', async () => {
            const initId1 = '00000000-0000-0000-0000-000000000001';
            const initId2 = '00000000-0000-0000-0000-000000000002';
            // Seed database
            await db.run('INSERT INTO initiatives (id, organization_id, name, title, status, progress) VALUES (?, ?, ?, ?, ?, ?)',
                [initId1, 'org-1', 'Digital Transformation', 'Digital Transformation', 'active', 50]);
            await db.run('INSERT INTO initiatives (id, organization_id, name, title, status, progress) VALUES (?, ?, ?, ?, ?, ?)',
                [initId2, 'org-1', 'Process Automation', 'Process Automation', 'planning', 10]);

            const response = await request(testApp)
                .get('/api/initiatives')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThanOrEqual(2);
            expect(response.body.map(i => i.name)).toContain('Digital Transformation');
        });

        it('returns 403 for missing auth', async () => {
            const originalBypass = process.env.ENABLE_TEST_AUTH_BYPASS;
            process.env.ENABLE_TEST_AUTH_BYPASS = 'false';
            
            try {
                const anonymousApp = express();
                anonymousApp.use(express.json());
                const initiativesRouter = (await import('../../../server/src/routes/pmo/initiatives.routes.ts')).default;
                anonymousApp.use('/api/initiatives', initiativesRouter);

                // This should fail because verifyToken will return 403 for missing token when bypass is off
                await request(anonymousApp)
                    .get('/api/initiatives')
                    .expect(403);
            } finally {
                process.env.ENABLE_TEST_AUTH_BYPASS = originalBypass;
            }
        });
    });

    describe('GET /api/initiatives/:id', () => {
        it('returns single initiative', async () => {
            const initId = '00000000-0000-0000-0000-000000000003';
            await db.run('INSERT INTO initiatives (id, organization_id, name, title, status, progress) VALUES (?, ?, ?, ?, ?, ?)',
                [initId, 'org-1', 'Single Initiative', 'Single Initiative', 'active', 20]);

            const response = await request(testApp)
                .get(`/api/initiatives/${initId}`)
                .expect(200);

            expect(response.body.id).toBe(initId);
            expect(response.body.title).toBe('Single Initiative');
        });

        it('returns 404 for non-existent initiative', async () => {
            const nonExistentId = '00000000-0000-0000-0000-ffffffffffff';
            const response = await request(testApp)
                .get(`/api/initiatives/${nonExistentId}`)
                .expect(404);

            expect(response.body.error).toBe('Initiative not found');
        });
    });

    describe('POST /api/initiatives', () => {
        it('creates new initiative', async () => {
            const projectId = 'e8235222-2222-2222-2222-222222222222';
            const newInitiative = {
                projectId: projectId,
                title: 'New created initiative',
                area: 'Tech',
                summary: 'Doing stuff'
            };

            const response = await request(testApp)
                .post('/api/initiatives')
                .send(newInitiative);
            
            if (response.status !== 200) {
                console.log('[DEBUG] Create Initiative Error:', response.body);
            }

            expect(response.status).toBe(200); // Controller returns 200 for creation

            expect(response.body.id).toBeDefined();
            expect(response.body.name).toBe('New created initiative');
        });
    });
});
