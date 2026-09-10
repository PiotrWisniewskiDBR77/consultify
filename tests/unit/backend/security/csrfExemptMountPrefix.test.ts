/**
 * P4 BEZPIECZENSTWO (2026-09-10): zwolnienia CSRF a punkt montazu.
 *
 * DEFEKT: `csrfProtectionMiddleware` jest montowany przez
 * `app.use('/api/', ...)`, wiec Express podaje `req.path` WZGLEDNA wobec
 * punktu montazu ('/auth/login'), a `req.baseUrl` = '/api'. Lista zwolnien
 * porownywala wylacznie z '/api/auth/login', wiec kazde zwolnienie bylo
 * martwe. Zmierzone na zywym serwerze (CSRF_MODE=enforce):
 * POST /api/auth/login, /register, /refresh, /reset-password oraz
 * /api/webhooks/stripe zwracaly 403 CSRF_MISSING.
 *
 * Ten test odtwarza ksztalt zadania z Expressa (path wzgledna + baseUrl)
 * i pilnuje, ze zwolnienie dziala, a trasa chroniona nadal jest blokowana.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), http: vi.fn(), debug: vi.fn() },
}));

import { csrfProtectionMiddleware } from '../../../../server/src/middleware/csrf.middleware';

function mounted(method: string, baseUrl: string, path: string) {
  const req = { method, baseUrl, path, cookies: {}, headers: {} } as any;
  const res = { setHeader: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
  const next = vi.fn();
  return { req, res, next };
}

describe('zwolnienia CSRF przy montazu na /api/', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env.CSRF_MODE = 'enforce';
    process.env.ENABLE_CSRF_IN_TESTS = 'true';
  });

  afterEach(() => {
    process.env = { ...original };
    vi.clearAllMocks();
  });

  it.each([
    ['/auth/login'],
    ['/auth/register'],
    ['/auth/refresh'],
    ['/auth/reset-password'],
    ['/webhooks/stripe'],
  ])('przepuszcza zwolniona trase %s podana jako sciezka wzgledna', (relative) => {
    const { req, res, next } = mounted('POST', '/api', relative);
    csrfProtectionMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('nadal blokuje trase chroniona bez tokenu (kontrola negatywna)', () => {
    const { req, res, next } = mounted('POST', '/api', '/tasks');
    csrfProtectionMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('przepuszcza zwolniona trase podana jako sciezka pelna (montaz na roocie)', () => {
    const { req, res, next } = mounted('POST', '', '/api/auth/login');
    csrfProtectionMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
