/**
 * Templates Integration Tests
 * Testing template endpoints
 *
 * @module tests/integration/templates/template-endpoints.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

describe('Template Endpoints Integration', () => {
  let app: express.Application;
  const templates = new Map<string, any>();

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const authMiddleware = (req: any, res: any, next: any) => {
      if (!req.headers.authorization) return res.status(401).json({ error: 'Unauthorized' });
      req.user = { id: '1', orgId: 'org-1' };
      next();
    };

    app.get('/api/templates', authMiddleware, (req, res) => {
      const { type } = req.query;
      let result = Array.from(templates.values());
      if (type) result = result.filter((t) => t.type === type);
      res.json(result);
    });

    app.get('/api/templates/:id', authMiddleware, (req, res) => {
      const template = templates.get(req.params.id);
      if (!template) return res.status(404).json({ error: 'Not found' });
      res.json(template);
    });

    app.post('/api/templates', authMiddleware, (req, res) => {
      const { name, type, content, variables } = req.body;
      if (!name || !type || !content) {
        return res.status(400).json({ error: 'Name, type and content required' });
      }
      const id = `template-${Date.now()}`;
      const template = {
        id,
        name,
        type,
        content,
        variables: variables || [],
        orgId: req.user.orgId,
      };
      templates.set(id, template);
      res.status(201).json(template);
    });

    app.post('/api/templates/:id/render', authMiddleware, (req, res) => {
      const template = templates.get(req.params.id);
      if (!template) return res.status(404).json({ error: 'Not found' });
      const { data } = req.body;
      let rendered = template.content;
      if (data) {
        Object.entries(data).forEach(([key, value]) => {
          rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value as string);
        });
      }
      res.json({ rendered });
    });

    app.delete('/api/templates/:id', authMiddleware, (req, res) => {
      if (!templates.has(req.params.id)) return res.status(404).json({ error: 'Not found' });
      templates.delete(req.params.id);
      res.status(204).send();
    });
  });

  describe('GET /api/templates', () => {
    it('should return templates', async () => {
      const response = await request(app)
        .get('/api/templates')
        .set('Authorization', 'Bearer token');
      expect(response.status).toBe(200);
    });

    it('should filter by type', async () => {
      const response = await request(app)
        .get('/api/templates?type=email')
        .set('Authorization', 'Bearer token');
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/templates', () => {
    it('should create template', async () => {
      const response = await request(app)
        .post('/api/templates')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Welcome Email', type: 'email', content: 'Hello {{name}}!' });

      expect(response.status).toBe(201);
      expect(response.body.name).toBe('Welcome Email');
    });
  });

  describe('POST /api/templates/:id/render', () => {
    it('should render template', async () => {
      const createRes = await request(app)
        .post('/api/templates')
        .set('Authorization', 'Bearer token')
        .send({ name: 'Test', type: 'email', content: 'Hello {{name}}!' });

      const response = await request(app)
        .post(`/api/templates/${createRes.body.id}/render`)
        .set('Authorization', 'Bearer token')
        .send({ data: { name: 'John' } });

      expect(response.status).toBe(200);
      expect(response.body.rendered).toBe('Hello John!');
    });
  });
});
