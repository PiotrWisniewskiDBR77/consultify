/**
 * Comments Integration Tests
 * Testing comment endpoints
 *
 * @module tests/integration/comments/comment-endpoints.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

describe('Comment Endpoints Integration', () => {
  let app: express.Application;
  const comments = new Map<string, any>();

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const authMiddleware = (req: any, res: any, next: any) => {
      if (!req.headers.authorization) return res.status(401).json({ error: 'Unauthorized' });
      req.user = { id: '1', name: 'Test User' };
      next();
    };

    app.get('/api/comments', authMiddleware, (req, res) => {
      const { resourceType, resourceId } = req.query;
      let result = Array.from(comments.values());
      if (resourceType && resourceId) {
        result = result.filter(
          (c) => c.resourceType === resourceType && c.resourceId === resourceId
        );
      }
      res.json(result);
    });

    app.post('/api/comments', authMiddleware, (req, res) => {
      const { content, resourceType, resourceId, parentId } = req.body;
      if (!content || !resourceType || !resourceId) {
        return res.status(400).json({ error: 'Content, resourceType and resourceId required' });
      }
      const id = `comment-${Date.now()}`;
      const comment = {
        id,
        content,
        resourceType,
        resourceId,
        parentId,
        authorId: req.user.id,
        authorName: req.user.name,
        createdAt: new Date().toISOString(),
      };
      comments.set(id, comment);
      res.status(201).json(comment);
    });

    app.put('/api/comments/:id', authMiddleware, (req, res) => {
      const comment = comments.get(req.params.id);
      if (!comment) return res.status(404).json({ error: 'Not found' });
      if (comment.authorId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });
      comment.content = req.body.content;
      comment.updatedAt = new Date().toISOString();
      res.json(comment);
    });

    app.delete('/api/comments/:id', authMiddleware, (req, res) => {
      const comment = comments.get(req.params.id);
      if (!comment) return res.status(404).json({ error: 'Not found' });
      comments.delete(req.params.id);
      res.status(204).send();
    });
  });

  describe('GET /api/comments', () => {
    it('should return comments', async () => {
      const response = await request(app).get('/api/comments').set('Authorization', 'Bearer token');
      expect(response.status).toBe(200);
    });

    it('should filter by resource', async () => {
      const response = await request(app)
        .get('/api/comments?resourceType=task&resourceId=task-1')
        .set('Authorization', 'Bearer token');
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/comments', () => {
    it('should create comment', async () => {
      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', 'Bearer token')
        .send({ content: 'Test comment', resourceType: 'task', resourceId: 'task-1' });

      expect(response.status).toBe(201);
      expect(response.body.content).toBe('Test comment');
    });

    it('should require content', async () => {
      const response = await request(app)
        .post('/api/comments')
        .set('Authorization', 'Bearer token')
        .send({ resourceType: 'task', resourceId: 'task-1' });

      expect(response.status).toBe(400);
    });
  });
});
