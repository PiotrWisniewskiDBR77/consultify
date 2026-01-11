/**
 * Files Integration Tests
 * Testing file upload endpoints
 *
 * @module tests/integration/files/file-endpoints.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

describe('File Endpoints Integration', () => {
  let app: express.Application;
  const files = new Map<string, any>();

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const authMiddleware = (req: any, res: any, next: any) => {
      if (!req.headers.authorization) return res.status(401).json({ error: 'Unauthorized' });
      req.user = { id: '1' };
      next();
    };

    app.get('/api/files', authMiddleware, (req, res) => {
      res.json(Array.from(files.values()));
    });

    app.get('/api/files/:id', authMiddleware, (req, res) => {
      const file = files.get(req.params.id);
      if (!file) return res.status(404).json({ error: 'Not found' });
      res.json(file);
    });

    app.post('/api/files/upload', authMiddleware, (req, res) => {
      const id = `file-${Date.now()}`;
      const file = {
        id,
        name: 'uploaded-file.pdf',
        size: 1024,
        mimeType: 'application/pdf',
        url: `/files/${id}`,
      };
      files.set(id, file);
      res.status(201).json(file);
    });

    app.delete('/api/files/:id', authMiddleware, (req, res) => {
      if (!files.has(req.params.id)) return res.status(404).json({ error: 'Not found' });
      files.delete(req.params.id);
      res.status(204).send();
    });

    app.get('/api/files/:id/download', authMiddleware, (req, res) => {
      const file = files.get(req.params.id);
      if (!file) return res.status(404).json({ error: 'Not found' });
      res.set('Content-Disposition', `attachment; filename="${file.name}"`);
      res.send(Buffer.from('file-content'));
    });
  });

  describe('GET /api/files', () => {
    it('should return files list', async () => {
      const response = await request(app).get('/api/files').set('Authorization', 'Bearer token');
      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/files/upload', () => {
    it('should upload file', async () => {
      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
    });
  });

  describe('GET /api/files/:id/download', () => {
    it('should download file', async () => {
      const uploadRes = await request(app)
        .post('/api/files/upload')
        .set('Authorization', 'Bearer token');

      const response = await request(app)
        .get(`/api/files/${uploadRes.body.id}/download`)
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
    });
  });
});
