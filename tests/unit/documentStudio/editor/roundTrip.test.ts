/**
 * R1 / FT-1 — Document Studio schema ↔ ProseMirror round-trip (THE core test).
 *
 * Asserts `proseMirrorToSchema(schemaToProseMirror(x), x) ≈ x` for a fixture
 * exercising ALL 13 canonical block types, with ZERO loss of:
 *   blockId · sectionId (re-grouping) · sourceRef · isAssumption.
 *
 * Plus legacy `list` tolerance and structural fidelity.
 */

import { describe, expect, it } from 'vitest';

import { schemaToProseMirror } from '../../../../src/components/DocumentStudio/editor/schemaToTipTap';
import { proseMirrorToSchema } from '../../../../src/components/DocumentStudio/editor/tipTapToSchema';
import type {
  DocumentBlock,
  DocumentSchema,
  DocumentSection,
} from '../../../../src/components/DocumentStudio/types';

function srcRef(id: string) {
  return { sourceType: 'interview', sourceId: id, sourceTitle: `Source ${id}` };
}

// ---------------------------------------------------------------------------
// A fixture with every one of the 13 canonical block types.
// ---------------------------------------------------------------------------

function allBlockTypesFixture(): DocumentSchema {
  const blocks: DocumentBlock[] = [
    { blockId: 'b-heading', type: 'heading', content: { level: 2, text: 'Findings' } },
    {
      blockId: 'b-para',
      type: 'paragraph',
      content: { text: 'The transformation is on track.' },
      sourceRef: srcRef('s-para'),
    },
    {
      blockId: 'b-bullet',
      type: 'bullet_list',
      content: { items: ['Alpha', 'Beta', 'Gamma'] },
      isAssumption: true,
    },
    {
      blockId: 'b-num',
      type: 'numbered_list',
      content: { items: ['First', 'Second'] },
    },
    {
      blockId: 'b-table',
      type: 'table',
      content: { columns: ['Metric', 'Value'], rows: [['Uptime', '99.9%']] },
      sourceRef: srcRef('s-table'),
    },
    {
      blockId: 'b-callout',
      type: 'callout',
      content: { variant: 'warning', text: 'Budget at risk' },
    },
    {
      blockId: 'b-quote',
      type: 'quote',
      content: { text: 'Strategy is about making choices.', cite: 'Porter' },
    },
    {
      blockId: 'b-kpi',
      type: 'kpi_strip',
      content: { items: [{ label: 'NPS', value: '42', delta: '+5' }] },
    },
    {
      blockId: 'b-risk',
      type: 'risk_table',
      content: {
        columns: ['Risk', 'Likelihood', 'Impact'],
        rows: [['Scope creep', 'High', 'High']],
      },
      isAssumption: true,
    },
    {
      blockId: 'b-image',
      type: 'image',
      content: { url: 'https://x/y.png', alt: 'Diagram', caption: 'System map' },
    },
    {
      blockId: 'b-chart',
      type: 'chart',
      content: {
        kind: 'bar',
        title: 'Revenue',
        categories: ['Q1', 'Q2'],
        series: [{ label: 'Net', values: [10, 20] }],
      },
      sourceRef: srcRef('s-chart'),
    },
    { blockId: 'b-footnote', type: 'footnote', content: { text: 'See appendix A.' } },
    {
      blockId: 'b-citation',
      type: 'citation',
      content: { text: 'McKinsey, 2024' },
      sourceRef: srcRef('s-cit'),
    },
  ];

  const section: DocumentSection = {
    sectionId: 'sec-1',
    orderIndex: 0,
    level: 1,
    title: 'Executive Summary',
    purpose: 'Frame the decision',
    blocks,
    sourceRefs: [srcRef('s-sec')],
  };

  const section2: DocumentSection = {
    sectionId: 'sec-2',
    orderIndex: 1,
    level: 2,
    title: 'Recommendations',
    blocks: [{ blockId: 'b2-para', type: 'paragraph', content: { text: 'Proceed to pilot.' } }],
    sourceRefs: [],
  };

  return {
    documentId: 'doc-1',
    artifactId: 'artifact-1',
    title: 'Q3 Board Memo',
    documentType: 'board_report',
    language: 'en',
    audience: ['Board'],
    goal: 'decide',
    communicationRegister: 'executive',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'client_confidential',
    sections: [section, section2],
    sourceRefs: [srcRef('s-doc')],
    owner: 'user-7',
  };
}

