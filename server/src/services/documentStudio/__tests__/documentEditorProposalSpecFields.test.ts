/**
 * Document Studio — DocumentEditorProposal spec §8.4 fields tests
 * (Slice E15.4.edit).
 *
 * Verifies the four backwards-compatible optional fields added in
 * slice E15.4.edit to close the §15.4 gap from
 * CONSULTIFY_DOCUMENT_STUDIO_V1_GAP_VS_TARGET_2026-05-08.md (spec
 * §8.4 DocumentEdit contract):
 *   - `editType?: DocumentEditType`
 *   - `proposedChanges?: DocumentEditTargetedChange[]`
 *   - `versionBeforeId?: string`
 *   - `versionAfterId?: string`
 *
 * Also covers the three new public helpers exported from
 * `documentStudioTypes.ts`:
 *   - `documentEditorProposalHasStructuredChanges(proposal)`;
 *   - `documentEditorProposalHasVersionLink(proposal)`;
 *   - `summarizeDocumentEditorProposalAuditFields(proposal)`.
 *
 * Backwards-compat contract: every legacy proposal (without these
 * fields) MUST keep working unchanged. Service code (proposal
 * creation paths in editor / refiner / transformative service
 * slices) is NOT touched in this slice — substrate-only.
 */

import { describe, expect, it } from 'vitest';

import type { DocumentEditorProposal, DocumentEditTargetedChange } from '../documentStudioTypes.js';
import {
  documentEditorProposalHasStructuredChanges,
  documentEditorProposalHasVersionLink,
  summarizeDocumentEditorProposalAuditFields,
} from '../documentStudioTypes.js';

function makeProposal(overrides: Partial<DocumentEditorProposal> = {}): DocumentEditorProposal {
  return {
    proposalId: 'prop-1',
    artifactId: 'artifact-1',
    organizationId: 'org-1',
    scope: 'local',
    instruction: 'Tighten the executive summary.',
    affectedSectionIds: ['sec-1'],
    status: 'proposed',
    diff: { before: 'old text', after: 'new text' },
    createdBy: 'user-1',
    createdAt: '2026-05-08T00:00:00.000Z',
    ...overrides,
  };
}

describe('DocumentEditorProposal — backwards-compatible legacy shape (Slice E15.4.edit)', () => {
  it('legacy proposal leaves all 4 new fields undefined', () => {
    const p = makeProposal();
    expect(p.editType).toBeUndefined();
    expect(p.proposedChanges).toBeUndefined();
    expect(p.versionBeforeId).toBeUndefined();
    expect(p.versionAfterId).toBeUndefined();
  });

  it('spreading a legacy proposal preserves the legacy shape', () => {
    const original = makeProposal();
    const next: DocumentEditorProposal = { ...original, status: 'approved' };
    expect(next.status).toBe('approved');
    expect(next.editType).toBeUndefined();
    expect(next.proposedChanges).toBeUndefined();
    expect(next.versionBeforeId).toBeUndefined();
    expect(next.versionAfterId).toBeUndefined();
  });
});

describe('DocumentEditorProposal — new spec §8.4 fields (Slice E15.4.edit)', () => {
  it('accepts all 7 editType enum values', () => {
    const kinds: DocumentEditorProposal['editType'][] = [
      'rewrite',
      'replace',
      'restructure',
      'annotate',
      'expand',
      'condense',
      'reformat',
    ];
    for (const editType of kinds) {
      const p = makeProposal({ editType });
      expect(p.editType).toBe(editType);
    }
  });

  it('accepts proposedChanges as a structured per-target diff array', () => {
    const change: DocumentEditTargetedChange = {
      targetSectionId: 'sec-1',
      targetBlockId: 'blk-1',
      before: 'old',
      after: 'new',
    };
    const p = makeProposal({ proposedChanges: [change] });
    expect(p.proposedChanges).toHaveLength(1);
    expect(p.proposedChanges?.[0].targetSectionId).toBe('sec-1');
    expect(p.proposedChanges?.[0].targetBlockId).toBe('blk-1');
  });

  it('proposedChanges entries support per-change editType override', () => {
    const p = makeProposal({
      editType: 'rewrite',
      proposedChanges: [
        { targetSectionId: 's1', before: 'a', after: 'A', editType: 'rewrite' },
        { targetSectionId: 's2', before: 'b', after: 'B', editType: 'annotate' },
      ],
    });
    expect(p.proposedChanges?.[0].editType).toBe('rewrite');
    expect(p.proposedChanges?.[1].editType).toBe('annotate');
  });

  it('accepts versionBeforeId / versionAfterId snapshot links', () => {
    const p = makeProposal({
      versionBeforeId: 'snap-before-123',
      versionAfterId: 'snap-after-456',
    });
    expect(p.versionBeforeId).toBe('snap-before-123');
    expect(p.versionAfterId).toBe('snap-after-456');
  });

  it('all four substrate fields can coexist on a single proposal', () => {
    const p = makeProposal({
      editType: 'restructure',
      proposedChanges: [{ targetSectionId: 's1', before: 'a', after: 'A' }],
      versionBeforeId: 'snap-1',
      versionAfterId: 'snap-2',
    });
    expect(p.editType).toBe('restructure');
    expect(p.proposedChanges).toHaveLength(1);
    expect(p.versionBeforeId).toBe('snap-1');
    expect(p.versionAfterId).toBe('snap-2');
  });
});

