import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import routes from '../admin/ai-quality.routes.js';

const dbRun = vi.fn();
const dbAll = vi.fn();
const dbGet = vi.fn();
let user: any = { id: 'u1', organizationId: 'org-1', role: 'administrator' };

vi.mock('../../utils/DbPromise.js', () => ({
  all: (...args: any[]) => dbAll(...args),
  get: (...args: any[]) => dbGet(...args),
  run: (...args: any[]) => dbRun(...args),
}));
vi.mock('../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: any) => {
    if (!user) return res.status(401).end();
    req.user = user;
    next();
  },
}));

const app = () => {
  const a = express();
  a.use(express.json());
  a.use('/api/admin/ai-quality', routes);
  return a;
};

describe('ai quality admin route — cross-tenant mutation guards', () => {
  beforeEach(() => {
    user = { id: 'u1', organizationId: 'org-1', role: 'administrator' };
    dbRun.mockReset();
    dbAll.mockReset();
    dbGet.mockReset();
  });

  describe('POST /feedback/:id/review', () => {
    it('scopes the update to the token organization', async () => {
      dbRun.mockResolvedValue({ success: true, changes: 1 });
      const res = await request(app())
        .post('/api/admin/ai-quality/feedback/f1/review')
        .send({ actionTaken: 'fixed', notes: 'ok' });
      expect(res.status).toBe(200);
      expect(dbRun).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ? AND organization_id = ?'),
        ['u1', 'fixed', 'ok', 'f1', 'org-1']
      );
    });

    it('returns 404 and does not leak success when the feedback belongs to another organization', async () => {
      dbRun.mockResolvedValue({ success: true, changes: 0 });
      const res = await request(app())
        .post('/api/admin/ai-quality/feedback/foreign-1/review')
        .send({ actionTaken: 'fixed' });
      expect(res.status).toBe(404);
    });
  });

  describe('GET /metrics', () => {
    it('scopes every tenant-owned aggregate, including active patterns, to the token organization', async () => {
      dbGet
        .mockResolvedValueOnce({ total_feedback: 0, positive_count: 0, negative_count: 0 })
        .mockResolvedValueOnce({ count: 2 })
        .mockResolvedValueOnce({ count: 1 });
      dbAll.mockResolvedValue([]);

      const res = await request(app()).get('/api/admin/ai-quality/metrics');

      expect(res.status).toBe(200);
      const patternsCall = dbGet.mock.calls.find(([sql]) =>
        String(sql).includes('ai_style_learning_patterns')
      );
      expect(patternsCall?.[0]).toContain("status = 'active' AND organization_id = ?");
      expect(patternsCall?.[1]).toEqual(['org-1']);
      expect(res.body.metrics.activePatternsCount).toBe(2);
    });
  });

  describe('POST /patterns/:id/status', () => {
    it('scopes the update to the token organization', async () => {
      dbRun.mockResolvedValue({ success: true, changes: 1 });
      const res = await request(app())
        .post('/api/admin/ai-quality/patterns/p1/status')
        .send({ status: 'applied' });
      expect(res.status).toBe(200);
      expect(dbRun).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ? AND organization_id = ?'),
        ['applied', 'applied', 'p1', 'org-1']
      );
    });

    it('returns 404 when the pattern belongs to another organization (cross-tenant IDOR)', async () => {
      dbRun.mockResolvedValue({ success: true, changes: 0 });
      const res = await request(app())
        .post('/api/admin/ai-quality/patterns/foreign-pattern/status')
        .send({ status: 'rejected' });
      expect(res.status).toBe(404);
    });

    it('still rejects an invalid status before touching the database', async () => {
      const res = await request(app())
        .post('/api/admin/ai-quality/patterns/p1/status')
        .send({ status: 'not-a-real-status' });
      expect(res.status).toBe(400);
      expect(dbRun).not.toHaveBeenCalled();
    });
  });
});
