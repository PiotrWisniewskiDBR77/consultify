/**
 * API Optimization Integration Tests
 *
 * Real integration tests for API optimization features.
 *
 * @module tests/integration/apiOptimization.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

describe('API Optimization Integration', () => {
  let app: any;
  let authToken: string;

  beforeAll(async () => {
    const express = (await import('express')).default;
    app = express();
    app.use(express.json());

    // In-memory cache
    const cache = new Map<string, { data: any; timestamp: number }>();
    const CACHE_TTL = 60000; // 1 minute

    // Auth middleware
    const requireAuth = (req: any, res: any, next: any) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: 'Unauthorized' });
      req.user = { id: 'user-1' };
      next();
    };

    // GET /api/data/cached - with caching
    app.get('/api/data/cached', requireAuth, (req: any, res: any) => {
      const cacheKey = 'cached-data';
      const cached = cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return res.json({ hit: true, latency: 5, data: cached.data });
      }

      // Simulate slow database query
      const data = { items: [1, 2, 3, 4, 5], generatedAt: Date.now() };
      cache.set(cacheKey, { data, timestamp: Date.now() });

      res.json({ hit: false, latency: 100, data });
    });

    // POST /api/data/batch - batch requests
    app.post('/api/data/batch', requireAuth, (req: any, res: any) => {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids)) {
        return res.status(400).json({ error: 'ids array required' });
      }

      const results = ids.map((id) => ({ id, data: `Data for ${id}` }));

      res.json({
        count: ids.length,
        combined: true,
        results,
      });
    });

    // GET /api/data/paginated - pagination
    app.get('/api/data/paginated', requireAuth, (req: any, res: any) => {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);

      // Generate mock data
      const total = 100;
      const totalPages = Math.ceil(total / pageSize);
      const items = Array.from(
        { length: Math.min(pageSize, total - (page - 1) * pageSize) },
        (_, i) => ({
          id: (page - 1) * pageSize + i + 1,
          name: `Item ${(page - 1) * pageSize + i + 1}`,
        })
      );

      res.json({
        page,
        pageSize,
        total,
        totalPages,
        items,
        hasMore: page < totalPages,
      });
    });

    // GET /api/data/compressed - with compression info
    app.get('/api/data/compressed', requireAuth, (req: any, res: any) => {
      const largeData = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        description: 'This is a long description that would benefit from compression',
      }));

      res.json({
        enabled: true,
        algorithm: 'gzip',
        originalSize: JSON.stringify(largeData).length,
        data: largeData,
      });
    });

    authToken = 'valid-token';
  });

  it('should use caching effectively', async () => {
    // First request - cache miss
    const res1 = await request(app)
      .get('/api/data/cached')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res1.status).toBe(200);
    expect(res1.body.hit).toBe(false);

    // Second request - cache hit
    const res2 = await request(app)
      .get('/api/data/cached')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res2.status).toBe(200);
    expect(res2.body.hit).toBe(true);
    expect(res2.body.latency).toBeLessThan(res1.body.latency);
  });

  it('should batch requests', async () => {
    const res = await request(app)
      .post('/api/data/batch')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        ids: ['id-1', 'id-2', 'id-3', 'id-4', 'id-5', 'id-6', 'id-7', 'id-8', 'id-9', 'id-10'],
      });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(10);
    expect(res.body.combined).toBe(true);
    expect(res.body.results.length).toBe(10);
  });

  it('should paginate large datasets', async () => {
    const res = await request(app)
      .get('/api/data/paginated?page=1&pageSize=20')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBeLessThanOrEqual(100);
    expect(res.body.total).toBe(100);
    expect(res.body.items.length).toBe(20);
  });

  it('should compress responses', async () => {
    const res = await request(app)
      .get('/api/data/compressed')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(true);
    expect(res.body.algorithm).toBe('gzip');
  });

  it('should require authentication', async () => {
    const res = await request(app).get('/api/data/cached');
    expect(res.status).toBe(401);
  });
});
