import { describe, expect, it } from 'vitest';

import { filterCanonicalInitiativeRegisterScope } from '../initiativeRegisterProjection';

describe('canonical initiative register scope', () => {
  const rows = [
    { id: 'p1-high', projectId: 'project-1', priority: 'HIGH' },
    { id: 'p1-low', projectId: 'project-1', priority: 'LOW' },
    { id: 'p2-high', projectId: 'project-2', priority: 'HIGH' },
    { id: 'p1-none', projectId: 'project-1', priority: undefined },
  ] as const;

  it('returns exactly the selected project and priority denominator', () => {
    expect(
      filterCanonicalInitiativeRegisterScope([...rows], {
        projectId: 'project-1',
        priorities: ['HIGH'],
      }).map((row) => row.id)
    ).toEqual(['p1-high']);
  });

  it('keeps every priority inside the selected project when priority is cleared', () => {
    expect(
      filterCanonicalInitiativeRegisterScope([...rows], {
        projectId: 'project-1',
      }).map((row) => row.id)
    ).toEqual(['p1-high', 'p1-low', 'p1-none']);
  });
});
