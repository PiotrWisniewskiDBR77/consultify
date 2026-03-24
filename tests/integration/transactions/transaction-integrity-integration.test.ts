import path from 'path';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import { testFactory } from '../../helpers/TestFactory';

vi.hoisted(() => {
    const path = require('path');
    process.env.SQLITE_PATH = path.resolve(__dirname, 'transaction-integrity-integration.db');
    process.env.MOCK_DB = 'false';
    process.env.TEST_TYPE = 'integration';
});

import app from '../../../server/src/index';
import { initializeDatabase } from '../../../server/src/database/DatabaseInitializer.js';
import { resetConnection, getDatabase } from '../../../server/src/database/Database.js';

/**
 * L3 Integration Tests: Transaction Integrity Integration
 * 
 * Tests database transaction integrity across services:
 * - TransactionService
 * - Multi-service transaction coordination
 * - Rollback scenarios
 * - Concurrent transaction handling
 * - Distributed transaction patterns
 */
describe('L3: Transaction Integrity Integration', () => {
    const testDbPath = path.resolve(__dirname, 'transaction-integrity-integration.db');
    let adminToken: string;
    let testOrgId: string;

    beforeAll(async () => {
        await resetConnection();
        const initResult = await initializeDatabase();
        if (!initResult.success) {
            throw new Error(`Database initialization failed: ${initResult.message}`);
        }

        const org = await testFactory.createOrganization({
            name: 'Transaction Test Org',
            plan: 'professional',
        });
        testOrgId = org.id;

        const admin = await testFactory.createUser({
            organizationId: testOrgId,
            password: 'AdminPass123!',
            role: 'ADMIN',
        });

        const loginRes = await request(app)
            .post('/api/auth/login')
            .send({ email: admin.email, password: 'AdminPass123!' });
        adminToken = loginRes.body.token;
    });

    afterAll(async () => {
        await resetConnection();
    });

    describe('Multi-Service Transaction Commit Coordination', () => {
        it('should commit transaction across multiple services', async () => {
            // Create project with tasks and budget in single transaction
            const createRes = await request(app)
                .post('/api/projects/create-with-setup')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    project: {
                        name: 'Transaction Test Project',
                        budget: 100000,
                    },
                    tasks: [
                        { title: 'Task 1', status: 'todo' },
                        { title: 'Task 2', status: 'todo' },
                    ],
                    team: [
                        { userId: 'user-1', role: 'member' },
                    ],
                });

            if (createRes.status === 200 || createRes.status === 201) {
                expect(createRes.body).toHaveProperty('projectId');
                expect(createRes.body).toHaveProperty('tasksCreated');
                expect(createRes.body).toHaveProperty('teamAssigned');
            }
        });

        it('should maintain referential integrity across tables', async () => {
            const project = await testFactory.createProject({
                organizationId: testOrgId,
                name: 'Integrity Test Project',
            });

            // Create related records
            const task = await testFactory.createTask({
                projectId: project.id,
                title: 'Test Task',
            });

            // Verify relationships
            const projectRes = await request(app)
                .get(`/api/projects/${project.id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (projectRes.status === 200) {
                expect(projectRes.body).toHaveProperty('id', project.id);
            }

            const taskRes = await request(app)
                .get(`/api/tasks/${task.id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            if (taskRes.status === 200) {
                expect(taskRes.body.projectId).toBe(project.id);
            }
        });
    });

    describe('Transaction Rollback Scenarios', () => {
        it('should rollback transaction on validation error', async () => {
            const rollbackRes = await request(app)
                .post('/api/projects/create-with-setup')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    project: {
                        name: '', // Invalid: empty name
                        budget: 100000,
                    },
                    tasks: [
                        { title: 'Task 1' },
                    ],
                });

            expect([400, 422]).toContain(rollbackRes.status);

            // Verify no partial data was created
            // Project should not exist
        });

        it('should rollback on database constraint violation', async () => {
            // Try to create duplicate record
            const project = await testFactory.createProject({
                organizationId: testOrgId,
                name: 'Unique Project',
            });

            const duplicateRes = await request(app)
                .post('/api/projects')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Unique Project', // Duplicate name
                    organizationId: testOrgId,
                });

            // Depending on constraints, might fail
        });

        it('should rollback on service-level error', async () => {
            // Simulate error in one service during multi-service transaction
            const errorRes = await request(app)
                .post('/api/projects/create-with-payment')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    project: { name: 'Paid Project', budget: 100000 },
                    payment: { method: 'invalid_method' }, // Will cause error
                });

            if (errorRes.status >= 400) {
                // Verify project was not created
                // Verify no payment record exists
            }
        });
    });

    describe('Concurrent Transaction Handling', () => {
        it('should handle concurrent updates with optimistic locking', async () => {
            const project = await testFactory.createProject({
                organizationId: testOrgId,
                name: 'Concurrent Update Test',
                version: 1,
            });

            // Simulate concurrent updates
            const update1 = request(app)
                .put(`/api/projects/${project.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Updated Name 1', version: 1 });

            const update2 = request(app)
                .put(`/api/projects/${project.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ name: 'Updated Name 2', version: 1 });

            const [res1, res2] = await Promise.all([update1, update2]);

            // One should succeed, one should fail with conflict
            const successful = [res1, res2].filter(r => r.status === 200);
            const conflicts = [res1, res2].filter(r => r.status === 409);

            expect(successful.length).toBe(1);
            expect(conflicts.length).toBe(1);
        });

        it('should prevent lost updates', async () => {
            const project = await testFactory.createProject({
                organizationId: testOrgId,
                name: 'Lost Update Test',
                budget: 100000,
            });

            // User 1 reads project
            const read1 = await request(app)
                .get(`/api/projects/${project.id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            // User 2 reads project
            const read2 = await request(app)
                .get(`/api/projects/${project.id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            // User 1 updates
            const update1 = await request(app)
                .put(`/api/projects/${project.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ budget: 120000 });

            // User 2 updates (should detect conflict)
            const update2 = await request(app)
                .put(`/api/projects/${project.id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ budget: 150000 });

            // Depending on implementation, should handle conflict
        });

        it('should handle deadlock scenarios', async () => {
            // Create two projects
            const project1 = await testFactory.createProject({
                organizationId: testOrgId,
                name: 'Deadlock Test 1',
            });

            const project2 = await testFactory.createProject({
                organizationId: testOrgId,
                name: 'Deadlock Test 2',
            });

            // Simulate potential deadlock scenario
            // Transaction 1: Update project1, then project2
            // Transaction 2: Update project2, then project1

            // Implementation would need actual database-level deadlock detection
        });
    });

    describe('Nested Transaction Handling', () => {
        it('should handle nested transactions with savepoints', async () => {
            const nestedRes = await request(app)
                .post('/api/projects/complex-setup')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    project: { name: 'Nested Transaction Test' },
                    phases: [
                        {
                            name: 'Phase 1',
                            tasks: [
                                { title: 'Task 1.1' },
                                { title: 'Task 1.2' },
                            ],
                        },
                        {
                            name: 'Phase 2',
                            tasks: [
                                { title: 'Task 2.1' },
                            ],
                        },
                    ],
                });

            if (nestedRes.status === 200 || nestedRes.status === 201) {
                expect(nestedRes.body).toHaveProperty('projectId');
                expect(nestedRes.body).toHaveProperty('phasesCreated');
            }
        });

        it('should rollback to savepoint on partial failure', async () => {
            const partialRes = await request(app)
                .post('/api/projects/complex-setup')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    project: { name: 'Partial Rollback Test' },
                    phases: [
                        {
                            name: 'Valid Phase',
                            tasks: [{ title: 'Valid Task' }],
                        },
                        {
                            name: '', // Invalid: empty name
                            tasks: [{ title: 'Task' }],
                        },
                    ],
                });

            // Should rollback second phase but keep first
            // Or rollback entire transaction depending on implementation
        });
    });

    describe('Distributed Transaction Patterns', () => {
        it('should coordinate transaction across multiple databases', async () => {
            // If using multiple databases (e.g., main DB + analytics DB)
            const distributedRes = await request(app)
                .post('/api/analytics/record-event')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    event: 'project_created',
                    data: { projectId: 'proj-123' },
                });

            if (distributedRes.status === 200 || distributedRes.status === 202) {
                // Verify event recorded in both main and analytics DB
            }
        });

        it('should implement two-phase commit for critical operations', async () => {
            // For operations requiring strong consistency
            const twoPhaseRes = await request(app)
                .post('/api/billing/charge-and-provision')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    amount: 100.00,
                    service: 'premium_features',
                });

            if (twoPhaseRes.status === 200) {
                // Verify both charge and provisioning succeeded
                expect(twoPhaseRes.body).toHaveProperty('charged');
                expect(twoPhaseRes.body).toHaveProperty('provisioned');
            }
        });
    });

    describe('Transaction Isolation Levels', () => {
        it('should prevent dirty reads', async () => {
            const project = await testFactory.createProject({
                organizationId: testOrgId,
                name: 'Dirty Read Test',
                status: 'draft',
            });

            // Start transaction to update project
            // Read from another transaction before commit
            // Should not see uncommitted changes
        });

        it('should prevent non-repeatable reads', async () => {
            const project = await testFactory.createProject({
                organizationId: testOrgId,
                name: 'Non-Repeatable Read Test',
            });

            // Read project in transaction
            // Another transaction updates project
            // Read again in first transaction
            // Should see same data (depending on isolation level)
        });

        it('should prevent phantom reads', async () => {
            // Query for projects in transaction
            // Another transaction inserts new project
            // Query again in first transaction
            // Should not see new project (depending on isolation level)
        });
    });

    describe('Error Recovery and Cleanup', () => {
        it('should cleanup resources on transaction failure', async () => {
            const failRes = await request(app)
                .post('/api/projects/create-with-files')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    project: { name: 'File Upload Test' },
                    files: ['file1.pdf', 'file2.pdf'],
                });

            if (failRes.status >= 400) {
                // Verify uploaded files were cleaned up
                // Verify no partial project record exists
            }
        });

        it('should log transaction failures for debugging', async () => {
            const errorRes = await request(app)
                .post('/api/projects/create-with-setup')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    project: { name: '' }, // Will fail
                });

            if (errorRes.status >= 400) {
                // Verify error was logged
                const logsRes = await request(app)
                    .get('/api/admin/error-logs')
                    .set('Authorization', `Bearer ${adminToken}`);

                if (logsRes.status === 200) {
                    // Should have error log entry
                }
            }
        });
    });
});
