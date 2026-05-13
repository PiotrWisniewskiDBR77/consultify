import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { checkAccessMock } = vi.hoisted(() => ({
  checkAccessMock: vi.fn(),
}));

vi.mock('../../../../server/src/services/frameworkEntitlementService.js', () => ({
  default: {
    checkAccess: checkAccessMock,
  },
}));

import {
  requireDynamicFrameworkAccess,
  requireFrameworkAccess,
} from '../../../../server/src/middleware/frameworkEntitlement.middleware.ts';

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('frameworkEntitlement.middleware', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    checkAccessMock.mockResolvedValue({
      allowed: true,
      accessLevel: 'full',
      requiresLegalNotice: false,
    });
  });

  it('supports legacy user.organization_id', async () => {
    const req: any = { user: { organization_id: 'org-legacy' } };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireFrameworkAccess('DRD');

    await mw(req, res as any, next as any);

    expect(checkAccessMock).toHaveBeenCalledWith('org-legacy', 'DRD');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('falls back to legacy organization_id when organizationId accessor throws', async () => {
    const user: Record<string, unknown> = { organization_id: 'org-legacy-throw' };
    Object.defineProperty(user, 'organizationId', {
      configurable: true,
      get: () => {
        throw new Error('organizationId getter failed');
      },
    });
    const req: any = { user };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireFrameworkAccess('DRD');

    await mw(req, res as any, next as any);

    expect(checkAccessMock).toHaveBeenCalledWith('org-legacy-throw', 'DRD');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 503 when entitlement service throws', async () => {
    checkAccessMock.mockRejectedValueOnce(new Error('db unavailable'));
    const req: any = { user: { organizationId: 'org-1' } };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireFrameworkAccess('DRD');

    await mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 503 when static entitlement service resolves to non-object payload', async () => {
    checkAccessMock.mockResolvedValueOnce(null);
    const req: any = { user: { organizationId: 'org-1' } };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireFrameworkAccess('DRD');

    await mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'FRAMEWORK_ACCESS_CHECK_UNAVAILABLE', framework: 'DRD' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 503 when static entitlement allowed flag is non-boolean', async () => {
    checkAccessMock.mockResolvedValueOnce({
      allowed: 'false',
      accessLevel: 'full',
      requiresLegalNotice: false,
    });
    const req: any = { user: { organizationId: 'org-1' } };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireFrameworkAccess('DRD');

    await mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'FRAMEWORK_ACCESS_CHECK_UNAVAILABLE', framework: 'DRD' })
    );
    expect(next).not.toHaveBeenCalled();
    expect(req.frameworkAccess).toBeUndefined();
  });

  it('does not send 503 body when headers are already sent in static middleware catch path', async () => {
    checkAccessMock.mockRejectedValueOnce(new Error('db unavailable'));
    const req: any = { user: { organizationId: 'org-1' } };
    const res: any = makeRes();
    res.headersSent = true;
    const next = vi.fn();
    const mw = requireFrameworkAccess('DRD');

    await mw(req, res as any, next as any);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('dynamic middleware tolerates throwing params accessor and falls back to body', async () => {
    const req: any = { user: { organizationId: 'org-1' }, body: { frameworkId: 'cmmi' } };
    Object.defineProperty(req, 'params', {
      configurable: true,
      get: () => {
        throw new Error('params getter failed');
      },
    });
    const res = makeRes();
    const next = vi.fn();
    const mw = requireDynamicFrameworkAccess('frameworkId');

    await mw(req, res as any, next as any);

    expect(checkAccessMock).toHaveBeenCalledWith('org-1', 'CMMI');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not send 503 body when headers are already sent in dynamic middleware catch path', async () => {
    checkAccessMock.mockRejectedValueOnce(new Error('db unavailable'));
    const req: any = { user: { organizationId: 'org-1' }, params: { frameworkId: 'cmmi' } };
    const res: any = makeRes();
    res.headersSent = true;
    const next = vi.fn();
    const mw = requireDynamicFrameworkAccess('frameworkId');

    await mw(req, res as any, next as any);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 503 when dynamic entitlement service resolves to non-object payload', async () => {
    checkAccessMock.mockResolvedValueOnce('invalid');
    const req: any = { user: { organizationId: 'org-1' }, params: { frameworkId: 'cmmi' } };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireDynamicFrameworkAccess('frameworkId');

    await mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'FRAMEWORK_ACCESS_CHECK_UNAVAILABLE', framework: 'CMMI' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 503 when dynamic entitlement allowed flag is non-boolean', async () => {
    checkAccessMock.mockResolvedValueOnce({
      allowed: 'true',
      accessLevel: 'full',
      requiresLegalNotice: false,
    });
    const req: any = { user: { organizationId: 'org-1' }, params: { frameworkId: 'cmmi' } };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireDynamicFrameworkAccess('frameworkId');

    await mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'FRAMEWORK_ACCESS_CHECK_UNAVAILABLE', framework: 'CMMI' })
    );
    expect(next).not.toHaveBeenCalled();
    expect(req.frameworkAccess).toBeUndefined();
  });

  it('forwards error via next when static catch-path 503 body cannot be written and headers remain open', async () => {
    checkAccessMock.mockRejectedValueOnce(new Error('db unavailable'));
    const req: any = { user: { organizationId: 'org-1' } };
    const res: any = makeRes();
    res.json = vi.fn(() => {
      throw new Error('json failed');
    });
    const next = vi.fn();
    const mw = requireFrameworkAccess('DRD');

    await mw(req, res as any, next as any);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('forwards error via next when dynamic catch-path 503 body cannot be written and headers remain open', async () => {
    checkAccessMock.mockRejectedValueOnce(new Error('db unavailable'));
    const req: any = { user: { organizationId: 'org-1' }, params: { frameworkId: 'cmmi' } };
    const res: any = makeRes();
    res.json = vi.fn(() => {
      throw new Error('json failed');
    });
    const next = vi.fn();
    const mw = requireDynamicFrameworkAccess('frameworkId');

    await mw(req, res as any, next as any);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('returns 401 when static organizationId exceeds max length', async () => {
    const req: any = { user: { organizationId: 'o'.repeat(129) } };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireFrameworkAccess('DRD');

    await mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'UNAUTHORIZED' }));
    expect(checkAccessMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when dynamic organizationId exceeds max length', async () => {
    const req: any = { user: { organizationId: 'o'.repeat(129) }, params: { frameworkId: 'cmmi' } };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireDynamicFrameworkAccess('frameworkId');

    await mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'UNAUTHORIZED' }));
    expect(checkAccessMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('canonicalizes dynamic framework id with en-US locale casing', async () => {
    const req: any = { user: { organizationId: 'org-1' }, params: { frameworkId: 'iso-i' } };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireDynamicFrameworkAccess('frameworkId');

    await mw(req, res as any, next as any);

    expect(checkAccessMock).toHaveBeenCalledWith('org-1', 'ISO-I');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('supports custom paramName lookup from request body', async () => {
    const req: any = { user: { organizationId: 'org-1' }, params: {}, body: { fwCode: 'cmmi' } };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireDynamicFrameworkAccess('fwCode');

    await mw(req, res as any, next as any);

    expect(checkAccessMock).toHaveBeenCalledWith('org-1', 'CMMI');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('ignores inherited framework id from body prototype chain', async () => {
    const protoBody = { frameworkId: 'cmmi' };
    const req: any = {
      user: { organizationId: 'org-1' },
      params: {},
      body: Object.create(protoBody),
    };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireDynamicFrameworkAccess('frameworkId');

    await mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'BAD_REQUEST', message: 'Framework ID required' })
    );
    expect(checkAccessMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 503 when static entitlement check times out', async () => {
    vi.useFakeTimers();
    checkAccessMock.mockImplementationOnce(() => new Promise(() => undefined));
    const req: any = { user: { organizationId: 'org-1' } };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireFrameworkAccess('DRD');

    const pending = mw(req, res as any, next as any);
    await vi.advanceTimersByTimeAsync(8001);
    await pending;

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'FRAMEWORK_ACCESS_CHECK_UNAVAILABLE', framework: 'DRD' })
    );
    expect(next).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('returns 400 when dynamic framework id body source is a non-object string', async () => {
    const req: any = { user: { organizationId: 'org-1' }, params: {}, body: 'cmmi' };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireDynamicFrameworkAccess('frameworkId');

    await mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'BAD_REQUEST', message: 'Framework ID required' })
    );
    expect(checkAccessMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when dynamic framework id body source is an array', async () => {
    const req: any = { user: { organizationId: 'org-1' }, params: {}, body: ['cmmi'] };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireDynamicFrameworkAccess('frameworkId');

    await mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'BAD_REQUEST', message: 'Framework ID required' })
    );
    expect(checkAccessMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when dynamic framework id exceeds max length', async () => {
    const req: any = {
      user: { organizationId: 'org-1' },
      params: { frameworkId: 'x'.repeat(65) },
    };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireDynamicFrameworkAccess('frameworkId');

    await mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'BAD_REQUEST', message: 'Invalid framework ID' })
    );
    expect(checkAccessMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when dynamic framework id contains invalid characters', async () => {
    const req: any = {
      user: { organizationId: 'org-1' },
      params: { frameworkId: 'CM\nMI' },
    };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireDynamicFrameworkAccess('frameworkId');

    await mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(checkAccessMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 for static middleware when framework id is empty after trim', async () => {
    const req: any = { user: { organizationId: 'org-1' } };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireFrameworkAccess('   ');

    await mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'FRAMEWORK_GATE_MISCONFIGURED' }));
    expect(checkAccessMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 for static middleware when framework id contains invalid characters', async () => {
    const req: any = { user: { organizationId: 'org-1' } };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireFrameworkAccess('DRD\nCORE');

    await mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'FRAMEWORK_GATE_MISCONFIGURED' }));
    expect(checkAccessMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 for dynamic middleware when paramName is invalid', async () => {
    const req: any = { user: { organizationId: 'org-1' }, params: { frameworkId: 'cmmi' } };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireDynamicFrameworkAccess('bad-name');

    await mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'FRAMEWORK_GATE_MISCONFIGURED' }));
    expect(checkAccessMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('does not throw when json writer fails in static middleware error response', async () => {
    const req: any = { user: { organizationId: 'org-1' } };
    const res: any = makeRes();
    res.json = vi.fn(() => {
      throw new Error('json failed');
    });
    const next = vi.fn();
    const mw = requireFrameworkAccess('   ');

    await expect(mw(req, res as any, next as any)).resolves.toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('forwards next(error) when static unauthorized response cannot be written', async () => {
    const req: any = { user: {} };
    const res: any = makeRes();
    res.json = vi.fn(() => {
      throw new Error('json failed');
    });
    const next = vi.fn();
    const mw = requireFrameworkAccess('DRD');

    await mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('forwards next(error) when static deny response cannot be written', async () => {
    checkAccessMock.mockResolvedValueOnce({
      allowed: false,
      accessLevel: 'locked',
      reason: 'denied',
      upgradeCTA: 'upgrade',
    });
    const req: any = { user: { organizationId: 'org-1' } };
    const res: any = makeRes();
    res.json = vi.fn(() => {
      throw new Error('json failed');
    });
    const next = vi.fn();
    const mw = requireFrameworkAccess('DRD');

    await mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('still returns 403 when deny-path logger throws', async () => {
    checkAccessMock.mockResolvedValueOnce({
      allowed: false,
      accessLevel: 'locked',
      reason: 'denied',
      upgradeCTA: 'upgrade',
    });
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const loggerInfoSpy = vi.spyOn((await import('../../../../server/src/utils/Logger.js')).default, 'info');
    loggerInfoSpy.mockImplementationOnce(() => {
      throw new Error('logger failed');
    });
    const req: any = { user: { organizationId: 'org-1' } };
    const res: any = makeRes();
    const next = vi.fn();
    const mw = requireFrameworkAccess('DRD');

    await mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'FRAMEWORK_ACCESS_DENIED' }));
    expect(next).not.toHaveBeenCalled();
    infoSpy.mockRestore();
    loggerInfoSpy.mockRestore();
  });

  it('returns 400 instead of throwing when toLocaleUpperCase fails for dynamic framework id', async () => {
    const spy = vi.spyOn(String.prototype, 'toLocaleUpperCase').mockImplementation(function () {
      if (this.toString() === 'cmmi') {
        throw new Error('locale failure');
      }
      return this.toString().toUpperCase();
    });
    const req: any = { user: { organizationId: 'org-1' }, params: { frameworkId: 'cmmi' } };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireDynamicFrameworkAccess('frameworkId');

    await mw(req, res as any, next as any);
    spy.mockRestore();

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'BAD_REQUEST', message: 'Invalid framework ID' })
    );
    expect(checkAccessMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('normalizes frameworkAccess payload when service returns malformed access fields', async () => {
    checkAccessMock.mockResolvedValueOnce({
      allowed: true,
      accessLevel: 'NOT_A_LEVEL',
      requiresLegalNotice: 0,
    });
    const req: any = { user: { organizationId: 'org-1' } };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireFrameworkAccess('DRD');

    await mw(req, res as any, next as any);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.frameworkAccess).toEqual({
      allowed: true,
      accessLevel: 'locked',
      requiresLegalNotice: false,
    });
  });

  it('treats requiresLegalNotice as true only for strict boolean true', async () => {
    checkAccessMock.mockResolvedValueOnce({
      allowed: true,
      accessLevel: 'full',
      requiresLegalNotice: 'yes',
    });
    const req: any = { user: { organizationId: 'org-1' } };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireFrameworkAccess('DRD');

    await mw(req, res as any, next as any);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.frameworkAccess).toEqual({
      allowed: true,
      accessLevel: 'full',
      requiresLegalNotice: false,
    });
  });

  it('sanitizes deny payload fields from service result', async () => {
    checkAccessMock.mockResolvedValueOnce({
      allowed: false,
      accessLevel: 'NOT_A_LEVEL',
      reason: 'r'.repeat(800),
      upgradeCTA: 'c'.repeat(800),
      requiresLegalNotice: true,
    });
    const req: any = { user: { organizationId: 'org-1' } };
    const res = makeRes();
    const next = vi.fn();
    const mw = requireFrameworkAccess('DRD');

    await mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(403);
    const payload = res.json.mock.calls[0]?.[0];
    expect(payload.accessLevel).toBe('locked');
    expect(typeof payload.reason).toBe('string');
    expect(typeof payload.upgradeCTA).toBe('string');
    expect(payload.reason.length).toBeLessThanOrEqual(512);
    expect(payload.upgradeCTA.length).toBeLessThanOrEqual(512);
    expect(next).not.toHaveBeenCalled();
  });
});
