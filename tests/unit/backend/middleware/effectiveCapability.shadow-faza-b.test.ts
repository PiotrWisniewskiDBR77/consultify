/**
 * Faza B (2026-07-14, spec model ról PM #25/#28/#30/#35) — shadow guards.
 *
 * Every guard added in Faza B is wired with `{ shadow: true }`, which is
 * governed by the CAPABILITY_ENFORCE env flag (default 'shadow'). These tests
 * prove the doctrine: in shadow mode the middleware NEVER blocks — it logs the
 * `[capabilityShadow]` telemetry line and always calls next(), even when the
 * caller lacks the capability, project context is missing, or the access
 * service throws. Only CAPABILITY_ENFORCE=enforce turns verdicts into 403s.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockResolveEffectiveAccess, mockHasEffectiveCapability, mockQueryOne, mockLoggerInfo } =
  vi.hoisted(() => ({
    mockResolveEffectiveAccess: vi.fn(),
    mockHasEffectiveCapability: vi.fn(),
    mockQueryOne: vi.fn(),
    mockLoggerInfo: vi.fn(),
  }));

vi.mock('../../../../server/src/services/effectiveAccessService.js', () => ({
  resolveEffectiveAccess: mockResolveEffectiveAccess,
  hasEffectiveCapability: mockHasEffectiveCapability,
}));

vi.mock('../../../../server/src/utils/queryHelpers.js', () => ({
  queryOne: mockQueryOne,
}));

vi.mock('../../../../server/src/utils/Logger.js', () => ({
  default: {
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  requireAnyProjectCapability,
  requireInitiativeCapability,
  requireProjectCapability,
} from '../../../../server/src/middleware/effectiveCapability.middleware.ts';

// Capabilities wired to shadow guards in Faza B (one per family is enough —
// the middleware treats the capability name as opaque).
const FAZA_B_SAMPLE_CAPS = [
  'initiative.program.manage',
  'initiative.template.manage',
  'initiative.milestone.manage',
  'initiative.stakeholder.manage',
  'initiative.pir.manage',
  'change.champion.manage',
  'project.delete',
  'project.archive',
];

const makeReq = () => ({
  userId: 'u-1',
  organizationId: 'org-1',
  userRole: 'USER',
  user: { id: 'u-1', organizationId: 'org-1' },
  params: { projectId: 'p-1' },
  body: {},
  query: {},
  path: '/x',
  method: 'POST',
});

const makeRes = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });

describe('Faza B shadow guards — never block in shadow mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.CAPABILITY_ENFORCE;
    delete process.env.EFFECTIVE_ACCESS_ENFORCE;
    delete process.env.EFFECTIVE_ACCESS_SHADOW;
    mockResolveEffectiveAccess.mockResolvedValue({ capabilities: [], projectRole: 'OBSERVER' });
    mockHasEffectiveCapability.mockReturnValue(false);
    mockQueryOne.mockResolvedValue(null);
  });

  afterEach(() => {
    delete process.env.CAPABILITY_ENFORCE;
  });

  it.each(FAZA_B_SAMPLE_CAPS)(
    'shadow guard for %s calls next() even when capability is missing',
    async (capability) => {
      const middleware = requireProjectCapability(capability, undefined, { shadow: true });
      const req: any = makeReq();
      const res: any = makeRes();
      const next = vi.fn();

      await middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    }
  );

  it('emits the [capabilityShadow] telemetry line with wouldAllow=false', async () => {
    const middleware = requireProjectCapability('initiative.milestone.manage', undefined, {
      shadow: true,
    });
    const req: any = makeReq();
    const res: any = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(mockLoggerInfo).toHaveBeenCalledWith(
      '[capabilityShadow]',
      expect.objectContaining({
        mode: 'shadow',
        capability: 'initiative.milestone.manage',
        wouldAllow: false,
      })
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('requireInitiativeCapability variant (Faza B wiring) does not block in shadow', async () => {
    const middleware = requireInitiativeCapability('initiative.raid.manage', { shadow: true });
    const req: any = makeReq();
    const res: any = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requireAnyProjectCapability variant (projects settings/team pairs) does not block in shadow', async () => {
    const middleware = requireAnyProjectCapability(
      ['project.settings.manage', 'project.settings.update'],
      undefined,
      { shadow: true }
    );
    const req: any = makeReq();
    const res: any = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('does not block when project context is missing (org-level assets, allowWithoutProject)', async () => {
    const middleware = requireProjectCapability('initiative.template.manage', undefined, {
      shadow: true,
      allowWithoutProject: true,
    });
    const req: any = { ...makeReq(), params: {} };
    const res: any = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('does not block when project context is missing even WITHOUT allowWithoutProject', async () => {
    const middleware = requireProjectCapability('initiative.milestone.manage', undefined, {
      shadow: true,
    });
    const req: any = { ...makeReq(), params: {} };
    const res: any = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(mockLoggerInfo).toHaveBeenCalledWith(
      '[capabilityShadow]',
      expect.objectContaining({ mode: 'shadow', status: 'no_project' })
    );
  });

  it('does not block when resolveEffectiveAccess throws in shadow mode', async () => {
    mockResolveEffectiveAccess.mockRejectedValueOnce(new Error('access service down'));
    const middleware = requireProjectCapability('project.delete', undefined, { shadow: true });
    const req: any = makeReq();
    const res: any = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('CAPABILITY_ENFORCE=enforce turns the same guard into a real 403', async () => {
    process.env.CAPABILITY_ENFORCE = 'enforce';
    const middleware = requireProjectCapability('initiative.milestone.manage', undefined, {
      shadow: true,
    });
    const req: any = makeReq();
    const res: any = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'CAPABILITY_REQUIRED' }));
    expect(next).not.toHaveBeenCalled();
  });

  it('CAPABILITY_ENFORCE=enforce still allows when capability is granted', async () => {
    process.env.CAPABILITY_ENFORCE = 'enforce';
    mockHasEffectiveCapability.mockReturnValue(true);
    const middleware = requireProjectCapability('initiative.milestone.manage', undefined, {
      shadow: true,
    });
    const req: any = makeReq();
    const res: any = makeRes();
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
