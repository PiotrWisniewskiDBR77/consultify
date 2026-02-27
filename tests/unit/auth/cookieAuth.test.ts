import { describe, expect, it, vi } from 'vitest';

type CookieCall = [string, string, Record<string, any>];

describe('cookieAuth helpers', () => {
  it('setAccessTokenCookie sets access token with /api path', async () => {
    const { setAccessTokenCookie, ACCESS_TOKEN_COOKIE } = await import(
      '../../../server/src/utils/cookieAuth'
    );
    const res = { cookie: vi.fn() } as any;
    setAccessTokenCookie(res, 'access-token');
    const call = res.cookie.mock.calls[0] as CookieCall;
    expect(call[0]).toBe(ACCESS_TOKEN_COOKIE);
    expect(call[1]).toBe('access-token');
    expect(call[2]).toMatchObject({ path: '/api', httpOnly: true, sameSite: 'lax' });
  });

  it('setRefreshTokenCookie sets refresh token with /api/auth path', async () => {
    const { setRefreshTokenCookie, REFRESH_TOKEN_COOKIE } = await import(
      '../../../server/src/utils/cookieAuth'
    );
    const res = { cookie: vi.fn() } as any;
    setRefreshTokenCookie(res, 'refresh-token');
    const call = res.cookie.mock.calls[0] as CookieCall;
    expect(call[0]).toBe(REFRESH_TOKEN_COOKIE);
    expect(call[1]).toBe('refresh-token');
    expect(call[2]).toMatchObject({ path: '/api/auth', httpOnly: true, sameSite: 'lax' });
  });

  it('setAuthCookies sets both cookies', async () => {
    const cookieAuth = await import('../../../server/src/utils/cookieAuth');
    const res = { cookie: vi.fn() } as any;
    cookieAuth.setAuthCookies(res, 'access', 'refresh');
    expect(res.cookie).toHaveBeenCalledTimes(2);
  });

  it('clearAuthCookies clears both cookies', async () => {
    const { clearAuthCookies, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } = await import(
      '../../../server/src/utils/cookieAuth'
    );
    const res = { clearCookie: vi.fn() } as any;
    clearAuthCookies(res);
    expect(res.clearCookie).toHaveBeenCalledWith(
      ACCESS_TOKEN_COOKIE,
      expect.objectContaining({ path: '/api', httpOnly: true, sameSite: 'lax' })
    );
    expect(res.clearCookie).toHaveBeenCalledWith(
      REFRESH_TOKEN_COOKIE,
      expect.objectContaining({ path: '/api/auth', httpOnly: true, sameSite: 'lax' })
    );
  });

  it('uses secure cookies in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    vi.resetModules();
    const { setAccessTokenCookie } = await import('../../../server/src/utils/cookieAuth');
    const res = { cookie: vi.fn() } as any;
    setAccessTokenCookie(res, 'token');
    const call = res.cookie.mock.calls[0] as CookieCall;
    expect(call[2].secure).toBe(true);
    process.env.NODE_ENV = originalEnv;
  });
});
