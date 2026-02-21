import { fileURLToPath } from 'node:url';

import { describe, it, expect, vi } from 'vitest';

function createReq(overrides: Partial<any> = {}) {
  return {
    method: 'POST',
    path: '/api/test',
    headers: { 'content-type': 'application/json' },
    body: {},
    query: {},
    ...overrides,
  } as any;
}

describe('inputSanitizationMiddleware loader fallback (L1)', () => {
  it('uses fallback spec when preferred import fails (covers catch path)', async () => {
    vi.resetModules();

    const sanitizeObject = vi.fn((x: any) => ({ ...x, __fromFallback: true }));

    const tsUrl = new URL('../../../../server/src/utils/security.utils.ts', import.meta.url);
    const jsUrl = new URL('../../../../server/src/utils/security.utils.js', import.meta.url);
    const tsPath = fileURLToPath(tsUrl);
    const jsPath = fileURLToPath(jsUrl);

    const tsIds = [tsPath, tsUrl.href, `/@fs${tsPath}`, '../../../../server/src/utils/security.utils.ts'];
    const jsIds = [jsPath, jsUrl.href, `/@fs${jsPath}`, '../../../../server/src/utils/security.utils.js'];

    const safeDoMock = (id: string, factory: () => any) => {
      try {
        vi.doMock(id, factory);
      } catch {
        // Ignore duplicate registrations if Vitest normalizes ids differently.
      }
    };
    const safeDoUnmock = (id: string) => {
      try {
        vi.doUnmock(id);
      } catch {
        // Ignore if id was not registered in this runtime.
      }
    };

    for (const id of tsIds) {
      safeDoMock(id, () => {
        throw new Error('preferred import failed');
      });
    }
    for (const id of jsIds) safeDoMock(id, () => ({ sanitizeObject }));

    try {
      const mod = await import('../../../../server/src/middleware/inputSanitization.middleware.ts');
      const req = createReq({ body: { html: '<b>bold</b>' } });
      const next = vi.fn();

      await mod.inputSanitizationMiddleware(req, {} as any, next);

      expect(next).toHaveBeenCalled();
      expect(sanitizeObject).toHaveBeenCalled();
      expect(req.body.__fromFallback).toBe(true);
    } finally {
      for (const id of tsIds) safeDoUnmock(id);
      for (const id of jsIds) safeDoUnmock(id);
    }
  });
});

