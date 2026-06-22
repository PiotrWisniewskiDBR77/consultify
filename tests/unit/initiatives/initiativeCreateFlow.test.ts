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

  it('does NOT switch scope for a new DRAFT — DRAFT is an active status (P1 fix 973138a3a3)', () => {
    // After the P1 fix, DRAFT (+PENDING_REVIEW) is in ACTIVE_STATUSES, so a
    // freshly-created draft is already visible on the default active Kanban —
    // no scope/filter change is needed.
    const current = { scope: 'active' as const, activeStatusFilter: null };
    const result = getCreatedInitiativeRevealState(current, 'DRAFT');
    expect(result).toEqual(current);
  });

  it('reveals a created initiative whose status is hidden by the active scope', () => {
    // A status NOT in ACTIVE_STATUSES (e.g. DONE) is hidden on the active board,
    // so the helper widens scope to "all" and pins the status filter.
    const result = getCreatedInitiativeRevealState(
      { scope: 'active', activeStatusFilter: null },
      'DONE'
    );
    expect(result).toEqual({ scope: 'all', activeStatusFilter: 'DONE' });
  });

  it('reveals a created draft when an active status filter would hide it', () => {
    // The board is filtered to a different status → reveal the new draft.
    const result = getCreatedInitiativeRevealState(
      { scope: 'active', activeStatusFilter: 'REVIEW' },
      'DRAFT'
    );
    expect(result).toEqual({ scope: 'all', activeStatusFilter: 'DRAFT' });
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
