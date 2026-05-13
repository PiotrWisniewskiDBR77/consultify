import { describe, expect, it, vi } from 'vitest';

import {
  attachV8Context,
  getV8Context,
  requireV8OrgContext,
} from '../../../../server/src/middleware/v8Auth.middleware.ts';

function makeRes() {
  const res: any = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  res.json = vi.fn((payload: any) => {
    res.body = payload;
    return res;
  });
  return res;
}

describe('v8Auth.middleware', () => {
  it('requireV8OrgContext allows when organizationId exists', () => {
    const req: any = { organizationId: 'org-1' };
    const res = makeRes();
    const next = vi.fn();
    requireV8OrgContext(req, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requireV8OrgContext does not call next when headers are already sent', () => {
    const req: any = { organizationId: 'org-1' };
    const res: any = makeRes();
    res.headersSent = true;
    const next = vi.fn();
    requireV8OrgContext(req, res as any, next as any);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requireV8OrgContext does not call next when response is already writableEnded', () => {
    const req: any = { organizationId: 'org-1' };
    const res: any = makeRes();
    res.writableEnded = true;
    const next = vi.fn();
    requireV8OrgContext(req, res as any, next as any);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requireV8OrgContext denies when organizationId accessor throws', () => {
    const req: any = {};
    Object.defineProperty(req, 'organizationId', {
      configurable: true,
      get: () => {
        throw new Error('organizationId getter failed');
      },
    });
    const res = makeRes();
    const next = vi.fn();
    requireV8OrgContext(req, res as any, next as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireV8OrgContext allows when req.user.organizationId exists', () => {
    const req: any = { user: { organizationId: 'org-user' } };
    const res = makeRes();
    const next = vi.fn();
    requireV8OrgContext(req, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requireV8OrgContext allows when req.user.organization_id exists', () => {
    const req: any = { user: { organization_id: 'org-user-legacy' } };
    const res = makeRes();
    const next = vi.fn();
    requireV8OrgContext(req, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('attachV8Context attaches normalized context when required fields exist', () => {
    const req: any = {
      organizationId: '  org-1  ',
      userId: '  user-1  ',
      userRole: '  ADMIN  ',
      user: { isSuperAdmin: true },
    };
    const res = makeRes();
    const next = vi.fn();
    attachV8Context(req, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.v8Context).toEqual({
      organizationId: 'org-1',
      userId: 'user-1',
      userRole: 'ADMIN',
      isSuperAdmin: true,
    });
    expect(Object.isFrozen(req.v8Context)).toBe(true);
  });

  it('requireV8OrgContext denies oversized organization id', () => {
    const req: any = { organizationId: 'x'.repeat(257) };
    const res = makeRes();
    const next = vi.fn();
    requireV8OrgContext(req, res as any, next as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('requireV8OrgContext denies organization id with control characters', () => {
    const req: any = { organizationId: 'org-\u0000-1' };
    const res = makeRes();
    const next = vi.fn();
    requireV8OrgContext(req, res as any, next as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'V8_MISSING_ORG_CONTEXT' })
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect((res as any).statusCode).toBe(403);
    expect((res as any).body).toEqual(
      expect.objectContaining({ error: 'V8 operations require organization context' })
    );
    expect((res as any).body.code).toBe('V8_MISSING_ORG_CONTEXT');
    expect((res as any).body).toBeDefined();
    expect(next).not.toHaveBeenCalled();
  });

  it('attachV8Context denies when userId is missing', () => {
    const req: any = {
      organizationId: 'org-1',
      userRole: 'ADMIN',
      user: { isSuperAdmin: false },
    };
    const res = makeRes();
    const next = vi.fn();
    attachV8Context(req, res as any, next as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'V8_MISSING_USER_CONTEXT' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('attachV8Context denies when user id contains control characters', () => {
    const req: any = {
      organizationId: 'org-1',
      userId: 'user-\u0000-1',
      userRole: 'ADMIN',
    };
    const res = makeRes();
    const next = vi.fn();
    attachV8Context(req, res as any, next as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'V8_MISSING_USER_CONTEXT' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('attachV8Context denies with V8_MISSING_ORG_CONTEXT when org is missing', () => {
    const req: any = {
      userId: 'user-1',
      userRole: 'ADMIN',
    };
    const res = makeRes();
    const next = vi.fn();
    attachV8Context(req, res as any, next as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'V8_MISSING_ORG_CONTEXT' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('attachV8Context uses req.user fallback identifiers when top-level fields are missing', () => {
    const req: any = {
      user: { id: 'user-from-user', organizationId: 'org-from-user', isSuperAdmin: false },
    };
    const res = makeRes();
    const next = vi.fn();
    attachV8Context(req, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.v8Context).toEqual({
      organizationId: 'org-from-user',
      userId: 'user-from-user',
      userRole: '',
      isSuperAdmin: false,
    });
  });

  it('attachV8Context denies when req.user.id accessor throws and no top-level userId exists', () => {
    const req: any = { organizationId: 'org-1', user: {} };
    Object.defineProperty(req.user, 'id', {
      configurable: true,
      get: () => {
        throw new Error('user.id getter failed');
      },
    });
    const res = makeRes();
    const next = vi.fn();
    attachV8Context(req, res as any, next as any);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('attachV8Context bounds oversized userRole in attached context', () => {
    const req: any = {
      organizationId: 'org-1',
      userId: 'user-1',
      userRole: `  ${'A'.repeat(140)}  `,
    };
    const res = makeRes();
    const next = vi.fn();
    attachV8Context(req, res as any, next as any);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.v8Context.userRole.length).toBe(128);
    expect(req.v8Context.userRole).toBe('A'.repeat(128));
  });

  it('attachV8Context strips control characters from userRole before attach', () => {
    const req: any = {
      organizationId: 'org-1',
      userId: 'user-1',
      userRole: '  ADM\u0000IN  ',
    };
    const res = makeRes();
    const next = vi.fn();

    attachV8Context(req, res as any, next as any);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.v8Context.userRole).toBe('ADMIN');
  });

  it('attachV8Context sets empty userRole when role contains only control chars', () => {
    const req: any = {
      organizationId: 'org-1',
      userId: 'user-1',
      userRole: '\u0001\u0002\u0003',
    };
    const res = makeRes();
    const next = vi.fn();

    attachV8Context(req, res as any, next as any);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.v8Context.userRole).toBe('');
  });

  it('requireV8OrgContext sets no-store headers on deny response', () => {
    const req: any = { organizationId: '' };
    const res: any = makeRes();
    res.setHeader = vi.fn();
    const next = vi.fn();

    requireV8OrgContext(req, res as any, next as any);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(res.setHeader).toHaveBeenCalledWith('Expires', '0');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('attachV8Context sets no-store headers on deny response', () => {
    const req: any = { organizationId: 'org-1' };
    const res: any = makeRes();
    res.setHeader = vi.fn();
    const next = vi.fn();

    attachV8Context(req, res as any, next as any);

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(res.setHeader).toHaveBeenCalledWith('Pragma', 'no-cache');
    expect(res.setHeader).toHaveBeenCalledWith('Expires', '0');
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'V8_MISSING_USER_CONTEXT' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('getV8Context throws when context not attached', () => {
    const req: any = {};
    expect(() => getV8Context(req)).toThrow('V8 context not attached');
  });

  it('getV8Context throws when context has missing userId', () => {
    const req: any = { v8Context: { organizationId: 'org-1', userRole: 'ADMIN', isSuperAdmin: false } };
    expect(() => getV8Context(req)).toThrow('V8 context not attached');
  });

  it('getV8Context throws when v8Context accessor throws', () => {
    const req: any = {};
    Object.defineProperty(req, 'v8Context', {
      configurable: true,
      get: () => {
        throw new Error('v8Context getter failed');
      },
    });
    expect(() => getV8Context(req)).toThrow('V8 context not attached');
  });

  it('attachV8Context returns controlled 403 when v8Context assignment throws', () => {
    const req: any = {
      organizationId: 'org-1',
      userId: 'user-1',
      userRole: 'ADMIN',
    };
    Object.defineProperty(req, 'v8Context', {
      configurable: true,
      set: () => {
        throw new Error('v8Context setter failed');
      },
    });
    const res = makeRes();
    const next = vi.fn();

    attachV8Context(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'V8_CONTEXT_ATTACH_FAILED' })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
