import { describe, expect, it } from 'vitest';

import {
  A06_RATIFIED_TOOLS,
  A06_TENANT_SEED_VERSION,
  managedA06PolicyIds,
} from '../agentTenantSettingsService.js';

describe('Agent tenant admin settings contract', () => {
  it('pins the exact versioned set of 17 ratified tools without duplicates', () => {
    expect(A06_TENANT_SEED_VERSION).toBe('a06-t01-v1');
    expect(A06_RATIFIED_TOOLS).toHaveLength(17);
    expect(new Set(A06_RATIFIED_TOOLS.map(([name]) => name)).size).toBe(17);
    expect(
      A06_RATIFIED_TOOLS.every(([, risk]) => ['medium_risk', 'high_risk'].includes(risk))
    ).toBe(true);
  });

  it('reads back only the 17 policies owned by tenant activation', () => {
    const ids = managedA06PolicyIds('org-1', null);
    expect(ids).toHaveLength(17);
    expect(new Set(ids).size).toBe(17);
    expect(ids.every((id) => id.startsWith('a06-t01-policy:org-1:all:'))).toBe(true);
    expect(ids.some((id) => id.includes('initiative-lifecycle'))).toBe(false);
  });
});