describe('documentEditorProposalHasStructuredChanges (Slice E15.4.edit)', () => {
  it('returns false for null / undefined proposal', () => {
    expect(documentEditorProposalHasStructuredChanges(null)).toBe(false);
    expect(documentEditorProposalHasStructuredChanges(undefined)).toBe(false);
  });

  it('returns false for legacy proposal (no proposedChanges field)', () => {
    expect(documentEditorProposalHasStructuredChanges(makeProposal())).toBe(false);
  });

  it('returns false for empty proposedChanges array', () => {
    expect(documentEditorProposalHasStructuredChanges(makeProposal({ proposedChanges: [] }))).toBe(
      false
    );
  });

  it('returns true for proposedChanges with at least one entry', () => {
    const p = makeProposal({
      proposedChanges: [{ targetSectionId: 's1', before: 'a', after: 'A' }],
    });
    expect(documentEditorProposalHasStructuredChanges(p)).toBe(true);
  });

  it('returns false when proposedChanges is non-array (defensive)', () => {
    const p = makeProposal();
    (p as { proposedChanges?: unknown }).proposedChanges = 'not-an-array';
    expect(documentEditorProposalHasStructuredChanges(p)).toBe(false);
  });
});

describe('documentEditorProposalHasVersionLink (Slice E15.4.edit)', () => {
  it('returns false for null / undefined / legacy proposal', () => {
    expect(documentEditorProposalHasVersionLink(null)).toBe(false);
    expect(documentEditorProposalHasVersionLink(undefined)).toBe(false);
    expect(documentEditorProposalHasVersionLink(makeProposal())).toBe(false);
  });

  it('returns false when only versionBeforeId is set', () => {
    expect(documentEditorProposalHasVersionLink(makeProposal({ versionBeforeId: 'snap-1' }))).toBe(
      false
    );
  });

  it('returns false when only versionAfterId is set', () => {
    expect(documentEditorProposalHasVersionLink(makeProposal({ versionAfterId: 'snap-2' }))).toBe(
      false
    );
  });

  it('returns true when both ends are non-empty', () => {
    const p = makeProposal({
      versionBeforeId: 'snap-1',
      versionAfterId: 'snap-2',
    });
    expect(documentEditorProposalHasVersionLink(p)).toBe(true);
  });

  it('returns false when either end is whitespace-only', () => {
    expect(
      documentEditorProposalHasVersionLink(
        makeProposal({ versionBeforeId: '  ', versionAfterId: 'snap-2' })
      )
    ).toBe(false);
    expect(
      documentEditorProposalHasVersionLink(
        makeProposal({ versionBeforeId: 'snap-1', versionAfterId: '\t\n' })
      )
    ).toBe(false);
  });
});

describe('summarizeDocumentEditorProposalAuditFields (Slice E15.4.edit)', () => {
  it('returns the empty summary for null / undefined proposal', () => {
    const empty = {
      editType: null,
      changesCount: 0,
      versionBeforeId: null,
      versionAfterId: null,
    };
    expect(summarizeDocumentEditorProposalAuditFields(null)).toEqual(empty);
    expect(summarizeDocumentEditorProposalAuditFields(undefined)).toEqual(empty);
  });

  it('returns the empty summary for legacy proposal', () => {
    expect(summarizeDocumentEditorProposalAuditFields(makeProposal())).toEqual({
      editType: null,
      changesCount: 0,
      versionBeforeId: null,
      versionAfterId: null,
    });
  });

  it('returns trimmed values for fully-populated proposal', () => {
    const p = makeProposal({
      editType: 'restructure',
      proposedChanges: [
        { targetSectionId: 's1', before: 'a', after: 'A' },
        { targetSectionId: 's2', before: 'b', after: 'B' },
        { targetSectionId: 's3', before: 'c', after: 'C' },
      ],
      versionBeforeId: '  snap-before  ',
      versionAfterId: '  snap-after  ',
    });
    expect(summarizeDocumentEditorProposalAuditFields(p)).toEqual({
      editType: 'restructure',
      changesCount: 3,
      versionBeforeId: 'snap-before',
      versionAfterId: 'snap-after',
    });
  });

  it('whitespace-only version IDs collapse to null', () => {
    const p = makeProposal({
      editType: 'rewrite',
      versionBeforeId: '   ',
      versionAfterId: '\n\t',
    });
    expect(summarizeDocumentEditorProposalAuditFields(p)).toEqual({
      editType: 'rewrite',
      changesCount: 0,
      versionBeforeId: null,
      versionAfterId: null,
    });
  });

  it('changesCount is 0 when proposedChanges is non-array (defensive)', () => {
    const p = makeProposal();
    (p as { proposedChanges?: unknown }).proposedChanges = 'not-an-array';
    expect(summarizeDocumentEditorProposalAuditFields(p).changesCount).toBe(0);
  });

  it('does not mutate the input proposal', () => {
    const p = makeProposal({
      editType: 'expand',
      proposedChanges: [{ targetSectionId: 's1', before: 'a', after: 'A' }],
      versionBeforeId: 'snap-1',
      versionAfterId: 'snap-2',
    });
    const before = JSON.stringify(p);
    summarizeDocumentEditorProposalAuditFields(p);
    expect(JSON.stringify(p)).toBe(before);
  });
});
