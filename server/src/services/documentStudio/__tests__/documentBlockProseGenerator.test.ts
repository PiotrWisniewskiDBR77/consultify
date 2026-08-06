/**
 * Document Studio — Block-level Prose Generator (D11).
 *
 * Verifies the opt-in LLM enrichment layer that fills deterministic
 * placeholder prose with grounded narrative:
 *   1. With `enable: false` the schema is returned unchanged.
 *   2. A well-formed LLM response rewrites paragraph/callout `text` and
 *      list `items` for the matching blocks; structured blocks
 *      (risk_table) are never touched.
 *   3. Unknown / mismatched blockIds in the response are ignored.
 *   4. Any failure path (LLM throw, empty response, invalid JSON) falls
 *      back to the deterministic schema unchanged — never throws.
 *   5. Grounded blocks lose the `isAssumption` flag when sources exist.
 *
 * The AI service is mocked at the module boundary so the spec runs
 * without a live LLM.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentIntake, DocumentSchema, DocumentSourceRef } from '../documentStudioTypes.js';

const generateChatResponseMock = vi.fn();

vi.mock('../../aiService.js', () => ({
  generateChatResponse: (...args: unknown[]) => generateChatResponseMock(...args),
}));

const { generateBlockProse } = await import('../documentBlockProseGenerator.js');

const intake: DocumentIntake = {
  description: 'Decide whether to migrate the billing platform to the new vendor.',
  language: 'en',
  goal: 'decide',
};

const sourceRefs: DocumentSourceRef[] = [
  { sourceType: 'interview', sourceId: 's1', sourceTitle: 'CFO interview transcript' },
];

function makeSchema(): DocumentSchema {
  return {
    documentId: 'doc-prose-1',
    artifactId: 'art-prose-1',
    title: 'Billing Platform Decision',
    documentType: 'executive_memo',
    language: 'en',
    audience: ['Board'],
    goal: 'decide',
    communicationRegister: 'executive',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'internal',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    formattingSchema: {} as any,
    sections: [
      {
        sectionId: 'sec-1',
        orderIndex: 0,
        level: 1,
        title: 'Executive Summary',
        blocks: [
          {
            blockId: 'blk-para',
            type: 'paragraph',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content: { text: 'placeholder summary' } as any,
            isAssumption: true,
          },
          {
            blockId: 'blk-list',
            type: 'bullet_list',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content: { items: ['placeholder item'] } as any,
            isAssumption: true,
          },
          {
            blockId: 'blk-risk',
            type: 'risk_table',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            content: { columns: ['Risk'], rows: [['r1']] } as any,
            isAssumption: true,
          },
        ],
        sourceRefs: [],
      },
    ],
    sourceRefs,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('generateBlockProse', () => {
  beforeEach(() => {
    generateChatResponseMock.mockReset();
  });

  afterEach(() => {
    generateChatResponseMock.mockReset();
  });

  it('returns the schema unchanged when disabled', async () => {
    const schema = makeSchema();
    const result = await generateBlockProse(schema, intake, sourceRefs, { enable: false });
    expect(result).toBe(schema);
    expect(generateChatResponseMock).not.toHaveBeenCalled();
  });

  it('rewrites paragraph text and list items, leaves structured blocks untouched', async () => {
    generateChatResponseMock.mockResolvedValue({
      content: JSON.stringify({
        blocks: [
          { blockId: 'blk-para', text: 'The Board should approve the migration this quarter.' },
          {
            blockId: 'blk-list',
            items: ['Lower unit cost', 'Faster billing cycle', 'Lower vendor risk'],
          },
          // A structured block id the model should not be filling — ignored
          // because risk_table is not a prose target.
          { blockId: 'blk-risk', text: 'should be ignored' },
        ],
      }),
    });

    const result = await generateBlockProse(makeSchema(), intake, sourceRefs, { enable: true });

    const section = result.sections[0];
    expect((section.blocks[0].content as { text: string }).text).toBe(
      'The Board should approve the migration this quarter.'
    );
    expect((section.blocks[1].content as { items: string[] }).items).toEqual([
      'Lower unit cost',
      'Faster billing cycle',
      'Lower vendor risk',
    ]);
    // risk_table content is preserved verbatim.
    expect(section.blocks[2].content).toEqual({ columns: ['Risk'], rows: [['r1']] });
    // Grounded blocks lose the bare-assumption flag (sources present).
    expect(section.blocks[0].isAssumption).toBe(false);
  });

  it('removes unsupported claims introduced by the prose enrichment pass', async () => {
    generateChatResponseMock.mockResolvedValue({
      content: JSON.stringify({
        blocks: [
          {
            blockId: 'blk-para',
            text: 'Reach 85% by entering DACH with 8 initiatives.',
          },
        ],
      }),
    });

    const result = await generateBlockProse(makeSchema(), intake, sourceRefs, { enable: true });
    expect((result.sections[0].blocks[0].content as { text: string }).text).toContain(
      'unsupported claim'
    );
    expect(result.sections[0].blocks[0].isAssumption).toBe(true);
  });

  it('ignores unknown blockIds in the response', async () => {
    generateChatResponseMock.mockResolvedValue({
      content: JSON.stringify({
        blocks: [{ blockId: 'does-not-exist', text: 'nope' }],
      }),
    });
    const original = makeSchema();
    const result = await generateBlockProse(original, intake, sourceRefs, { enable: true });
    // No matching block → no change → original reference returned.
    expect(result).toBe(original);
  });

  it('falls back to the deterministic schema when the LLM throws', async () => {
    generateChatResponseMock.mockRejectedValue(new Error('FEATURE_UNAVAILABLE'));
    const original = makeSchema();
    const result = await generateBlockProse(original, intake, sourceRefs, { enable: true });
    expect(result).toBe(original);
  });

  it('falls back when the LLM returns invalid JSON', async () => {
    generateChatResponseMock.mockResolvedValue({ content: 'not json at all' });
    const original = makeSchema();
    const result = await generateBlockProse(original, intake, sourceRefs, { enable: true });
    expect(result).toBe(original);
  });

  it('strips a markdown fence before parsing', async () => {
    generateChatResponseMock.mockResolvedValue({
      content: '```json\n{"blocks":[{"blockId":"blk-para","text":"Fenced prose."}]}\n```',
    });
    const result = await generateBlockProse(makeSchema(), intake, sourceRefs, { enable: true });
    expect((result.sections[0].blocks[0].content as { text: string }).text).toBe('Fenced prose.');
  });
});
