import { describe, expect, it } from 'vitest';

import {
  classifyProposalRelation,
  jaccard,
  normalizeTokens,
  reconcileProposals,
  type ExistingInitiative,
} from '@/services/initiatives/proposalReconciliation';

const grid: ExistingInitiative[] = [
  {
    id: 'init-1',
    title: 'Reduce IT capacity constraints',
    goalKey: 'it_modernization',
    tags: ['it', 'capacity'],
    status: 'EXECUTING',
  },
  {
    id: 'init-2',
    title: 'Standardize cross-team handoffs',
    goalKey: 'operating_model',
    tags: ['process'],
    status: 'PLANNING',
  },
  {
    id: 'init-archived',
    title: 'Legacy ERP rollout',
    goalKey: 'it_modernization',
    status: 'ARCHIVED',
  },
];

describe('proposalReconciliation — helpers', () => {
  it('jaccard of identical token sets is 1', () => {
    expect(jaccard(normalizeTokens('Reduce IT capacity'), normalizeTokens('capacity IT reduce'))).toBe(1);
  });
  it('light stemming makes handoff == handoffs', () => {
    expect(normalizeTokens('handoffs').has('handoff')).toBe(true);
  });
});

describe('classifyProposalRelation — relations', () => {
  it('duplicate: near-identical title to an active initiative', () => {
    const r = classifyProposalRelation({ title: 'Reduce IT capacity constraint' }, grid);
    expect(r.relation).toBe('duplicate');
    expect(r.matchedInitiativeId).toBe('init-1');
  });

  it('extend: shared theme but new scope', () => {
    const r = classifyProposalRelation(
      { title: 'Standardize finance month-end handoffs' },
      grid
    );
    expect(r.relation).toBe('extend');
    expect(r.matchedInitiativeId).toBe('init-2');
  });

  it('new: nothing close in the grid', () => {
    const r = classifyProposalRelation({ title: 'Launch customer loyalty program' }, grid);
    expect(r.relation).toBe('new');
  });

  it('contributes_to_goal: same strategic goal, low title overlap, novel scope', () => {
    const r = classifyProposalRelation(
      { title: 'Adopt cloud FinOps governance', goalKey: 'it_modernization' },
      grid
    );
    expect(r.relation).toBe('contributes_to_goal');
    expect(r.matchedInitiativeId).toBe('init-1');
  });

  it('evidence_only: same goal but no new scope', () => {
    const r = classifyProposalRelation(
      { title: 'More signals on IT bottlenecks', goalKey: 'it_modernization', novelScope: false },
      grid
    );
    expect(r.relation).toBe('evidence_only');
    expect(r.matchedInitiativeId).toBe('init-1');
  });

  it('conflict / depends_on / re_prioritize: honored from explicit hints', () => {
    expect(classifyProposalRelation({ title: 'X', conflictsWithInitiativeId: 'init-2' }, grid).relation).toBe('conflict');
    expect(classifyProposalRelation({ title: 'X', dependsOnInitiativeId: 'init-1' }, grid).relation).toBe('depends_on');
    expect(classifyProposalRelation({ title: 'X', rePrioritizeInitiativeId: 'init-1' }, grid).relation).toBe('re_prioritize');
  });

  it('ignores terminal (archived) initiatives when matching', () => {
    const r = classifyProposalRelation({ title: 'Legacy ERP rollout' }, grid);
    expect(r.matchedInitiativeId).not.toBe('init-archived');
  });
});

describe('reconcileProposals — MECE coverage', () => {
  it('reports gaps for goals with no active initiative or new candidate', () => {
    const { coverage } = reconcileProposals([], grid, {
      goalKeys: ['it_modernization', 'operating_model', 'customer_growth'],
    });
    expect(coverage.gaps).toEqual(['customer_growth']);
  });

  it('a new candidate closes a coverage gap', () => {
    const { coverage } = reconcileProposals(
      [{ title: 'Launch loyalty program', goalKey: 'customer_growth' }],
      grid,
      { goalKeys: ['customer_growth'] }
    );
    expect(coverage.gaps).toEqual([]);
  });

  it('flags overlap between two near-identical new candidates (MECE violation)', () => {
    const { coverage } = reconcileProposals(
      [
        { title: 'Build data quality dashboard' },
        { title: 'Build data quality dashboards' },
      ],
      [],
      {}
    );
    expect(coverage.overlaps.length).toBeGreaterThan(0);
  });
});
