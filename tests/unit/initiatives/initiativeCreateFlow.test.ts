import { describe, expect, it } from 'vitest';

import {
  getCreatedInitiativeRevealState,
  normalizeInitiativeForPortfolio,
  upsertPortfolioInitiative,
} from '@/components/Initiatives/initiativeCreateFlow';

describe('initiativeCreateFlow', () => {
  it('normalizes governed initiative truth into a portfolio row', () => {
    const result = normalizeInitiativeForPortfolio({
      id: 'init-1',
      title: 'Wave 1 Initiative',
      axis: 'strategic',
      status: 'draft',
    });

    expect(result).toMatchObject({
      id: 'init-1',
      name: 'Wave 1 Initiative',
      axis: 'strategic',
      status: 'DRAFT',
      priority: 'MEDIUM',
      progress: 0,
      budget: 0,
    });
  });

  it('reveals a newly created draft when current scope hides it', () => {
    const result = getCreatedInitiativeRevealState(
      {
        scope: 'active',
        activeStatusFilter: null,
      },
      'DRAFT'
    );

    expect(result).toEqual({
      scope: 'all',
      activeStatusFilter: 'DRAFT',
    });
  });

  it('upserts the created initiative to the top of the local portfolio state', () => {
    const existing = normalizeInitiativeForPortfolio({
      id: 'init-1',
      name: 'Existing initiative',
      axis: 'operational',
      status: 'REVIEW',
    });
    const created = normalizeInitiativeForPortfolio({
      id: 'init-2',
      title: 'Created initiative',
      axis: 'operational',
      status: 'DRAFT',
    });

    const result = upsertPortfolioInitiative(existing ? [existing] : [], created);

    expect(result.map((item) => item.id)).toEqual(['init-2', 'init-1']);
  });
});
