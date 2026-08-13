/**
 * Covers canon test 7 and the INITIATIVE_PROPOSAL_GENERATOR_CONTRACT.md §10
 * antywzorzec ("jedna inicjatywa na każdy insight/finding"):
 *  7. Initiative Draft has a link to findings and (through them) the source
 *     snapshot/output; nothing in this package can create a Registered
 *     Initiative.
 *  grouping: the generator groups findings into a small set of drafts, not
 *     one draft per finding.
 */
import { describe, expect, it } from 'vitest';
import {
  createInitiativeProposalDraft,
  groupFindingsForInitiativeDrafts,
  InitiativeDraftValidationError,
} from '../initiativeDraft';
import { makeFinding, makeOutput } from './testFixtures';
import * as outputsPackage from '../index';

describe('Initiative Proposal Draft — lineage to findings and snapshot (test 7)', () => {
  it('links to the findings it was built from, sorted deterministically', () => {
    const f1 = makeFinding({ id: 'finding-b', unitId: 'axis-2.criterion-1' });
    const f2 = makeFinding({ id: 'finding-a', unitId: 'axis-2.criterion-2' });
    const output = makeOutput({ findings: [f1, f2] });

    const draft = createInitiativeProposalDraft({
      id: 'draft-1',
      organizationId: 'org-1',
      outputId: output.id,
      outputVersion: output.version,
      title: 'Data ownership gaps stall cross-team decisions',
      summary: 'Two related findings point at the same accountability gap.',
      findings: [f1, f2],
      rationale: 'Both findings share the same root cause: no assigned data owner.',
      expectedOutcome: 'Decisions that reference shared data resolve without escalation.',
      kpiProposal: null,
      dependencies: [],
      risks: [],
      confidence: 'medium',
      createdAt: '2026-08-13T12:00:00.000Z',
    });

    expect(draft.findingIds).toEqual(['finding-a', 'finding-b']);
    expect(draft.outputId).toBe(output.id);
    expect(draft.outputVersion).toBe(output.version);
    // Through outputId + outputVersion the draft traces back to snapshotId —
    // the Output itself is the join point, not a copy of the snapshot id.
  });

  it('requires at least one linked finding — a draft cannot be built from zero', () => {
    expect(() =>
      createInitiativeProposalDraft({
        id: 'draft-empty',
        organizationId: 'org-1',
        outputId: 'output-1',
        outputVersion: 1,
        title: 'Empty draft',
        summary: '',
        findings: [],
        rationale: 'n/a',
        expectedOutcome: 'n/a',
        kpiProposal: null,
        dependencies: [],
        risks: [],
        confidence: 'low',
        createdAt: '2026-08-13T12:00:00.000Z',
      })
    ).toThrow(InitiativeDraftValidationError);
  });

  it('rejects a title that is a verbatim copy of a finding recommendation (antywzorzec)', () => {
    const finding = makeFinding({ recommendation: 'Assign a data owner per domain.' });
    expect(() =>
      createInitiativeProposalDraft({
        id: 'draft-bad-title',
        organizationId: 'org-1',
        outputId: 'output-1',
        outputVersion: 1,
        title: 'Assign a data owner per domain.',
        summary: 'x',
        findings: [finding],
        rationale: 'x',
        expectedOutcome: 'x',
        kpiProposal: null,
        dependencies: [],
        risks: [],
        confidence: 'low',
        createdAt: '2026-08-13T12:00:00.000Z',
      })
    ).toThrow(InitiativeDraftValidationError);
  });

  it('this package exports NO way to create a Registered Initiative', () => {
    const exportedNames = Object.keys(outputsPackage);
    const forbidden = exportedNames.filter((n) => /register|initiativeId\b/i.test(n));
    expect(forbidden).toEqual([]);
    // The draft type itself has no registeredInitiativeId/initiativeId field —
    // verified by construction: only the fields this factory sets exist.
    const finding = makeFinding();
    const draft = createInitiativeProposalDraft({
      id: 'draft-check',
      organizationId: 'org-1',
      outputId: 'output-1',
      outputVersion: 1,
      title: 'Ownership gaps slow cross-team decisions',
      summary: 'x',
      findings: [finding],
      rationale: 'x',
      expectedOutcome: 'Faster decisions',
      kpiProposal: null,
      dependencies: [],
      risks: [],
      confidence: 'low',
      createdAt: '2026-08-13T12:00:00.000Z',
    });
    expect('initiativeId' in draft).toBe(false);
    expect('registeredInitiativeId' in draft).toBe(false);
  });
});

describe('Initiative Draft grouping — not one-per-gap (antywzorzec §10)', () => {
  it('groups multiple findings from the same axis into ONE draft candidate, not N', () => {
    const findings = [
      makeFinding({ id: 'f-1', unitId: 'axis-3.criterion-1', gap: 2 }),
      makeFinding({ id: 'f-2', unitId: 'axis-3.criterion-2', gap: 1 }),
      makeFinding({ id: 'f-3', unitId: 'axis-3.criterion-3', gap: 3 }),
    ];

    const groups = groupFindingsForInitiativeDrafts(findings);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });

  it('produces separate groups for findings from genuinely different axes', () => {
    const findings = [
      makeFinding({ id: 'f-1', unitId: 'axis-1.criterion-1', gap: 2 }),
      makeFinding({ id: 'f-2', unitId: 'axis-5.criterion-1', gap: 1 }),
    ];

    const groups = groupFindingsForInitiativeDrafts(findings);

    expect(groups).toHaveLength(2);
  });

  it('excludes findings with no gap (nothing to act on) from the default grouping', () => {
    const findings = [
      makeFinding({ id: 'f-1', unitId: 'axis-1.criterion-1', gap: 0 }),
      makeFinding({ id: 'f-2', unitId: 'axis-1.criterion-2', gap: 2 }),
    ];

    const groups = groupFindingsForInitiativeDrafts(findings);

    expect(groups).toHaveLength(1);
    expect(groups[0].map((f) => f.id)).toEqual(['f-2']);
  });

  it('grouping output does not depend on input array order', () => {
    const f1 = makeFinding({ id: 'f-1', unitId: 'axis-1.criterion-1', gap: 1 });
    const f2 = makeFinding({ id: 'f-2', unitId: 'axis-2.criterion-1', gap: 1 });
    const f3 = makeFinding({ id: 'f-3', unitId: 'axis-1.criterion-2', gap: 1 });

    const groupsA = groupFindingsForInitiativeDrafts([f1, f2, f3]);
    const groupsB = groupFindingsForInitiativeDrafts([f3, f1, f2]);

    expect(groupsA.map((g) => g.map((f) => f.id))).toEqual(groupsB.map((g) => g.map((f) => f.id)));
  });
});
