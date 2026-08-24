import { describe, expect, it } from 'vitest';

import { canonicalInitiativeMatchesRegisterFilters } from '@/components/Initiatives/initiativeRegisterProjection';

describe('canonicalInitiativeMatchesRegisterFilters', () => {
  it('keeps rows and counters inside the active project', () => {
    expect(
      canonicalInitiativeMatchesRegisterFilters(
        { projectId: 'project-a', priority: 'HIGH' as any },
        { projectId: 'project-a' }
      )
    ).toBe(true);
    expect(
      canonicalInitiativeMatchesRegisterFilters(
        { projectId: 'project-b', priority: 'HIGH' as any },
        { projectId: 'project-a' }
      )
    ).toBe(false);
  });

  it('normalizes priority and fails closed when canonical priority is absent', () => {
    expect(
      canonicalInitiativeMatchesRegisterFilters(
        { projectId: 'project-a', priority: 'high' as any },
        { priorities: ['HIGH'] }
      )
    ).toBe(true);
    expect(
      canonicalInitiativeMatchesRegisterFilters(
        { projectId: 'project-a', priority: undefined as any },
        { priorities: ['HIGH'] }
      )
    ).toBe(false);
  });
});
