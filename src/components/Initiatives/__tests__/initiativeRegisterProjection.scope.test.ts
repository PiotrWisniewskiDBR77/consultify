import { describe, expect, it } from 'vitest';

import {
  filterCanonicalInitiativeRegisterScope,
  selectInitiativeRegisterSource,
} from '../initiativeRegisterProjection';

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

  it('uses sample rows as an exclusive source only in explicit sample mode', () => {
    const canonical = [{ id: 'canonical' }];
    const sample = [{ id: 'sample' }];

    expect(selectInitiativeRegisterSource(canonical, sample, false)).toEqual(canonical);
    expect(selectInitiativeRegisterSource(canonical, sample, true)).toEqual(sample);
  });
});
