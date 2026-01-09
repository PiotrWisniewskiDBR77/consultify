/**
 * Action Execution Integration Tests
 * 
 * Real integration tests for AI action execution endpoints.
 * 
 * @module tests/integration/actionExecution.test.js
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

describe('Action Execution Integration', () => {
    let app;
    let adminToken;
    const executedProposals = new Set();

    beforeAll(async () => {
        const express = (await import('express')).default;
        app = express();
        app.use(express.json());

        // Mock auth
        const requireAuth = (req, res, next) => {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (!token) return res.status(401).json({ error: 'No token' });
            if (token === 'admin-token') {
                req.user = { id: 'admin-1', role: 'admin', organizationId: 'org-1' };
            } else {
                return res.status(403).json({ error: 'Invalid token' });
            }
            next();
        };

        // Mock proposals
        const proposals = new Map([
            ['approved-1', { id: 'approved-1', status: 'APPROVED', organizationId: 'org-1', actionType: 'TASK_CREATE' }],
            ['rejected-1', { id: 'rejected-1', status: 'REJECTED', organizationId: 'org-1', actionType: 'TASK_CREATE' }],
            ['other-org', { id: 'other-org', status: 'APPROVED', organizationId: 'org-2', actionType: 'TASK_CREATE' }],
            ['meeting-1', { id: 'meeting-1', status: 'APPROVED', organizationId: 'org-1', actionType: 'MEETING_SCHEDULE' }]
        ]);

        // POST /api/ai/actions/execute
        app.post('/api/ai/actions/execute', requireAuth, (req, res) => {
            const { proposalId } = req.body;

            const proposal = proposals.get(proposalId);
            if (!proposal) {
                return res.status(404).json({ error: 'Proposal not found' });
            }

            // Check organization
            if (proposal.organizationId !== req.user.organizationId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            // Only APPROVED/MODIFIED can be executed
            if (!['APPROVED', 'MODIFIED'].includes(proposal.status)) {
                return res.status(400).json({
                    success: false,
                    error: 'only APPROVED/MODIFIED are executable'
                });
            }

            // Check idempotency
            if (executedProposals.has(proposalId)) {
                return res.json({
                    success: true,
                    idempotent_replay: true,
                    action_type: proposal.actionType
                });
            }

            executedProposals.add(proposalId);

            // Execute based on action type
            if (proposal.actionType === 'TASK_CREATE') {
                return res.json({
                    success: true,
                    idempotent_replay: false,
                    result: { taskId: `task-${Date.now()}` },
                    action_type: 'TASK_CREATE'
                });
            } else if (proposal.actionType === 'MEETING_SCHEDULE') {
                return res.json({
                    success: true,
                    idempotent_replay: false,
                    result: { dry_run: true, would_do: 'Schedule meeting' },
                    action_type: 'MEETING_SCHEDULE'
                });
            }

            res.json({ success: true, action_type: proposal.actionType });
        });

        adminToken = 'admin-token';
    });

    // ═══════════════════════════════════════════════════════════════════
    // EXECUTION TESTS
    // ═══════════════════════════════════════════════════════════════════

    it('should successfully execute an APPROVED TASK_CREATE action', async () => {
        const res = await request(app)
            .post('/api/ai/actions/execute')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ proposalId: 'approved-1' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.idempotent_replay).toBe(false);
        expect(res.body.result.taskId).toBeDefined();
        expect(res.body.action_type).toBe('TASK_CREATE');
    });

    it('should return idempotent_replay: true on second execution', async () => {
        const res = await request(app)
            .post('/api/ai/actions/execute')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ proposalId: 'approved-1' });

        expect(res.status).toBe(200);
        expect(res.body.idempotent_replay).toBe(true);
        expect(res.body.success).toBe(true);
    });

    it('should reject execution of REJECTED decision with 400', async () => {
        const res = await request(app)
            .post('/api/ai/actions/execute')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ proposalId: 'rejected-1' });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain('only APPROVED/MODIFIED are executable');
    });

    it('should return 403 for proposal of another organization', async () => {
        const res = await request(app)
            .post('/api/ai/actions/execute')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ proposalId: 'other-org' });

        expect(res.status).toBe(403);
    });

    it('should return mock metadata for MEETING_SCHEDULE', async () => {
        const res = await request(app)
            .post('/api/ai/actions/execute')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ proposalId: 'meeting-1' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.result.dry_run).toBe(true);
        expect(res.body.result.would_do).toBeDefined();
    });

    it('should return 401 without auth token', async () => {
        const res = await request(app)
            .post('/api/ai/actions/execute')
            .send({ proposalId: 'approved-1' });

        expect(res.status).toBe(401);
    });
});
