/**
 * B3 — unit specs for the proposal→schema-diff adapter (documentDiffModel.ts).
 */

import { describe, expect, it } from 'vitest';

import {
  AGGREGATE_DIFF_SECTION_ID,
  isTextualBlockType,
  proposalToSchemaDiff,
} from '../documentDiffModel';
import type { DocumentEditorProposal, DocumentSchema } from '../types';

function makeProposal(overrides: Partial<DocumentEditorProposal> = {}): DocumentEditorProposal {
  return {
    proposalId: 'prop-1',
    artifactId: 'art-1',
    scope: 'local',
    instruction: 'Rewrite the summary',
    affectedSectionIds: ['sec-1'],
    status: 'proposed',
    diff: { before: 'Old text.', after: 'New text.' },
    createdBy: 'user-1',
    createdAt: '2026-07-04T10:00:00.000Z',
    ...overrides,
  };
}

const schema = {
  documentId: 'doc-1',
  artifactId: 'art-1',
  title: 'Test doc',
  documentType: 'generic_document',
  language: 'pl',
  audience: [],
  goal: 'inform',
  communicationRegister: 'professional',
  density: 'standard',
  languageStyle: 'consulting',
  confidentiality: 'internal',
  sections: [
    {
      sectionId: 'sec-1',
      orderIndex: 0,
      level: 1,
      title: 'Podsumowanie',
      blocks: [
        { blockId: 'blk-1', type: 'paragraph', content: { text: 'Old text.' } },
        { blockId: 'blk-2', type: 'chart', content: { kind: 'bar' } },
      ],
      sourceRefs: [],
    },
    {
      sectionId: 'sec-2',
      orderIndex: 1,
      level: 1,
      title: 'Ryzyka',
      blocks: [{ blockId: 'blk-3', type: 'paragraph', content: { text: 'Risk text.' } }],
      sourceRefs: [],
    },
  ],
} as unknown as DocumentSchema;

describe('isTextualBlockType', () => {
  it('classifies prose-like block types as textual', () => {
    for (const type of ['paragraph', 'heading', 'bullet_list', 'quote', 'citation']) {
      expect(isTextualBlockType(type)).toBe(true);
    }
  });

  it('classifies structural block types and null as non-textual', () => {
    for (const type of ['chart', 'table', 'kpi_strip', 'risk_table', 'image']) {
      expect(isTextualBlockType(type)).toBe(false);
    }
    expect(isTextualBlockType(null)).toBe(false);
    expect(isTextualBlockType(undefined)).toBe(false);
  });
});

describe('proposalToSchemaDiff — aggregate fallback (no proposedChanges)', () => {
  it('maps the aggregate diff to a single pseudo-section', () => {
    const diff = proposalToSchemaDiff(makeProposal());
    expect(diff.hasChanges).toBe(true);
    expect(diff.sectionDiffs).toHaveLength(1);
    const section = diff.sectionDiffs[0];
    expect(section.sectionId).toBe(AGGREGATE_DIFF_SECTION_ID);
    expect(section.kind).toBe('modified');
    expect(section.blockDiffs).toHaveLength(1);
    expect(section.blockDiffs[0]).toMatchObject({
      kind: 'modified',
      beforeText: 'Old text.',
      afterText: 'New text.',
    });
    expect(diff.stats.modifiedBlockCount).toBe(1);
    expect(diff.stats.modifiedSectionCount).toBe(1);
  });

  it('reports no changes when before === after', () => {
    const diff = proposalToSchemaDiff(makeProposal({ diff: { before: 'Same.', after: 'Same.' } }));
    expect(diff.hasChanges).toBe(false);
    expect(diff.stats.modifiedBlockCount).toBe(0);
    expect(diff.sectionDiffs[0].kind).toBe('unchanged');
  });

  it('classifies an empty-before aggregate as an added block', () => {
    const diff = proposalToSchemaDiff(makeProposal({ diff: { before: '', after: 'Fresh.' } }));
    expect(diff.hasChanges).toBe(true);
    expect(diff.sectionDiffs[0].blockDiffs[0].kind).toBe('added');
    expect(diff.stats.addedBlockCount).toBe(1);
  });
});

describe('proposalToSchemaDiff — structured proposedChanges', () => {
  it('groups changes per target section and resolves titles/block types from schema', () => {
    const proposal = makeProposal({
      proposedChanges: [
        {
          targetSectionId: 'sec-1',
          targetBlockId: 'blk-1',
          before: 'Old text.',
          after: 'New text.',
          editType: 'rewrite',
        },
        {
          targetSectionId: 'sec-1',
          targetBlockId: 'blk-2',
          before: 'kpi=1',
          after: 'kpi=2',
        },
        {
          targetSectionId: 'sec-2',
          targetBlockId: 'blk-3',
          before: 'Risk text.',
          after: '',
        },
      ],
    });
    const diff = proposalToSchemaDiff(proposal, schema);
    expect(diff.hasChanges).toBe(true);
    expect(diff.sectionDiffs).toHaveLength(2);

    const [first, second] = diff.sectionDiffs;
    expect(first.sectionId).toBe('sec-1');
    expect(first.afterTitle).toBe('Podsumowanie');
    expect(first.blockDiffs).toHaveLength(2);
    expect(first.blockDiffs[0].blockType).toBe('paragraph');
    expect(first.blockDiffs[1].blockType).toBe('chart');

    expect(second.sectionId).toBe('sec-2');
    expect(second.afterTitle).toBe('Ryzyka');
    // Empty `after` classifies as a removed block.
    expect(second.blockDiffs[0].kind).toBe('removed');

    expect(diff.stats.modifiedSectionCount).toBe(2);
    expect(diff.stats.modifiedBlockCount).toBe(2);
    expect(diff.stats.removedBlockCount).toBe(1);
  });

  it('handles changes without a schema (no titles / block types)', () => {
    const proposal = makeProposal({
      proposedChanges: [{ targetSectionId: 'sec-9', before: 'a', after: 'b' }],
    });
    const diff = proposalToSchemaDiff(proposal);
    expect(diff.sectionDiffs[0].afterTitle).toBeNull();
    expect(diff.sectionDiffs[0].blockDiffs[0].blockType).toBeNull();
    expect(diff.sectionDiffs[0].blockDiffs[0].blockId).toContain('sec-9');
  });

  it('marks unchanged targeted changes as unchanged and keeps hasChanges false', () => {
    const proposal = makeProposal({
      proposedChanges: [
        { targetSectionId: 'sec-1', targetBlockId: 'blk-1', before: 'x', after: 'x' },
      ],
    });
    const diff = proposalToSchemaDiff(proposal, schema);
    expect(diff.hasChanges).toBe(false);
    expect(diff.sectionDiffs[0].kind).toBe('unchanged');
    expect(diff.stats.unchangedBlockCount).toBe(1);
  });
});
