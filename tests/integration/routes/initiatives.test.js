/**
 * Initiatives Routes Integration Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const queryHelpers = require('../../../server/utils/queryHelpers');
// initiatives.js exports router directly usually
const initiativesRouter = require('../../../server/routes/initiatives');

describe('Initiatives Routes', () => {
    let app;

    beforeEach(() => {
        // Spy on methods on the CJS object
        vi.spyOn(queryHelpers, 'queryAll');
        vi.spyOn(queryHelpers, 'queryOne');
        vi.spyOn(queryHelpers, 'queryRun');

        app = express();
        app.use(express.json());
        app.use('/api/initiatives', initiativesRouter);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('GET /api/initiatives', () => {
        it('returns list of initiatives', async () => {
            const mockInitiatives = [
                {
                    id: 'init-1',
                    organization_id: 'org-1',
                    name: 'Digital Transformation',
                    status: 'active',
                    progress: 50
                },
                {
                    id: 'init-2',
                    organization_id: 'org-1',
                    name: 'Process Automation',
                    status: 'planning',
                    progress: 10
                }
            ];

            queryHelpers.queryAll.mockResolvedValue(mockInitiatives);

            const response = await request(app)
                .get('/api/initiatives')
                .expect('Content-Type', /json/)
                .expect(200);

            expect(response.body.initiatives).toBeDefined();
            expect(response.body.total).toBe(2);
        });

        it('returns empty array when no initiatives', async () => {
            queryHelpers.queryAll.mockResolvedValue([]);

            const response = await request(app)
                .get('/api/initiatives')
                .expect(200);

            expect(response.body.initiatives).toEqual([]);
            expect(response.body.total).toBe(0);
        });

        it('handles table not found error gracefully', async () => {
            queryHelpers.queryAll.mockRejectedValue(new Error('no such table: initiatives'));

            const response = await request(app)
                .get('/api/initiatives')
                .expect(200);

            expect(response.body.initiatives).toEqual([]);
            expect(response.body.total).toBe(0);
        });

        it('parses JSON fields correctly', async () => {
            const mockInitiative = {
                id: 'init-1',
                name: 'Test',
                deliverables: JSON.stringify(['Deliverable 1', 'Deliverable 2']),
                success_criteria: JSON.stringify(['Criteria 1']),
                scope_in: JSON.stringify(['In scope']),
                scope_out: JSON.stringify(['Out of scope']),
                key_risks: JSON.stringify(['Risk 1'])
            };

            queryHelpers.queryAll.mockResolvedValue([mockInitiative]);

            const response = await request(app)
                .get('/api/initiatives')
                .expect(200);

            const initiative = response.body.initiatives[0];
            expect(initiative.deliverables).toEqual(['Deliverable 1', 'Deliverable 2']);
            expect(initiative.successCriteria).toEqual(['Criteria 1']);
        });

        it('includes owner information', async () => {
            const mockInitiative = {
                id: 'init-1',
                name: 'Test',
                owner_business_id: 'user-1',
                ob_first_name: 'John',
                ob_last_name: 'Doe',
                ob_avatar: 'avatar.jpg',
                owner_execution_id: 'user-2',
                oe_first_name: 'Jane',
                oe_last_name: 'Smith',
                oe_avatar: 'avatar2.jpg'
            };

            queryHelpers.queryAll.mockResolvedValue([mockInitiative]);

            const response = await request(app)
                .get('/api/initiatives')
                .expect(200);

            const initiative = response.body.initiatives[0];
            expect(initiative.ownerBusiness).toEqual({
                id: 'user-1',
                firstName: 'John',
                lastName: 'Doe',
                avatarUrl: 'avatar.jpg'
            });
            expect(initiative.ownerExecution).toEqual({
                id: 'user-2',
                firstName: 'Jane',
                lastName: 'Smith',
                avatarUrl: 'avatar2.jpg'
            });
        });
    });

    describe('GET /api/initiatives/:id', () => {
        it('returns single initiative', async () => {
            const mockInitiative = {
                id: 'init-1',
                organization_id: 'org-1',
                name: 'Digital Transformation',
                status: 'active',
                progress: 50,
                problem_statement: 'Need to modernize',
                hypothesis: 'Automation will help'
            };

            queryHelpers.queryOne.mockResolvedValue(mockInitiative);

            const response = await request(app)
                .get('/api/initiatives/init-1')
                .expect(200);

            expect(response.body.id).toBe('init-1');
            expect(response.body.name).toBe('Digital Transformation');
        });

        it('returns 404 for non-existent initiative', async () => {
            queryHelpers.queryOne.mockResolvedValue(null);

            const response = await request(app)
                .get('/api/initiatives/non-existent')
                .expect(404);

            expect(response.body.error).toBe('Initiative not found');
        });

        it('includes task count', async () => {
            const mockInitiative = { id: 'init-1', name: 'Test' };

            queryHelpers.queryOne
                .mockResolvedValueOnce(mockInitiative)
                .mockResolvedValueOnce({ count: 5 });

            const response = await request(app)
                .get('/api/initiatives/init-1')
                .expect(200);

            expect(response.body.taskCount).toBe(5);
        });
    });
});


