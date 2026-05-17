import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockHasPermission,
  mockCanApprove,
  mockCanCertify,
  mockValidateWorkflowTransition,
} = vi.hoisted(() => ({
  mockHasPermission: vi.fn(),
  mockCanApprove: vi.fn(),
  mockCanCertify: vi.fn(),
  mockValidateWorkflowTransition: vi.fn(),
}));

vi.mock('../../../../server/src/services/frameworkRBACService.js', () => ({
  FrameworkRBACService: {
    hasPermission: mockHasPermission,
    canApprove: mockCanApprove,
    canCertify: mockCanCertify,
    validateWorkflowTransition: mockValidateWorkflowTransition,
  },
}));

import {
  assessmentRBAC,
  hasPermission,
  multiFrameworkRBAC,
  requireFrameworkApprover,
  requireFrameworkCertifier,
  validateWorkflowTransition,
} from '../../../../server/src/middleware/assessmentRBAC.ts';

describe('assessmentRBAC.middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockResolvedValue(true);
    mockCanApprove.mockResolvedValue(true);
    mockCanCertify.mockResolvedValue(true);
    mockValidateWorkflowTransition.mockResolvedValue({ allowed: true });
  });

  it('returns 401 when user accessor throws in multiFrameworkRBAC', async () => {
    const middleware = multiFrameworkRBAC('read');
    const req: any = { params: {}, query: {}, body: {} };
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('assessmentRBAC returns 401 for missing user', () => {
    const middleware = assessmentRBAC('read');
    const req: any = {};
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'Authentication required' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('assessmentRBAC returns 403 for insufficient permission', () => {
    const middleware = assessmentRBAC('delete');
    const req: any = {
      user: { role: 'VIEWER' },
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ required: 'assessment:delete', userRole: 'VIEWER' })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('assessmentRBAC does not write deny response when headers are already sent', () => {
    const middleware = assessmentRBAC('delete');
    const req: any = {
      user: { role: 'VIEWER' },
    };
    const res: any = {
      headersSent: true,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    middleware(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('falls back to general allow when framework accessor throws', async () => {
    const middleware = multiFrameworkRBAC('read');
    const req: any = {
      user: { id: 'u-1', role: 'ORG_ADMIN' },
      params: {},
      query: {},
      body: {},
    };
    Object.defineProperty(req, 'params', {
      configurable: true,
      get: () => {
        throw new Error('params getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses organizationId fallback when organization_id accessor throws in framework check', async () => {
    const middleware = multiFrameworkRBAC('read');
    const user: any = { id: 'u-1', role: 'ORG_ADMIN', organizationId: 'org-fallback' };
    Object.defineProperty(user, 'organization_id', {
      configurable: true,
      get: () => {
        throw new Error('organization_id getter failed');
      },
    });
    const req: any = {
      user,
      params: { framework: 'cmmi' },
      query: {},
      body: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(mockHasPermission).toHaveBeenCalledWith('u-1', 'CMMI', 'read', {
      organizationId: 'org-fallback',
      projectId: undefined,
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when projectId is oversized in framework-specific permission check', async () => {
    const middleware = multiFrameworkRBAC('read');
    const req: any = {
      user: { id: 'u-1', role: 'ORG_ADMIN', organization_id: 'org-1' },
      params: { framework: 'cmmi', projectId: 'p'.repeat(129) },
      query: {},
      body: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Invalid project or organization identifier' })
    );
    expect(mockHasPermission).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('does not call next on frameworkless allow path when headers are already sent', async () => {
    const middleware = multiFrameworkRBAC('read');
    const req: any = {
      user: { id: 'u-1', role: 'ORG_ADMIN' },
      params: {},
      query: {},
      body: {},
    };
    const res: any = {
      headersSent: true,
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('maps messy role strings to permission keys in hasPermission', () => {
    expect(hasPermission({ role: ' org_admin ' } as any, 'read', 'assessment')).toBe(true);
    expect(hasPermission({ role: 'org_admin' } as any, 'update', 'assessment')).toBe(true);
    expect(hasPermission({ role: 'viewer' } as any, 'read', 'assessment')).toBe(true);
    expect(hasPermission({ role: '   ' } as any, 'read', 'assessment')).toBe(true);
    expect(hasPermission({ role: 'viewer' } as any, 'delete', 'assessment')).toBe(false);
  });

  it('coerces integer user ids when calling framework RBAC', async () => {
    const middleware = multiFrameworkRBAC('read');
    const req: any = {
      user: { id: 12345, role: 'ORG_ADMIN' },
      params: { framework: 'cmmi' },
      query: {},
      body: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(mockHasPermission).toHaveBeenCalledWith('12345', 'CMMI', 'read', {
      organizationId: undefined,
      projectId: undefined,
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 500 from requireFrameworkApprover when service throws', async () => {
    mockCanApprove.mockRejectedValueOnce(new Error('boom'));
    const middleware = requireFrameworkApprover('SIRI');
    const req: any = { user: { id: 'u-1' }, params: {}, query: {}, body: {} };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('uses resolved framework from request for approver deny payload when factory arg is missing', async () => {
    mockCanApprove.mockResolvedValueOnce(false);
    const middleware = requireFrameworkApprover(undefined);
    const req: any = { user: { id: 'u-1' }, params: { framework: 'cmmi' }, query: {}, body: {} };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        framework: 'cmmi',
        message: expect.stringContaining('cmmi'),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 500 from requireFrameworkCertifier when service throws', async () => {
    mockCanCertify.mockRejectedValueOnce(new Error('boom'));
    const middleware = requireFrameworkCertifier('CMMI');
    const req: any = { user: { id: 'u-1' }, params: {}, query: {}, body: {} };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it('uses resolved framework from request for certifier deny payload when factory arg is missing', async () => {
    mockCanCertify.mockResolvedValueOnce(false);
    const middleware = requireFrameworkCertifier(undefined);
    const req: any = { user: { id: 'u-1' }, params: { framework: 'siri' }, query: {}, body: {} };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        framework: 'siri',
        message: expect.stringContaining('siri'),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 for oversized framework key in multiFrameworkRBAC and skips service check', async () => {
    const middleware = multiFrameworkRBAC('read');
    const req: any = {
      user: { id: 'u-1', role: 'ORG_ADMIN' },
      params: { framework: 'x'.repeat(65) },
      query: {},
      body: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockHasPermission).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 for oversized framework key in requireFrameworkApprover', async () => {
    const middleware = requireFrameworkApprover(undefined);
    const req: any = {
      user: { id: 'u-1' },
      params: { framework: 'x'.repeat(65) },
      query: {},
      body: {},
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockCanApprove).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('skips transition validation when from/to status accessors throw', async () => {
    const req: any = {
      user: { id: 'u-1' },
      params: {},
      query: {},
      body: {},
    };
    Object.defineProperty(req, 'body', {
      configurable: true,
      get: () => {
        throw new Error('body getter failed');
      },
    });
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await validateWorkflowTransition(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockValidateWorkflowTransition).not.toHaveBeenCalled();
  });

  it('returns 400 when validateWorkflowTransition receives oversized framework key', async () => {
    const req: any = {
      user: { id: 'u-1' },
      params: { framework: 'x'.repeat(65) },
      query: {},
      body: { fromStatus: 'draft', toStatus: 'review' },
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await validateWorkflowTransition(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockValidateWorkflowTransition).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 400 when validateWorkflowTransition receives oversized fromStatus', async () => {
    const req: any = {
      user: { id: 'u-1' },
      params: { framework: 'cmmi' },
      query: {},
      body: { fromStatus: 's'.repeat(129), toStatus: 'review' },
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await validateWorkflowTransition(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockValidateWorkflowTransition).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('passes uppercase framework to workflow transition validation', async () => {
    const req: any = {
      user: { id: 'u-1' },
      params: { framework: 'cmmi' },
      query: {},
      body: { fromStatus: 'draft', toStatus: 'review' },
    };
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();

    await validateWorkflowTransition(req, res, next);

    expect(mockValidateWorkflowTransition).toHaveBeenCalledWith(
      'u-1',
      'CMMI',
      'draft',
      'review'
    );
    expect(next).toHaveBeenCalledTimes(1);
  });
});
