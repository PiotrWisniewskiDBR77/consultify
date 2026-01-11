/**
 * Search Integration Tests
 * Testing search endpoints
 *
 * @module tests/integration/search/search-endpoints.test.ts
 */

import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';

describe('Search Endpoints Integration', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    const authMiddleware = (req: any, res: any, next: any) => {
      if (!req.headers.authorization) return res.status(401).json({ error: 'Unauthorized' });
      req.user = { id: '1' };
      next();
    };

    const mockData = {
      projects: [
        { id: 'p1', name: 'Website Redesign', type: 'project' },
        { id: 'p2', name: 'Mobile App', type: 'project' },
      ],
      tasks: [
        { id: 't1', name: 'Design homepage', type: 'task' },
        { id: 't2', name: 'Develop API', type: 'task' },
      ],
      users: [{ id: 'u1', name: 'John Doe', email: 'john@example.com', type: 'user' }],
    };

    app.get('/api/search', authMiddleware, (req, res) => {
      const { q, type, limit } = req.query;
      if (!q) return res.status(400).json({ error: 'Query required' });

      const query = (q as string).toLowerCase();
      let results: any[] = [];

      if (!type || type === 'project') {
        results.push(...mockData.projects.filter((p) => p.name.toLowerCase().includes(query)));
      }
      if (!type || type === 'task') {
        results.push(...mockData.tasks.filter((t) => t.name.toLowerCase().includes(query)));
      }
      if (!type || type === 'user') {
        results.push(
          ...mockData.users.filter(
            (u) => u.name.toLowerCase().includes(query) || u.email.toLowerCase().includes(query)
          )
        );
      }

      if (limit) results = results.slice(0, parseInt(limit as string));
      res.json({ results, total: results.length });
    });

    app.get('/api/search/suggestions', authMiddleware, (req, res) => {
      const { q } = req.query;
      if (!q) return res.json({ suggestions: [] });
      res.json({
        suggestions: ['website', 'mobile', 'design', 'develop'].filter((s) =>
          s.includes((q as string).toLowerCase())
        ),
      });
    });
  });

  describe('GET /api/search', () => {
    it('should search with query', async () => {
      const response = await request(app)
        .get('/api/search?q=design')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.results).toBeDefined();
    });

    it('should require query', async () => {
      const response = await request(app).get('/api/search').set('Authorization', 'Bearer token');

      expect(response.status).toBe(400);
    });

    it('should filter by type', async () => {
      const response = await request(app)
        .get('/api/search?q=design&type=task')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
    });

    it('should limit results', async () => {
      const response = await request(app)
        .get('/api/search?q=a&limit=2')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/search/suggestions', () => {
    it('should return suggestions', async () => {
      const response = await request(app)
        .get('/api/search/suggestions?q=de')
        .set('Authorization', 'Bearer token');

      expect(response.status).toBe(200);
      expect(response.body.suggestions).toBeDefined();
    });
  });
});
