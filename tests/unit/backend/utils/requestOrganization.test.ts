import { describe, expect, it, vi } from 'vitest';

import {
  requireRequestOrganizationId,
  resolveRequestOrganizationId,
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

  it('returns 401 when organization context is missing', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));

    const organizationId = requireRequestOrganizationId({} as any, { status } as any);

    expect(organizationId).toBeNull();
    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({ error: 'Unauthorized - no organization' });
  });
});
