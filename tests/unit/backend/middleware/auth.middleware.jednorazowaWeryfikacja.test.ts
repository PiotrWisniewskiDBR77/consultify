/**
 * WYDAJNOSC [ODMROZENIE 06_EXECUTION DEC-453] — `verifyToken` liczy sie RAZ na
 * zadanie.
 *
 * Dlaczego ten plik istnieje. Pomiar 2026-09-08 na kopii danych DBR77
 * (104 inicjatywy / 197 zadan), licznikiem wpietym na wejsciu `verifyToken`:
 *
 *   GET /api/initiatives/runtime-v1/execution-cases/<id>/allocations
 *   => verifyToken #1 .. #8   (OSIEM pelnych weryfikacji na JEDNO zadanie)
 *
 * Bierze sie to ze zlozenia montowan — `Gateway.ts` zaklada `verifyToken` przed
 * routerem, a router i jego pod-routery zakladaja go ponownie przez
 * `router.use(verifyToken)`. Kazde przejscie to komplet zapytan do bazy
 * (`organization_members`, `revoked_tokens`, `user_sessions` + UPDATE
 * aktywnosci). W logu Postgresa: 28 zapytan na to jedno zadanie, z czego 22 to
 * powtorzenia; po naprawie 17.
 *
 * Test pilnuje DWOCH rzeczy naraz, bo tylko razem sa prawda:
 *  1) powtorzone przejscie nie dokłada round-tripow do bazy,
 *  2) bramka nadal ODRZUCA to, co odrzucala — skrot nie moze stac sie furtka.
 *
 * MUTACJA RED (sprawdzona recznie 2026-09-08): usuniecie skrotu z
 * `auth.middleware.ts` (bloku `if (juz === klucz && maPrincipala)`) wywraca
 * „nie odpytuje bazy drugi raz" — licznik idzie z 1 na 8.
 */
import { NextFunction, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AuthRequest,
  setDependencies,
  verifyToken,
  __private__,
} from '../../../../server/src/middleware/auth.middleware.ts';

const mockJwt = { verify: vi.fn(), decode: vi.fn() };
const mockConfig = { JWT_SECRET: 'test-secret' };
const mockPermissionService = { can: vi.fn() };
const mockDbGet = vi.fn();

function nowyRes() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
  } as unknown as Response;
}

describe('verifyToken — jedna weryfikacja na zadanie [DEC-453]', () => {
  let req: Partial<AuthRequest>;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDbGet.mockReset();
    mockJwt.verify.mockReset();
    __private__.resetRevocationCachesForTests();

    // `safeGetHeader` czyta naglowki przez `req.get(...)` (Express), a nie przez
    // `req.headers[...]` — sztuczny obiekt bez tej metody udawalby, ze zaden
    // naglowek kontekstu organizacji nie istnieje, i test przepuscilby regresje.
    const naglowki: Record<string, string> = {};
    req = {
      headers: naglowki,
      body: {},
      query: {},
      cookies: {},
      path: '/test',
      get: ((nazwa: string) => naglowki[String(nazwa).toLowerCase()]) as never,
    };
    res = nowyRes();
    next = vi.fn();

    setDependencies({
      jwt: mockJwt as never,
      config: mockConfig,
      PermissionService: mockPermissionService,
      dbGet: mockDbGet,
    });

    process.env.NODE_ENV = 'test';
    process.env.E2E_MODE = 'false';
    process.env.ENABLE_TEST_AUTH_BYPASS = 'false';
    process.env.MOCK_DB = 'false';
  });

  it('osiem przejsc przez ten sam token nie odpytuje bazy osiem razy', async () => {
    req.headers!['authorization'] = 'Bearer token-abc';
    mockJwt.verify.mockImplementation((_t: unknown, _s: unknown, cb: (e: unknown, p: unknown) => void) => {
      cb(null, { id: 'user-1', role: 'ADMIN', organizationId: 'org-1' });
    });
    mockDbGet.mockResolvedValue(null);

    await verifyToken(req as AuthRequest, res, next);
    const poPierwszym = mockDbGet.mock.calls.length;

    // tyle razy, ile realnie zlicza sie na jednym zadaniu w produkcji
    for (let i = 0; i < 7; i += 1) {
      await verifyToken(req as AuthRequest, res, next);
    }

    expect(next).toHaveBeenCalledTimes(8);
    expect(req.user?.id).toBe('user-1');
    // sedno: siedem dalszych przejsc nie dorzuca ANI JEDNEGO zapytania
    expect(mockDbGet.mock.calls.length).toBe(poPierwszym);
  });

  it('zmiana tokenu w tym samym zadaniu wymusza pelna weryfikacje od nowa', async () => {
    req.headers!['authorization'] = 'Bearer token-abc';
    mockJwt.verify.mockImplementation((t: unknown, _s: unknown, cb: (e: unknown, p: unknown) => void) => {
      cb(null, { id: t === 'token-abc' ? 'user-1' : 'user-2', role: 'ADMIN', organizationId: 'org-1' });
    });
    mockDbGet.mockResolvedValue(null);

    await verifyToken(req as AuthRequest, res, next);
    expect(req.user?.id).toBe('user-1');

    // inny token => inny principal; skrot NIE moze oddac poprzedniego wyniku
    req.headers!['authorization'] = 'Bearer token-xyz';
    await verifyToken(req as AuthRequest, res, next);

    expect(req.user?.id).toBe('user-2');
    expect(mockJwt.verify).toHaveBeenCalledTimes(2);
  });

  it('zmiana naglowka kontekstu organizacji wymusza pelna weryfikacje od nowa', async () => {
    req.headers!['authorization'] = 'Bearer token-abc';
    mockJwt.verify.mockImplementation((_t: unknown, _s: unknown, cb: (e: unknown, p: unknown) => void) => {
      cb(null, { id: 'user-1', role: 'ADMIN', organizationId: 'org-1' });
    });
    mockDbGet.mockResolvedValue(null);

    await verifyToken(req as AuthRequest, res, next);
    const poPierwszym = mockJwt.verify.mock.calls.length;

    req.headers!['x-organization-id'] = 'org-2';
    await verifyToken(req as AuthRequest, res, next);

    expect(mockJwt.verify.mock.calls.length).toBeGreaterThan(poPierwszym);
  });

  it('bez tokenu nadal odrzuca — skrot nie tworzy furtki', async () => {
    await verifyToken(req as AuthRequest, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('odrzucony token nie zostawia znacznika, ktory przepuscilby kolejne przejscie', async () => {
    req.headers!['authorization'] = 'Bearer zly-token';
    mockJwt.verify.mockImplementation((_t: unknown, _s: unknown, cb: (e: unknown, p: unknown) => void) => {
      cb(new Error('invalid signature'), undefined);
    });

    await verifyToken(req as AuthRequest, res, next);
    await verifyToken(req as AuthRequest, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    // druga proba MUSI znowu policzyc podpis, a nie zobaczyc „juz sprawdzone"
    expect(mockJwt.verify).toHaveBeenCalledTimes(2);
  });
});
