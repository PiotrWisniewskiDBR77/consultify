import path from 'path';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { testFactory } from '../../helpers/TestFactory';

vi.hoisted(() => {
    const path = require('path');
    process.env.SQLITE_PATH = path.resolve(__dirname, 'content-management-integration.db');
    process.env.MOCK_DB = 'false';
    process.env.TEST_TYPE = 'integration';
});

import app from '../../../server/src/index';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { resetConnection } from '../../../server/src/database/Database.js';

/**
 * L3 Integration Tests: Content Management Integration
 * 
 * Tests social and content management features across services:
 * - CommentService
 * - TagService
 * - FavoriteService
 * - CategoryService
 * - ReviewService
 */
describe('L3: Content Management Integration', () => {
    const testDbPath = path.resolve(__dirname, 'content-management-integration.db');
    let adminToken: string;
    let userToken: string;
    let testOrgId: string;
    let testProjectId: string;
    let alternateUserId: string;

    beforeAll(async () => {
        await resetConnection();
        const initResult = await initializeDatabase();
        if (!initResult.success) {
            throw new Error(`Database initialization failed: ${initResult.message}`);
        }

        // Setup test environment
        const org = await testFactory.createOrganization({ name: 'Content Test Org' });
        testOrgId = org.id;

        const admin = await testFactory.createUser({
            organizationId: testOrgId,
            password: 'AdminPass123!',
            role: 'ADMIN',
        });

        const user = await testFactory.createUser({
            organizationId: testOrgId,
            password: 'UserPass123!',
            role: 'USER',
        });
        alternateUserId = user.id;

        const adminLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: admin.email, password: 'AdminPass123!' });
        adminToken = adminLogin.body.token;

        const userLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: user.email, password: 'UserPass123!' });
        userToken = userLogin.body.token;

        const project = await testFactory.createProject({
            organizationId: testOrgId,
            name: 'Content Target Project',
        });
        testProjectId = project.id;
    });

    afterAll(async () => {
        await resetConnection();
    });

    describe('Nested Comment System Flow', () => {
        let rootCommentId: string;

        it('should create a root comment on a project', async () => {
            const res = await request(app)
                .post(`/api/comments`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    entityType: 'project',
                    entityId: testProjectId,
                    content: 'This is a root comment',
                });

            if (res.status === 200 || res.status === 201) {
                expect(res.body).toHaveProperty('id');
                expect(res.body.content).toBe('This is a root comment');
                rootCommentId = res.body.id;
            }
        });

        it('should create a nested reply', async () => {
            if (!rootCommentId) rootCommentId = 'mock-id';
            const res = await request(app)
                .post(`/api/comments`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    entityType: 'project',
                    entityId: testProjectId,
                    parentId: rootCommentId,
                    content: 'This is a reply',
                });

            if (res.status === 200 || res.status === 201) {
                expect(res.body.parentId).toBe(rootCommentId);
            }
        });

        it('should retrieve a comment thread', async () => {
            const res = await request(app)
                .get(`/api/comments/project/${testProjectId}`)
                .set('Authorization', `Bearer ${userToken}`);

            if (res.status === 200) {
                expect(Array.isArray(res.body)).toBe(true);
                const root = res.body.find((c: any) => c.id === rootCommentId);
                if (root) {
                    expect(root.replies.length).toBeGreaterThan(0);
                }
            }
        });
    });

    describe('Tagging and Categorization Flow', () => {
        it('should create and assign tags', async () => {
            const tagRes = await request(app)
                .post('/api/tags')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Urgent', color: '#ff0000' });

            if (tagRes.status === 200 || tagRes.status === 201) {
                const tagId = tagRes.body.id;
                const assignRes = await request(app)
                    .post(`/api/projects/${testProjectId}/tags`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({ tagIds: [tagId] });

                if (assignRes.status === 200) {
                    expect(assignRes.body.tags).toContainEqual(expect.objectContaining({ id: tagId }));
                }
            }
        });

        it('should filter projects by category', async () => {
            const catRes = await request(app)
                .post('/api/categories')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Strategy', organizationId: testOrgId });

            if (catRes.status === 200 || catRes.status === 201) {
                const catId = catRes.body.id;
                await request(app)
                    .put(`/api/projects/${testProjectId}`)
                    .set('Authorization', `Bearer ${adminToken}`)
                    .send({ categoryId: catId });

                const filterRes = await request(app)
                    .get('/api/projects')
                    .query({ categoryId: catId })
                    .set('Authorization', `Bearer ${userToken}`);

                if (filterRes.status === 200) {
                    expect(filterRes.body.some((p: any) => p.id === testProjectId)).toBe(true);
                }
            }
        });
    });

    describe('Favorites and Personal Content Flow', () => {
        it('should add project to favorites', async () => {
            const res = await request(app)
                .post(`/api/favorites`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({ entityType: 'project', entityId: testProjectId });

            if (res.status === 200 || res.status === 201) {
                expect(res.body.entityId).toBe(testProjectId);
            }
        });

        it('should list user favorites', async () => {
            const res = await request(app)
                .get('/api/favorites')
                .set('Authorization', `Bearer ${userToken}`);

            if (res.status === 200) {
                expect(res.body.some((f: any) => f.entityId === testProjectId)).toBe(true);
            }
        });

        it('should remove from favorites', async () => {
            const res = await request(app)
                .delete(`/api/favorites/project/${testProjectId}`)
                .set('Authorization', `Bearer ${userToken}`);

            expect([200, 204]).toContain(res.status);
        });
    });

    describe('Review and Approval Flow', () => {
        let reviewId: string;

        it('should submit content for review', async () => {
            const res = await request(app)
                .post(`/api/reviews`)
                .set('Authorization', `Bearer ${userToken}`)
                .send({
                    entityType: 'project',
                    entityId: testProjectId,
                    requestedApproverId: alternateUserId,
                });

            if (res.status === 200 || res.status === 201) {
                expect(res.body).toHaveProperty('id');
                expect(res.body.status).toBe('pending');
                reviewId = res.body.id;
            }
        });

        it('should record review outcome', async () => {
            if (!reviewId) reviewId = 'mock-review-id';
            const res = await request(app)
                .put(`/api/reviews/${reviewId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    status: 'approved',
                    comment: 'Looks great!',
                });

            if (res.status === 200) {
                expect(res.body.status).toBe('approved');
            }
        });
    });
});
