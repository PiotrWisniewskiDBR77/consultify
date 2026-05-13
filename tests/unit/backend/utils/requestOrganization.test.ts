import { describe, expect, it, vi } from 'vitest';

import {
  normalizeOptionalString,
  requireRequestOrganizationId,
  resolveRequestOrganizationId,
  safeRead,
} from '../../../../server/src/utils/requestOrganization.js';

describe('requestOrganization', () => {
  it('prefers explicit request organization context', () => {
    const organizationId = resolveRequestOrganizationId({
      organizationId: 'atelier',
      user: { organizationId: 'dbr77' },
    } as any);

    expect(organizationId).toBe('atelier');
  });

  it('falls back to authenticated user organization', () => {
    const organizationId = resolveRequestOrganizationId({
      user: { organizationId: 'vts' },
    } as any);

    expect(organizationId).toBe('vts');
  });

  it('falls back to user organization when request organization accessor throws', () => {
    const req: any = { user: { organizationId: 'fallback-org' } };
    Object.defineProperty(req, 'organizationId', {
      configurable: true,
      get: () => {
        throw new Error('organizationId getter failed');
      },
    });

    const organizationId = resolveRequestOrganizationId(req);

    expect(organizationId).toBe('fallback-org');
  });

  it('returns 401 when organization context is missing', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    const organizationId = requireRequestOrganizationId({} as any, { status } as any);

    expect(organizationId).toBeNull();
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Unauthorized - no organization' });
  });

  it('falls back to session.user organization when req.user is missing', () => {
    const organizationId = resolveRequestOrganizationId({
      session: { user: { organizationId: 'session-org' } },
      user: undefined,
    } as any);

    expect(organizationId).toBe('session-org');
  });

  it('normalizeOptionalString trims values and rejects empty/non-string inputs', () => {
    expect(normalizeOptionalString('  org-1  ')).toBe('org-1');
    expect(normalizeOptionalString('   ')).toBeNull();
    expect(normalizeOptionalString(123)).toBeNull();
  });

  it('safeRead returns fallback when reader throws', () => {
    const value = safeRead(
      () => {
        throw new Error('boom');
      },
      'fallback'
    );
    expect(value).toBe('fallback');
  });
});
