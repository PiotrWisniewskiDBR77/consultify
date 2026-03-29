import { describe, expect, it } from 'vitest';

import { normalizeGateReadinessPayload } from '@/components/Initiatives/gateReadinessPayload';

describe('normalizeGateReadinessPayload', () => {
  it('preserves full gate-readiness objects with capabilities', () => {
    const payload = {
      currentStatus: 'DRAFT',
      userRoles: ['ADMIN'],
      availableTransitions: [],
      capabilities: {
        topBar: {
          canEditPriority: true,
          canEditOwner: true,
          canEditTargetDate: true,
        },
      },
      readiness: [],
      allBlocking: false,
      allWarnings: false,
    };

    expect(normalizeGateReadinessPayload(payload)).toEqual(payload);
  });

  it('wraps legacy readiness arrays without discarding them', () => {
    expect(
      normalizeGateReadinessPayload([{ key: 'owner', label: 'Owner assigned', pass: false }])
    ).toEqual({
      readiness: [{ key: 'owner', label: 'Owner assigned', pass: false }],
    });
  });
});
