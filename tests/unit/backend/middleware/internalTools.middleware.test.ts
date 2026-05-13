import { beforeEach, describe, expect, it, vi } from 'vitest';

import { requireInternalToolsAccess } from '../../../../server/src/middleware/internalTools.middleware.ts';

describe('internalTools.middleware', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('NODE_ENV', 'test');
  });

  it('returns 404 when user email accessor throws', () => {
    const user: Record<string, unknown> = {
      role: 'ADMIN',
      organizationId: 'org-1',
    };
    Object.defineProperty(user, 'email', {
      enumerable: true,
      get: () => {
        throw new Error('email getter failed');
      },
    });

    const req: any = { user, organizationId: 'org-1' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when user role accessor throws', () => {
    const user: Record<string, unknown> = {
      email: 'owner@dbr77.com',
      organizationId: 'org-1',
    };
    Object.defineProperty(user, 'role', {
      enumerable: true,
      get: () => {
        throw new Error('role getter failed');
      },
    });

    const req: any = { user, organizationId: 'org-1' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when email lacks @ even if domain token is allowlisted', () => {
    vi.stubEnv('INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS', 'dbr77.com');
    const req: any = {
      user: {
        email: 'dbr77.com',
        role: 'ADMIN',
        organizationId: 'org-1',
      },
      organizationId: 'org-1',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when email contains multiple @ separators', () => {
    vi.stubEnv('INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS', 'dbr77.com');
    const req: any = {
      user: {
        email: 'admin@segment@dbr77.com',
        role: 'ADMIN',
        organizationId: 'org-1',
      },
      organizationId: 'org-1',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when email contains ASCII control characters', () => {
    vi.stubEnv('INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS', 'dbr77.com');
    const req: any = {
      user: {
        email: 'admin\u0000@dbr77.com',
        role: 'ADMIN',
        organizationId: 'org-1',
      },
      organizationId: 'org-1',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when organizationId contains ASCII control characters', () => {
    vi.stubEnv('INTERNAL_TOOLS_ALLOWED_ORG_IDS', 'org-1');
    const req: any = {
      user: {
        email: 'admin@dbr77.com',
        role: 'ADMIN',
        organizationId: 'org-\u0000-1',
      },
      organizationId: 'org-1',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when organizationId exceeds max supported length', () => {
    vi.stubEnv('INTERNAL_TOOLS_ALLOWED_ORG_IDS', 'org-1');
    const req: any = {
      user: {
        email: 'admin@dbr77.com',
        role: 'ADMIN',
        organizationId: 'o'.repeat(129),
      },
      organizationId: 'org-1',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when mailbox host contains whitespace', () => {
    vi.stubEnv('INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS', 'dbr77.com');
    const req: any = {
      user: {
        email: 'admin@d br77.com',
        role: 'ADMIN',
        organizationId: 'org-1',
      },
      organizationId: 'org-1',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when email local-part contains whitespace before @', () => {
    vi.stubEnv('INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS', 'dbr77.com');
    const req: any = {
      user: {
        email: 'admin @dbr77.com',
        role: 'ADMIN',
        organizationId: 'org-1',
      },
      organizationId: 'org-1',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when mailbox host contains consecutive dots', () => {
    vi.stubEnv('INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS', 'dbr77.com');
    const req: any = {
      user: {
        email: 'admin@db..r77.com',
        role: 'ADMIN',
        organizationId: 'org-1',
      },
      organizationId: 'org-1',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when mailbox domain exceeds max supported length', () => {
    const longDomain = 'a'.repeat(254);
    vi.stubEnv('INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS', longDomain);
    const req: any = {
      user: {
        email: `admin@${longDomain}`,
        role: 'ADMIN',
        organizationId: 'org-1',
      },
      organizationId: 'org-1',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when email local-part exceeds max supported length', () => {
    vi.stubEnv('INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS', 'dbr77.com');
    const req: any = {
      user: {
        email: `${'a'.repeat(65)}@dbr77.com`,
        role: 'ADMIN',
        organizationId: 'org-1',
      },
      organizationId: 'org-1',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when role is a non-string object that stringifies to ADMIN', () => {
    const user: Record<string, unknown> = {
      email: 'admin@dbr77.com',
      organizationId: 'org-1',
    };
    Object.defineProperty(user, 'role', {
      enumerable: true,
      value: { toString: () => 'ADMIN' },
    });

    const req: any = { user, organizationId: 'org-1' };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when role exceeds max supported length', () => {
    const req: any = {
      user: {
        email: 'admin@dbr77.com',
        role: 'A'.repeat(65),
        organizationId: 'org-1',
      },
      organizationId: 'org-1',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows access for valid internal user', () => {
    const req: any = {
      user: {
        email: 'admin@dbr77.com',
        role: 'ADMIN',
        organizationId: 'org-1',
      },
      organizationId: 'org-1',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('falls back to default allowlists when internal-tools env csv is oversized', () => {
    vi.stubEnv('INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS', 'x'.repeat(5000));
    vi.stubEnv('INTERNAL_TOOLS_ALLOWED_ROLES', 'y'.repeat(5000));
    const req: any = {
      user: {
        email: 'admin@dbr77.com',
        role: 'ADMIN',
        organizationId: 'org-1',
      },
      organizationId: 'org-1',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows access when only legacy organization_id exists on user', () => {
    const req: any = {
      user: {
        email: 'admin@dbr77.com',
        role: 'ADMIN',
        organization_id: 'org-legacy',
      },
      organizationId: undefined,
    };
    vi.stubEnv('INTERNAL_TOOLS_ALLOWED_ORG_IDS', 'org-legacy');

    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('enables internal tools in production when INTERNAL_TOOLS_ENABLED is whitespace-padded', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('INTERNAL_TOOLS_ENABLED', '  true  ');
    const req: any = {
      user: {
        email: 'admin@dbr77.com',
        role: 'ADMIN',
        organizationId: 'org-1',
      },
      organizationId: 'org-1',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 404 in production when INTERNAL_TOOLS_ENABLED is not strictly true', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('INTERNAL_TOOLS_ENABLED', 'false');
    const req: any = {
      user: {
        email: 'admin@dbr77.com',
        role: 'ADMIN',
        organizationId: 'org-1',
      },
      organizationId: 'org-1',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when INTERNAL_TOOLS_ALLOWED_ORG_IDS contains control characters', () => {
    vi.stubEnv('INTERNAL_TOOLS_ALLOWED_ORG_IDS', `org-1,org-${String.fromCharCode(7)}-bad`);
    const req: any = {
      user: {
        email: 'admin@dbr77.com',
        role: 'ADMIN',
        organizationId: 'org-1',
      },
      organizationId: 'org-1',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when INTERNAL_TOOLS_ALLOWED_ORG_IDS contains oversized org id token', () => {
    vi.stubEnv('INTERNAL_TOOLS_ALLOWED_ORG_IDS', `org-1,${'o'.repeat(129)}`);
    const req: any = {
      user: {
        email: 'admin@dbr77.com',
        role: 'ADMIN',
        organizationId: 'org-1',
      },
      organizationId: 'org-1',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS contains control characters', () => {
    vi.stubEnv('INTERNAL_TOOLS_ALLOWED_EMAIL_DOMAINS', `dbr77.com,db${String.fromCharCode(7)}r77.com`);
    const req: any = {
      user: {
        email: 'admin@dbr77.com',
        role: 'ADMIN',
        organizationId: 'org-1',
      },
      organizationId: 'org-1',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 when INTERNAL_TOOLS_ALLOWED_ROLES contains oversized token', () => {
    vi.stubEnv('INTERNAL_TOOLS_ALLOWED_ROLES', `ADMIN,${'A'.repeat(65)}`);
    const req: any = {
      user: {
        email: 'admin@dbr77.com',
        role: 'ADMIN',
        organizationId: 'org-1',
      },
      organizationId: 'org-1',
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('falls back to legacy organization_id when organizationId accessor throws', () => {
    const user: Record<string, unknown> = {
      email: 'admin@dbr77.com',
      role: 'ADMIN',
      organization_id: 'org-legacy-throw',
    };
    Object.defineProperty(user, 'organizationId', {
      enumerable: true,
      get: () => {
        throw new Error('organizationId getter failed');
      },
    });
    const req: any = { user, organizationId: undefined };
    vi.stubEnv('INTERNAL_TOOLS_ALLOWED_ORG_IDS', 'org-legacy-throw');

    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    requireInternalToolsAccess(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
