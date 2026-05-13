import { describe, expect, it } from 'vitest';

import {
  getRequestAccessRole,
  getSettingsActorRole,
  isRequestSuperAdmin,
  normalizeAccessRole,
} from '../../../../server/src/middleware/requestAccess.ts';

describe('requestAccess middleware helpers', () => {
  it('normalizeAccessRole maps common aliases', () => {
    expect(normalizeAccessRole('SUPER_ADMIN')).toBe('superadmin');
    expect(normalizeAccessRole('administrator')).toBe('admin');
    expect(normalizeAccessRole('viewer')).toBe('guest');
  });

  it('normalizeAccessRole treats non-string non-number role values as empty', () => {
    expect(normalizeAccessRole({} as any)).toBe('');
    expect(normalizeAccessRole([] as any)).toBe('');
    expect(normalizeAccessRole(true as any)).toBe('');
  });

  it('normalizeAccessRole strips control characters before alias mapping', () => {
    expect(normalizeAccessRole('ADMIN\u0000')).toBe('admin');
    expect(normalizeAccessRole('SUPER_ADMIN\n')).toBe('superadmin');
  });

  it('normalizeAccessRole strips zero-width format characters before alias mapping', () => {
    expect(normalizeAccessRole('\u200BADMIN\uFEFF')).toBe('admin');
    expect(normalizeAccessRole('\u200BSUPER_ADMIN')).toBe('superadmin');
  });

  it('normalizeAccessRole strips bidi/isolate controls before alias mapping', () => {
    expect(normalizeAccessRole('ADMIN\u202E')).toBe('admin');
    expect(normalizeAccessRole('\u2066SUPER_ADMIN\u2069')).toBe('superadmin');
  });

  it('normalizeAccessRole strips word-joiner and invisible math format controls', () => {
    expect(normalizeAccessRole('\u2060ADMIN\u2062')).toBe('admin');
    expect(normalizeAccessRole('\u2060SUPER_ADMIN\u2063')).toBe('superadmin');
  });

  it('normalizeAccessRole accepts boxed String roles', () => {
    expect(normalizeAccessRole(new String('ADMIN') as any)).toBe('admin');
    expect(normalizeAccessRole(new String('SUPER_ADMIN') as any)).toBe('superadmin');
  });

  it('normalizeAccessRole bounds oversized input length', () => {
    expect(normalizeAccessRole(`${'x'.repeat(200)}ADMIN`)).toBe('member');
  });

  it('normalizeAccessRole applies NFKC normalization for full-width aliases', () => {
    expect(normalizeAccessRole('\uFF21\uFF24\uFF2D\uFF29\uFF2E')).toBe('admin');
    expect(normalizeAccessRole('\uFF33\uFF35\uFF30\uFF25\uFF32\uFF3F\uFF21\uFF24\uFF2D\uFF29\uFF2E')).toBe(
      'superadmin'
    );
  });

  it('normalizeAccessRole stringifies bigint inputs consistently', () => {
    expect(normalizeAccessRole(1n as any)).toBe('member');
    expect(normalizeAccessRole(1234567890123456789n as any)).toBe('member');
  });

  it('isRequestSuperAdmin returns false when user accessor throws', () => {
    const req: any = { userRole: 'member' };
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });

    expect(isRequestSuperAdmin(req)).toBe(false);
  });

  it('isRequestSuperAdmin requires strict boolean isSuperAdmin=true', () => {
    expect(
      isRequestSuperAdmin({
        user: { isSuperAdmin: 'true' as unknown as boolean },
        userRole: 'member',
      } as any)
    ).toBe(false);
    expect(
      isRequestSuperAdmin({
        user: { isSuperAdmin: 1 as unknown as boolean },
        userRole: 'member',
      } as any)
    ).toBe(false);
    expect(
      isRequestSuperAdmin({
        user: { isSuperAdmin: false },
        userRole: 'superadmin',
      } as any)
    ).toBe(true);
  });

  it('getRequestAccessRole does not elevate for non-boolean isSuperAdmin values', () => {
    expect(
      getRequestAccessRole({
        user: { isSuperAdmin: 'true' as unknown as boolean, role: 'ADMIN' },
        userRole: 'member',
      } as any)
    ).toBe('member');
  });

  it('getRequestAccessRole falls back safely when userRole accessor throws', () => {
    const req: any = { user: { role: 'ADMIN' } };
    Object.defineProperty(req, 'userRole', {
      configurable: true,
      get: () => {
        throw new Error('userRole getter failed');
      },
    });

    expect(getRequestAccessRole(req)).toBe('admin');
  });

  it('getRequestAccessRole ignores object-shaped userRole and falls back to req.user.role', () => {
    const req: any = { userRole: { admin: true }, user: { role: 'ADMIN' } };
    expect(getRequestAccessRole(req)).toBe('admin');
  });

  it('getRequestAccessRole reads userRole getter at most once', () => {
    let reads = 0;
    const req: any = { user: { role: 'member', isSuperAdmin: false } };
    Object.defineProperty(req, 'userRole', {
      configurable: true,
      get: () => {
        reads += 1;
        return 'member';
      },
    });

    expect(getRequestAccessRole(req)).toBe('member');
    expect(reads).toBe(1);
  });

  it('getRequestAccessRole reads req.user accessor only once', () => {
    let userReads = 0;
    const req: any = { userRole: undefined };
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        userReads += 1;
        return { role: 'ADMIN', isSuperAdmin: false };
      },
    });

    expect(getRequestAccessRole(req)).toBe('admin');
    expect(userReads).toBe(1);
  });

  it('getSettingsActorRole defaults to member on throwing accessors', () => {
    const req: any = {};
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });
    Object.defineProperty(req, 'userRole', {
      configurable: true,
      get: () => {
        throw new Error('userRole getter failed');
      },
    });

    expect(getSettingsActorRole(req)).toBe('member');
  });

  it('getSettingsActorRole resolves with a single userRole read', () => {
    let reads = 0;
    const req: any = { user: { role: 'ADMIN', isSuperAdmin: false } };
    Object.defineProperty(req, 'userRole', {
      configurable: true,
      get: () => {
        reads += 1;
        return 'admin';
      },
    });

    expect(getSettingsActorRole(req)).toBe('admin');
    expect(reads).toBe(1);
  });
});