function roundTrip(schema: DocumentSchema): DocumentSchema {
  const pm = schemaToProseMirror(schema);
  return proseMirrorToSchema(pm, schema);
}

describe('R1 FT-1 — schema ↔ ProseMirror round-trip', () => {
  it('preserves every one of the 13 block types in order', () => {
    const original = allBlockTypesFixture();
    const back = roundTrip(original);

    const origTypes = original.sections[0].blocks.map((b) => b.type);
    const backTypes = back.sections[0].blocks.map((b) => b.type);
    expect(backTypes).toEqual(origTypes);
    expect(new Set(origTypes).size).toBe(13);
  });

  it('preserves every blockId (zero loss)', () => {
    const original = allBlockTypesFixture();
    const back = roundTrip(original);
    const origIds = original.sections.flatMap((s) => s.blocks.map((b) => b.blockId));
    const backIds = back.sections.flatMap((s) => s.blocks.map((b) => b.blockId));
    expect(backIds).toEqual(origIds);
  });

  it('preserves sourceRef on every block that carried one', () => {
    const original = allBlockTypesFixture();
    const back = roundTrip(original);
    const byId = new Map(back.sections.flatMap((s) => s.blocks).map((b) => [b.blockId, b]));
    for (const b of original.sections.flatMap((s) => s.blocks)) {
      if (b.sourceRef) {
        expect(byId.get(b.blockId)?.sourceRef).toEqual(b.sourceRef);
      } else {
        expect(byId.get(b.blockId)?.sourceRef).toBeUndefined();
      }
    }
  });

  it('preserves isAssumption flags exactly (no false positives/negatives)', () => {
    const original = allBlockTypesFixture();
    const back = roundTrip(original);
    const byId = new Map(back.sections.flatMap((s) => s.blocks).map((b) => [b.blockId, b]));
    for (const b of original.sections.flatMap((s) => s.blocks)) {
      expect(Boolean(byId.get(b.blockId)?.isAssumption)).toBe(Boolean(b.isAssumption));
    }
  });

  it('re-groups blocks back under their original sectionId', () => {
    const original = allBlockTypesFixture();
    const back = roundTrip(original);
    expect(back.sections.map((s) => s.sectionId)).toEqual(['sec-1', 'sec-2']);
    expect(back.sections[0].blocks).toHaveLength(13);
    expect(back.sections[1].blocks).toHaveLength(1);
    expect(back.sections[1].blocks[0].blockId).toBe('b2-para');
  });

  it('preserves section titles, levels, purpose and sourceRefs', () => {
    const original = allBlockTypesFixture();
    const back = roundTrip(original);
    expect(back.sections[0].title).toBe('Executive Summary');
    expect(back.sections[0].level).toBe(1);
    expect(back.sections[0].purpose).toBe('Frame the decision');
    expect(back.sections[0].sourceRefs).toEqual([srcRef('s-sec')]);
    expect(back.sections[1].title).toBe('Recommendations');
    expect(back.sections[1].level).toBe(2);
  });

  it('preserves rich block content opaquely (chart / table / kpi / image / quote)', () => {
    const original = allBlockTypesFixture();
    const back = roundTrip(original);
    const byId = new Map(back.sections.flatMap((s) => s.blocks).map((b) => [b.blockId, b]));
    expect(byId.get('b-chart')?.content).toEqual(original.sections[0].blocks[10].content);
    expect(byId.get('b-table')?.content).toEqual(original.sections[0].blocks[4].content);
    expect(byId.get('b-kpi')?.content).toEqual(original.sections[0].blocks[7].content);
    expect(byId.get('b-risk')?.content).toEqual(original.sections[0].blocks[8].content);
    expect(byId.get('b-image')?.content).toEqual(original.sections[0].blocks[9].content);
    expect(byId.get('b-quote')?.content).toEqual(original.sections[0].blocks[6].content);
  });

  it('preserves text-block content (heading text+level, paragraph, lists, callout)', () => {
    const original = allBlockTypesFixture();
    const back = roundTrip(original);
    const byId = new Map(back.sections.flatMap((s) => s.blocks).map((b) => [b.blockId, b]));
    expect(byId.get('b-heading')?.content).toEqual({ level: 2, text: 'Findings' });
    expect(byId.get('b-para')?.content).toEqual({ text: 'The transformation is on track.' });
    expect(byId.get('b-bullet')?.content).toEqual({ items: ['Alpha', 'Beta', 'Gamma'] });
    expect(byId.get('b-num')?.content).toEqual({ items: ['First', 'Second'] });
    expect(byId.get('b-callout')?.content).toEqual({ variant: 'warning', text: 'Budget at risk' });
  });

  it('preserves canonical bold, italic and link marks on editable text', () => {
    const original = allBlockTypesFixture();
    original.sections[0].blocks[1].content = {
      text: 'Approve the pilot now',
      richText: [
        { type: 'text', text: 'Approve', marks: [{ type: 'bold' }] },
        { type: 'text', text: ' the pilot ', marks: [{ type: 'italic' }] },
        {
          type: 'text',
          text: 'now',
          marks: [{ type: 'link', attrs: { href: 'https://example.com/evidence' } }],
        },
      ],
    };

    const back = roundTrip(original);
    expect(back.sections[0].blocks[1].content).toEqual(original.sections[0].blocks[1].content);
  });

  it('preserves footnote / citation block types (not flattened to paragraph)', () => {
    const original = allBlockTypesFixture();
    const back = roundTrip(original);
    const byId = new Map(back.sections.flatMap((s) => s.blocks).map((b) => [b.blockId, b]));
    expect(byId.get('b-footnote')?.type).toBe('footnote');
    expect(byId.get('b-footnote')?.content).toEqual({ text: 'See appendix A.' });
    expect(byId.get('b-citation')?.type).toBe('citation');
    expect(byId.get('b-citation')?.content).toEqual({ text: 'McKinsey, 2024' });
  });

  it('preserves document-level metadata verbatim from the base schema', () => {
    const original = allBlockTypesFixture();
    const back = roundTrip(original);
    expect(back.title).toBe(original.title);
    expect(back.documentType).toBe('board_report');
    expect(back.language).toBe('en');
    expect(back.owner).toBe('user-7');
    expect(back.confidentiality).toBe('client_confidential');
    expect(back.sourceRefs).toEqual(original.sourceRefs);
  });

  it('tolerates legacy "list" blockType in PM attrs (resolves by live node type)', () => {
    // Simulate a PM doc whose list node carries the legacy blockType 'list'.
    const original = allBlockTypesFixture();
    const pm = schemaToProseMirror(original);
    for (const node of pm.content) {
      if (node.type === 'bulletList' || node.type === 'orderedList') {
        (node.attrs as Record<string, unknown>).blockType = 'list';
      }
    }
    const back = proseMirrorToSchema(pm, original);
    const byId = new Map(back.sections.flatMap((s) => s.blocks).map((b) => [b.blockId, b]));
    // Even with the stale 'list' attr, the bullet/ordered node type wins.
    expect(byId.get('b-bullet')?.type).toBe('bullet_list');
    expect(byId.get('b-num')?.type).toBe('numbered_list');
  });

  it('is idempotent across a second round-trip (stable fixed point)', () => {
    const original = allBlockTypesFixture();
    const once = roundTrip(original);
    const twice = roundTrip(once);
    expect(twice.sections).toEqual(once.sections);
  });
});
