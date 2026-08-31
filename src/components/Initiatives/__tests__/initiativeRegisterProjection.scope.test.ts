import { describe, expect, it } from 'vitest';

import type { PortfolioInitiative } from '@/types';

import {
  filterCanonicalInitiativeRegisterScope,
  selectInitiativeRegisterSource,
} from '../initiativeRegisterProjection';

describe('canonical initiative register scope', () => {
  type FixtureRow = { id: string } & Pick<PortfolioInitiative, 'projectId' | 'priority'>;

  const rows: FixtureRow[] = [
    { id: 'p1-high', projectId: 'project-1', priority: 'HIGH' },
    { id: 'p1-low', projectId: 'project-1', priority: 'LOW' },
    { id: 'p2-high', projectId: 'project-2', priority: 'HIGH' },
    // Contract declares `priority` required, but real-world rows can still
    // arrive without one (unvalidated DB read) — the assertion below
    // simulates that malformed-but-real case on purpose, it is not a
    // loophole in the production signature above.
    {
      id: 'p1-none',
      projectId: 'project-1',
      priority: undefined as unknown as FixtureRow['priority'],
    },
  ];

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
