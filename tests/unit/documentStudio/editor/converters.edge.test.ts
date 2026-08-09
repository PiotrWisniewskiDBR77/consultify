/**
 * R1 — converter edge cases & robustness (non-render, pure).
 *
 * Covers empty schema, missing ids (synthesized, not crashing), malformed
 * payload tolerance, heading-level clamping, and the docSection marker shape.
 */

import { describe, expect, it } from 'vitest';

import {
  schemaToProseMirror,
  blockToPMNodes,
} from '../../../../src/components/DocumentStudio/editor/schemaToTipTap';
import {
  proseMirrorToSchema,
  pmNodeToBlock,
} from '../../../../src/components/DocumentStudio/editor/tipTapToSchema';
import type { DocumentSchema } from '../../../../src/components/DocumentStudio/types';

function emptySchema(): DocumentSchema {
  return {
    documentId: 'd',
    artifactId: 'a',
    title: 'Empty',
    documentType: 'generic_document',
    language: 'pl',
    audience: [],
    goal: 'inform',
    communicationRegister: 'professional',
    density: 'standard',
    languageStyle: 'formal',
    confidentiality: 'internal',
    sections: [],
    sourceRefs: [],
  };
}

describe('R1 — converter edge cases', () => {
  it('emits a non-empty PM doc for an empty schema (ProseMirror requires content)', () => {
    const pm = schemaToProseMirror(emptySchema());
    expect(pm.type).toBe('doc');
    expect(pm.content.length).toBeGreaterThan(0);
  });

  it('round-trips an empty schema to zero sections', () => {
    const schema = emptySchema();
    const back = proseMirrorToSchema(schemaToProseMirror(schema), schema);
    expect(back.sections).toEqual([]);
  });

  it('clamps heading levels into the 1..3 range', () => {
    const nodes = blockToPMNodes(
      { blockId: 'h', type: 'heading', content: { level: 7, text: 'X' } },
      'sec'
    );
    expect(nodes[0].attrs?.level).toBe(3);
    const low = blockToPMNodes(
      { blockId: 'h2', type: 'heading', content: { level: 0, text: 'Y' } },
      'sec'
    );
    expect(low[0].attrs?.level).toBe(1);
  });

  it('synthesizes a blockId when an inbound PM node lacks one (never crashes)', () => {
    const block = pmNodeToBlock({
      type: 'paragraph',
      content: [{ type: 'text', text: 'orphan' }],
    });
    expect(block).not.toBeNull();
    expect(typeof block?.blockId).toBe('string');
    expect(block?.blockId.length).toBeGreaterThan(0);
  });

  it('tolerates a malformed payloadJson on an atom node (content → null, no throw)', () => {
    const block = pmNodeToBlock({
      type: 'docChart',
      attrs: { blockId: 'c', blockType: 'chart', payloadJson: '{not json' },
    });
    expect(block?.type).toBe('chart');
    expect(block?.content).toBeNull();
  });

  it('returns null for a docSection marker (structural-only, not a block)', () => {
    expect(pmNodeToBlock({ type: 'docSection', attrs: { sectionId: 's' } })).toBeNull();
  });

  it('round-trips advanced inline typography and paragraph alignment', () => {
    const block = pmNodeToBlock({
      type: 'paragraph',
      attrs: { blockId: 'styled', textAlign: 'center' },
      content: [
        {
          type: 'text',
          text: 'Styled',
          marks: [
            { type: 'underline' },
            { type: 'strike' },
            { type: 'textStyle', attrs: { color: '#123456', fontSize: '18px' } },
            { type: 'highlight', attrs: { color: '#fde68a' } },
          ],
        },
      ],
    });
    expect(block?.content).toMatchObject({
      textAlign: 'center',
      richText: [
        {
          marks: [
            { type: 'underline' },
            { type: 'strike' },
            { type: 'textStyle', attrs: { color: '#123456', fontSize: '18px' } },
            { type: 'highlight', attrs: { color: '#fde68a' } },
          ],
        },
      ],
    });
    expect(blockToPMNodes(block!, 'sec')[0]).toMatchObject({
      attrs: { textAlign: 'center' },
      content: [{ marks: expect.arrayContaining([{ type: 'underline' }, { type: 'strike' }]) }],
    });
  });

  it('groups blocks appearing before any section into a synthetic section (no drop)', () => {
    const schema = emptySchema();
    const back = proseMirrorToSchema(
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { blockId: 'p1' },
            content: [{ type: 'text', text: 'lead' }],
          },
        ],
      },
      schema
    );
    expect(back.sections).toHaveLength(1);
    expect(back.sections[0].blocks[0].blockId).toBe('p1');
  });

  it('writes the section identity onto the docSection marker attrs', () => {
    const schema: DocumentSchema = {
      ...emptySchema(),
      sections: [
        {
          sectionId: 'sec-x',
          orderIndex: 3,
          level: 2,
          title: 'T',
          purpose: 'P',
          blocks: [],
          sourceRefs: [],
        },
      ],
    };
    const pm = schemaToProseMirror(schema);
    const marker = pm.content.find((n) => n.type === 'docSection');
    expect(marker?.attrs?.sectionId).toBe('sec-x');
    expect(marker?.attrs?.level).toBe(2);
    expect(marker?.attrs?.purpose).toBe('P');
  });
});
