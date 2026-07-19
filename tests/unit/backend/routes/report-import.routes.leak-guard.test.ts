/**
 * H6.4 500-leak sweep (fala 3, ogon) — proof that report-import.routes.ts no
 * longer echoes a raw `error.message` to the client on its 500 paths.
 *
 * Before the fix, EVERY catch block in this file did
 * `res.status(500).json({ success: false, error: error.message })` — a
 * uniform, file-wide leak (13 occurrences) despite each block already
 * calling `logger.error(...)` with the real error server-side. This test
 * forces an unexpected exception on the simplest route
 * (`GET /supported-formats`) and proves the raw text never reaches the
 * response body.
 */
import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-1', role: 'ADMIN', organizationId: 'org-1' };
    req.userId = 'user-1';
    req.organizationId = 'org-1';
    next();
  },
}));

const RAW_LEAK_TEXT = 'ECONNREFUSED 127.0.0.1:5432 — internal service registry lookup failed';

vi.mock('../../../../server/src/services/reportImportService.js', () => ({
  default: class ReportImportService {
    setDependencies() {
      /* no-op — the injected-dependency middleware calls this on every request */
    }
    getSupportedFormats() {
      throw new Error(RAW_LEAK_TEXT);
    }
    getSupportedFrameworks() {
      return [];
    }
  },
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

async function buildApp() {
  const { default: router } = await import('../../../../server/src/routes/report-import.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/report-import', router);
  return app;
}

describe('report-import GET /supported-formats — 500-leak guard', () => {
  it('does NOT echo the raw exception message to the client', async () => {
    const app = await buildApp();
    const res = await request(app).get('/report-import/supported-formats');

    expect(res.status).toBe(500);
    const bodyText = JSON.stringify(res.body);
    expect(bodyText).not.toContain(RAW_LEAK_TEXT);
    expect(bodyText).not.toContain('ECONNREFUSED');
    expect(res.body).toMatchObject({
      success: false,
      error: 'Failed to load supported formats',
    });
  });
});
