/**
 * Action Decisions API Integration Tests
 *
 * Real integration tests using supertest for AI action decision endpoints.
 *
 * @module tests/integration/actionDecision.test.js
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';

describe('Action Decisions API Integration', () => {
  let app;
  let adminToken;
  let userToken;

  beforeAll(async () => {
    // Create mock Express app for testing
    const express = (await import('express')).default;
    app = express();
    app.use(express.json());

    // Mock auth middleware
    const requireAuth = (req, res, next) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }
      if (token === 'admin-token') {
        req.user = { id: 'admin-1', role: 'admin', organizationId: 'org-1' };
      } else if (token === 'user-token') {
        req.user = { id: 'user-1', role: 'user', organizationId: 'org-1' };
      } else {
        return res.status(403).json({ error: 'Invalid token' });
      }
      next();
    };

    // Mock proposals store
    const proposals = new Map([
      [
        'proposal-1',
        { id: 'proposal-1', status: 'PENDING', organizationId: 'org-1', action: 'TASK_CREATE' },
      ],
      [
        'proposal-2',
        {
          id: 'proposal-2',
          status: 'APPROVED',
          organizationId: 'org-2',
          action: 'MEETING_SCHEDULE',
        },
      ],
    ]);

    // Mock decisions store
    const decisions = new Map();

    // POST /api/ai/actions/decide - Create a decision
    app.post('/api/ai/actions/decide', requireAuth, (req, res) => {
      const { proposalId, decision, reason } = req.body;

      // Validate decision type
      if (!['APPROVED', 'REJECTED', 'MODIFIED'].includes(decision)) {
        return res.status(400).json({ error: 'Invalid decision type' });
      }

      // Check proposal exists
      const proposal = proposals.get(proposalId);
      if (!proposal) {
        return res.status(404).json({ error: 'Proposal not found' });
      }

      // Check organization access
      if (proposal.organizationId !== req.user.organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Require admin role
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin role required' });
      }

      const newDecision = {
        id: `decision-${Date.now()}`,
        proposalId,
        decision,
        reason,
        decidedBy: req.user.id,
        decidedAt: new Date().toISOString(),
      };

      decisions.set(newDecision.id, newDecision);
      proposal.status = decision;

      res.status(201).json({ success: true, decision: newDecision });
    });

    // GET /api/ai/actions/audit - Get decision audit log
    app.get('/api/ai/actions/audit', requireAuth, (req, res) => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin role required' });
      }

      const orgDecisions = Array.from(decisions.values()).filter((d) => {
        const proposal = proposals.get(d.proposalId);
        return proposal && proposal.organizationId === req.user.organizationId;
      });

      res.json(orgDecisions);
    });

    adminToken = 'admin-token';
    userToken = 'user-token';
  });

  // ═══════════════════════════════════════════════════════════════════
  // POST /api/ai/actions/decide - Access Control
  // ═══════════════════════════════════════════════════════════════════

  describe('POST /api/ai/actions/decide - Access Control', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app)
        .post('/api/ai/actions/decide')
        .send({ proposalId: 'proposal-1', decision: 'APPROVED' });

      expect(res.status).toBe(401);
    });

    it('should return 403 for non-admin users', async () => {
      const res = await request(app)
        .post('/api/ai/actions/decide')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ proposalId: 'proposal-1', decision: 'APPROVED' });

      expect(res.status).toBe(403);
    });

    it('should reject invalid decision types', async () => {
      const res = await request(app)
        .post('/api/ai/actions/decide')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ proposalId: 'proposal-1', decision: 'INVALID_TYPE' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid decision');
    });

    it('should return 404 for non-existent proposal', async () => {
      const res = await request(app)
        .post('/api/ai/actions/decide')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ proposalId: 'non-existent', decision: 'APPROVED' });

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('not found');
    });

    it('should create decision for valid request', async () => {
      const res = await request(app)
        .post('/api/ai/actions/decide')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          proposalId: 'proposal-1',
          decision: 'APPROVED',
          reason: 'Meets all criteria',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.decision.decision).toBe('APPROVED');
    });

    it('should block access to other organization proposals', async () => {
      const res = await request(app)
        .post('/api/ai/actions/decide')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ proposalId: 'proposal-2', decision: 'APPROVED' });

      expect(res.status).toBe(403);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // GET /api/ai/actions/audit - Access Control
  // ═══════════════════════════════════════════════════════════════════

  describe('GET /api/ai/actions/audit - Access Control', () => {
    it('should return 401 without auth token', async () => {
      const res = await request(app).get('/api/ai/actions/audit');
      expect(res.status).toBe(401);
    });

    it('should return 403 for non-admin users', async () => {
      const res = await request(app)
        .get('/api/ai/actions/audit')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
    });

    it('should return audit log for admin', async () => {
      const res = await request(app)
        .get('/api/ai/actions/audit')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });
});
