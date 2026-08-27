import { describe, expect, it } from 'vitest';

import type { ToolReportDocument } from '../../../sharedRuntime/toolOutputs/types.js';
import { buildToolOutputReportSchema } from '../toolOutputReportSchemaService.js';

const document = (
  blocks?: ToolReportDocument['sections'][number]['blocks']
): ToolReportDocument => ({
  id: 'report-1',
  organizationId: 'org-1',
  kind: 'report',
  theme: 'executive-paper',
  title: 'Raport narzędzia',
  rendererVersion: '1.0.0',
  sourceOutputIds: ['output-1'],
  sections: [
    {
      id: 'section-1',
      actionTitle: 'Podejmij decyzję',
      sourceOutputId: 'output-1',
      blocks: blocks ?? [
        { kind: 'action-title', text: 'Działanie' },
        { kind: 'paragraph', text: 'Treść źródłowa.' },
        { kind: 'evidence-list', items: [{ label: 'Dowód', evidenceKind: 'fact' }] },
        { kind: 'tension-list', items: [{ posture: 'act', title: 'Napięcie', priority: 4 }] },
        {
          kind: 'conclusion',
          k1Fact: 'Fakt',
          k2Meaning: 'Znaczenie',
          k3Actions: ['Działaj'],
          k4Effect: 'Efekt',
          tradeoff: { chosen: 'A', rejected: 'B', why: 'Dowód' },
        },
        { kind: 'signature-visual', archetype: 'dynamic-swot', payload: {} },
      ],
    },
  ],
  contentHash: 'hash-1',
});

const build = (doc = document()) =>
  buildToolOutputReportSchema({
    document: doc,
    createdAt: '2026-08-28T10:00:00.000Z',
    updatedAt: '2026-08-28T11:00:00.000Z',
  });

describe('Day 40 — tool report to shared document schema', () => {
  it('is deterministic for the same frozen input', () => {
    expect(build()).toEqual(build());
  });

  it('maps all six ReportBlock variants without dropping any', () => {
    const blocks = build().sections[0].blocks;
    expect(blocks).toHaveLength(6);
    expect(blocks.map((block) => block.type)).toEqual([
      'heading',
      'paragraph',
      'bullet_list',
      'bullet_list',
      'callout',
      'paragraph',
    ]);
    expect(JSON.stringify(blocks)).toContain('nie ma reprezentacji w eksporcie tekstowym');
  });

  it('uses the owner-approved placeholder for an empty section', () => {
    expect(JSON.stringify(build(document([])))).toContain(
      'Sekcja do uzupełnienia — limit 80–120 słów.'
    );
  });

  it('preserves non-empty output lineage', () => {
    const schema = build();
    expect(schema.artifactId).toBe('output-1');
    expect(schema.sourceRefs).toEqual(
      expect.arrayContaining([expect.objectContaining({ sourceId: 'output-1' })])
    );
  });

  it('does not invent substantive prose for an honestly empty report', () => {
    const text = JSON.stringify(build(document([])));
    expect(text).toContain('Sekcja do uzupełnienia — limit 80–120 słów.');
    expect(text).not.toMatch(/lorem|jako model|rekomendujemy|zwiększy przychody/i);
  });
});
