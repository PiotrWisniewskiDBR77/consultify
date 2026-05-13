import { describe, expect, it, vi } from 'vitest';

import {
  FEATURE_REQUIREMENTS,
  getAccessibleFeatures,
  isFeatureAccessible,
  requireAccess,
  requireFeature,
} from '../../../../server/src/middleware/featureGate.middleware.ts';
import logger from '../../../../server/src/utils/Logger.js';

function makeRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.headersSent = false;
  return res;
}

describe('featureGate.middleware', () => {
  it('denies when userRole accessor throws and feature requires role', () => {
    const mw = requireFeature('benchmark_access');
    const req: any = { currentPhase: 'G', userState: 'ECOSYSTEM_NODE' };
    Object.defineProperty(req, 'userRole', {
      configurable: true,
      get: () => {
        throw new Error('userRole getter failed');
      },
    });
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });
    const res = makeRes();
    const next = vi.fn();

    mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('denies when role is missing for role-gated feature', () => {
    const mw = requireFeature('benchmark_access');
    const req: any = { currentPhase: 'G', userState: 'ECOSYSTEM_NODE' };
    const res = makeRes();
    const next = vi.fn();

    mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'FEATURE_ACCESS_DENIED',
        current: expect.objectContaining({
          phase: 'G',
          state: 'ECOSYSTEM_NODE',
          role: null,
        }),
        violations: expect.arrayContaining([
          expect.objectContaining({ type: 'ROLE', current: null }),
        ]),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('requireAccess handles throwing user getter safely', () => {
    const mw = requireAccess({ phase: ['G'], state: ['ECOSYSTEM_NODE'], role: ['ADMIN'] });
    const req: any = { currentPhase: 'G', userState: 'ECOSYSTEM_NODE' };
    Object.defineProperty(req, 'user', {
      configurable: true,
      get: () => {
        throw new Error('user getter failed');
      },
    });
    const res = makeRes();
    const next = vi.fn();

    mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'ROLE_REQUIRED',
        current: null,
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('requireAccess returns controlled 500 for invalid requirements config', () => {
    const mw = requireAccess(null as any);
    const req: any = { currentPhase: 'G', userState: 'ECOSYSTEM_NODE', userRole: 'ADMIN' };
    const res = makeRes();
    const next = vi.fn();

    mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'INVALID_FEATURE_REQUIREMENTS',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('requireAccess returns 500 when requirements fields are not arrays', () => {
    const mw = requireAccess({ phase: 'G' as any, state: ['ECOSYSTEM_NODE'], role: [] } as any);
    const req: any = { currentPhase: 'G', userState: 'ECOSYSTEM_NODE', userRole: 'ADMIN' };
    const res = makeRes();
    const next = vi.fn();

    mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'INVALID_FEATURE_REQUIREMENTS',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('requireAccess returns controlled 500 when all effective rules are empty', () => {
    const mw = requireAccess({ phase: [], state: [], role: ['   '] as any });
    const req: any = { currentPhase: 'G', userState: 'ECOSYSTEM_NODE', userRole: 'ADMIN' };
    const res = makeRes();
    const next = vi.fn();

    mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'INVALID_FEATURE_REQUIREMENTS',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('requireAccess normalizes role requirements before comparison', () => {
    const mw = requireAccess({ phase: ['G'], state: ['ECOSYSTEM_NODE'], role: [' admin '] });
    const req: any = { currentPhase: 'G', userState: 'ECOSYSTEM_NODE', userRole: 'ADMIN' };
    const res = makeRes();
    const next = vi.fn();

    mw(req, res as any, next as any);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requireAccess normalizes phase/state requirements before comparison', () => {
    const mw = requireAccess({ phase: [' G '], state: [' ECOSYSTEM_NODE '], role: ['ADMIN'] });
    const req: any = { currentPhase: 'G', userState: 'ECOSYSTEM_NODE', userRole: 'ADMIN' };
    const res = makeRes();
    const next = vi.fn();

    mw(req, res as any, next as any);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('requireAccess returns 500 when phase/state requirements are only whitespace after normalization', () => {
    const mw = requireAccess({ phase: ['  ', '\t'] as any, state: ['  '] as any, role: [] });
    const req: any = { currentPhase: 'G', userState: 'ECOSYSTEM_NODE', userRole: 'ADMIN' };
    const res = makeRes();
    const next = vi.fn();

    mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'INVALID_FEATURE_REQUIREMENTS',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('requireAccess returns 500 when requirements exceed supported rule count', () => {
    const tooManyPhaseRules = Array.from({ length: 65 }, (_, idx) => `G-${idx}`);
    const mw = requireAccess({ phase: tooManyPhaseRules as any, state: ['ECOSYSTEM_NODE'], role: ['ADMIN'] });
    const req: any = { currentPhase: 'G-0', userState: 'ECOSYSTEM_NODE', userRole: 'ADMIN' };
    const res = makeRes();
    const next = vi.fn();

    mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'INVALID_FEATURE_REQUIREMENTS',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('requireAccess returns 500 when normalized rule token is oversized', () => {
    const mw = requireAccess({
      phase: ['G'],
      state: ['ECOSYSTEM_NODE'],
      role: ['A'.repeat(65)],
    });
    const req: any = { currentPhase: 'G', userState: 'ECOSYSTEM_NODE', userRole: 'ADMIN' };
    const res = makeRes();
    const next = vi.fn();

    mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'INVALID_FEATURE_REQUIREMENTS',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('isFeatureAccessible returns false on missing context values', () => {
    expect(isFeatureAccessible('benchmark_access', { phase: '', state: '', role: '' })).toBe(false);
  });

  it('getAccessibleFeatures returns list for matching context', () => {
    const list = getAccessibleFeatures({ phase: 'G', state: 'ECOSYSTEM_NODE', role: 'ADMIN' });
    expect(list.length).toBeGreaterThan(0);
    expect(list).toContain('benchmark_access');
  });

  it('returns controlled 500 when feature id resolves to object prototype key', () => {
    const mw = requireFeature('toString');
    const req: any = { currentPhase: 'G', userState: 'ECOSYSTEM_NODE', userRole: 'ADMIN' };
    const res = makeRes();
    const next = vi.fn();

    expect(() => mw(req, res as any, next as any)).not.toThrow();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'FEATURE_NOT_REGISTERED',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('truncates oversized unregistered feature id in response and logs', () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const oversizedFeatureId = `feature_${'x'.repeat(180)}`;
    const mw = requireFeature(oversizedFeatureId);
    const req: any = { currentPhase: 'G', userState: 'ECOSYSTEM_NODE', userRole: 'ADMIN' };
    const res = makeRes();
    const next = vi.fn();

    mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(500);
    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.error).toBe('FEATURE_NOT_REGISTERED');
    expect(payload.message).toContain('not properly configured');
    expect(payload.message.length).toBeLessThan(220);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("not registered in FEATURE_REQUIREMENTS")
    );
    expect(next).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('rejects oversized registered-like feature id before lookup', () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const oversizedFeatureId = `demo_view${'x'.repeat(300)}`;
    const mw = requireFeature(oversizedFeatureId);
    const req: any = { currentPhase: 'B', userState: 'DEMO_SESSION', userRole: 'ADMIN' };
    const res = makeRes();
    const next = vi.fn();

    mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'FEATURE_NOT_REGISTERED',
      })
    );
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('feature id exceeds max length'));
    expect(next).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('requireFeature does not throw when headers are already sent on deny path', () => {
    const mw = requireFeature('benchmark_access');
    const req: any = { currentPhase: 'G', userState: 'ECOSYSTEM_NODE' };
    const res = makeRes();
    res.headersSent = true;
    const next = vi.fn();

    expect(() => mw(req, res as any, next as any)).not.toThrow();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireFeature does not write deny response when stream already ended', () => {
    const mw = requireFeature('benchmark_access');
    const req: any = { currentPhase: 'G', userState: 'ECOSYSTEM_NODE' };
    const res = makeRes();
    res.writableEnded = true;
    const next = vi.fn();

    expect(() => mw(req, res as any, next as any)).not.toThrow();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireFeature does not write deny response when stream destroyed', () => {
    const mw = requireFeature('benchmark_access');
    const req: any = { currentPhase: 'G', userState: 'ECOSYSTEM_NODE' };
    const res = makeRes();
    res.destroyed = true;
    const next = vi.fn();

    expect(() => mw(req, res as any, next as any)).not.toThrow();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireFeature does not write deny response when response is finished', () => {
    const mw = requireFeature('benchmark_access');
    const req: any = { currentPhase: 'G', userState: 'ECOSYSTEM_NODE' };
    const res = makeRes();
    res.finished = true;
    const next = vi.fn();

    expect(() => mw(req, res as any, next as any)).not.toThrow();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('requireFeature rejects feature ids containing control characters with 500', () => {
    const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    const mw = requireFeature('demo_view\u0000');
    const req: any = { currentPhase: 'B', userState: 'DEMO_SESSION', userRole: 'ADMIN' };
    const res = makeRes();
    const next = vi.fn();

    mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'INVALID_FEATURE_ID',
      })
    );
    expect(next).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('disallowed characters'));
    errorSpy.mockRestore();
  });

  it('requireFeature does not throw when next is not a function on allow path', () => {
    const mw = requireFeature('demo_view');
    const req: any = { currentPhase: 'B', userState: 'DEMO_SESSION' };
    const res = makeRes();

    expect(() => mw(req, res as any, 'not-a-function' as any)).not.toThrow();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('requireAccess ignores inherited requirements and returns 500 when no own rule arrays exist', () => {
    const inherited = { phase: ['G'], state: ['ECOSYSTEM_NODE'], role: ['ADMIN'] };
    const requirements = Object.create(inherited);
    const mw = requireAccess(requirements as any);
    const req: any = { currentPhase: 'G', userState: 'ECOSYSTEM_NODE', userRole: 'ADMIN' };
    const res = makeRes();
    const next = vi.fn();

    mw(req, res as any, next as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'INVALID_FEATURE_REQUIREMENTS',
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('isFeatureAccessible denies role-gated feature when role is missing', () => {
    expect(isFeatureAccessible('benchmark_access', { phase: 'G', state: 'ECOSYSTEM_NODE' })).toBe(false);
  });

  it('isFeatureAccessible returns false for object prototype feature keys', () => {
    expect(isFeatureAccessible('toString', { phase: 'G', state: 'ECOSYSTEM_NODE', role: 'ADMIN' })).toBe(false);
  });

  it('isFeatureAccessible returns false for oversized feature identifiers', () => {
    expect(
      isFeatureAccessible(`benchmark_access${'x'.repeat(300)}`, {
        phase: 'G',
        state: 'ECOSYSTEM_NODE',
        role: 'ADMIN',
      })
    ).toBe(false);
  });

  it('isFeatureAccessible returns false when feature id contains control characters', () => {
    expect(
      isFeatureAccessible('bench\u0000mark_access', {
        phase: 'G',
        state: 'ECOSYSTEM_NODE',
        role: 'ADMIN',
      })
    ).toBe(false);
  });

  it('FEATURE_REQUIREMENTS is deeply frozen to prevent runtime mutation', () => {
    expect(Object.isFrozen(FEATURE_REQUIREMENTS)).toBe(true);
    expect(Object.isFrozen(FEATURE_REQUIREMENTS.demo_view)).toBe(true);
    expect(Object.isFrozen(FEATURE_REQUIREMENTS.demo_view.phase)).toBe(true);
    expect(Object.isFrozen(FEATURE_REQUIREMENTS.demo_view.state)).toBe(true);
    expect(Object.isFrozen(FEATURE_REQUIREMENTS.demo_view.role)).toBe(true);

    expect(() => {
      (FEATURE_REQUIREMENTS as any).drd_create.phase.push('X');
    }).toThrow();
  });
});
