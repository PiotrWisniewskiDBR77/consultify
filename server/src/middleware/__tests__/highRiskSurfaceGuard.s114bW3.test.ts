/**
 * S1.14b / W3 — the export 403 body must speak English (DEC-461).
 *
 * The block itself is deliberate policy (TRIAL_EXPORT_ENABLED, default off) and
 * stays: these tests pin that a TRIAL org is still refused, and that the sentence
 * it is refused with is English and names the plan, instead of the Polish
 * "Ta funkcja jest czasowo wyłączona dla triala." the UI rendered verbatim.
 */
import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbGet = vi.fn();
vi.mock('../../utils/DbPromise.js', () => ({ get: (...a: unknown[]) => dbGet(...a) }));
vi.mock('../../utils/RequestStore.js', () => ({
  memoizeInRequest: async (_k: string, fn: () => unknown) => fn(),
}));

import { highRiskSurfaceGuard } from '../highRiskSurfaceGuard.middleware';

const run = async (path: string) => {
  const req = {
    method: 'GET',
    originalUrl: path,
    url: path,
    path,
    user: { id: 'u1', organizationId: 'org-1' },
  } as unknown as Request;
  const json = vi.fn();
  const res = { status: vi.fn().mockReturnThis(), json } as unknown as Response;
  const next = vi.fn() as unknown as NextFunction;
  await highRiskSurfaceGuard()(req, res, next);
  return { res, json, next };
};

describe('S1.14b/W3 — trial export block', () => {
  beforeEach(() => {
    dbGet.mockReset();
    dbGet.mockImplementation(async (sql: string) => {
      if (/FROM users/i.test(sql)) return { user_status: 'ACTIVE' };
      return { organization_type: 'TRIAL' };
    });
    delete process.env.TRIAL_EXPORT_ENABLED;
  });

  it('still refuses the export for a TRIAL organization (policy unchanged)', async () => {
    const { res, json, next } = await run('/api/document-studio/artifact-1/export/docx');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'TRIAL_EXPORT_DISABLED' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('explains it in English and names the plan', async () => {
    const { json } = await run('/api/document-studio/artifact-1/export/pdf');
    const body = json.mock.calls[0][0] as Record<string, unknown>;
    expect(body.message).toBe('Export is available on paid plans.');
    expect(body.messageEn).toBe('Export is available on paid plans.');
    expect(String(body.message)).not.toMatch(/Ta funkcja|triala/);
    expect((body.cta as { label: string }).label).toBe('Contact us');
  });

  it('lets the export through when the flag is on', async () => {
    process.env.TRIAL_EXPORT_ENABLED = 'true';
    const { res, next } = await run('/api/document-studio/artifact-1/export/pdf');
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
