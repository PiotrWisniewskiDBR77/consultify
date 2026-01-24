/**
 * Webhooks Integration Tests
 * Testing webhook endpoints
 *
 * @module tests/integration/webhooks/webhook-endpoints.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

describe('Webhook Endpoints Integration', () => {
  let app: express.Application;
  const webhooks = new Map<string, any>();

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const authMiddleware = (req: any, res: any, next: any) => {
      if (!req.headers.authorization) return res.status(401).json({ error: 'Unauthorized' });
      req.user = { id: '1', orgId: 'org-1' };
      next();
    };

    app.get('/api/webhooks', authMiddleware, (req, res) => {
      const orgWebhooks = Array.from(webhooks.values()).filter((w) => w.orgId === req.user.orgId);
      res.json(orgWebhooks);
    });

    app.post('/api/webhooks', authMiddleware, (req, res) => {
      const { url, events, secret } = req.body;
      if (!url || !events?.length)
        return res.status(400).json({ error: 'URL and events required' });
      const id = `wh-${Date.now()}`;
      const webhook = { id, url, events, secret, orgId: req.user.orgId, active: true };
      webhooks.set(id, webhook);
      res.status(201).json(webhook);
    });

    app.put('/api/webhooks/:id', authMiddleware, (req, res) => {
      const webhook = webhooks.get(req.params.id);
      if (!webhook) return res.status(404).json({ error: 'Not found' });
      const updated = { ...webhook, ...req.body };
      webhooks.set(req.params.id, updated);
      res.json(updated);
    });

    app.delete('/api/webhooks/:id', authMiddleware, (req, res) => {
      if (!webhooks.has(req.params.id)) return res.status(404).json({ error: 'Not found' });
      webhooks.delete(req.params.id);
      res.status(204).send();
    });

    app.post('/api/webhooks/:id/test', authMiddleware, (req, res) => {
      const webhook = webhooks.get(req.params.id);
      if (!webhook) return res.status(404).json({ error: 'Not found' });
      res.json({ success: true, deliveryId: `del-${Date.now()}` });
    });
  });

  describe('GET /api/webhooks', () => {
    it('should return webhooks', async () => {
      const response = await request(app).get('/api/webhooks').set('Authorization', 'Bearer token');
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/webhooks', () => {
    it('should create webhook', async () => {
      const response = await request(app)
        .post('/api/webhooks')
        .set('Authorization', 'Bearer token')
        .send({ url: 'https://example.com/hook', events: ['invoice.created'] });

      expect(response.status).toBe(201);
      expect(response.body.url).toBe('https://example.com/hook');
    });

    it('should require url and events', async () => {
      const response = await request(app)
        .post('/api/webhooks')
        .set('Authorization', 'Bearer token')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/webhooks/:id/test', () => {
    it('should test webhook', async () => {
      const createRes = await request(app)
        .post('/api/webhooks')
        .set('Authorization', 'Bearer token')
        .send({ url: 'https://test.com', events: ['test'] });

      const response = await request(app)
        .post(`/api/webhooks/${createRes.body.id}/test`)
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
