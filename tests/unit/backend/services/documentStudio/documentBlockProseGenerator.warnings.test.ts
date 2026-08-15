/**
 * A4 — wiring tests for `generateBlockProse` + the generation-warnings
 * collector. Verifies that:
 *   - an LLM failure records an `llm_prose_fallback` warning AND still
 *     returns the deterministic stub schema unchanged (fallback intact);
 *   - an empty / unparseable LLM response records a warning too;
 *   - a successful generation records NO warning;
 *   - omitting the collector is a safe no-op (legacy behaviour).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the LLM service the prose generator depends on. The mock is
// reconfigured per-test via `mockImplementation`.
const generateChatResponseMock = vi.fn();
vi.mock('../../../../../server/src/services/aiService.js', () => ({
  generateChatResponse: (...args: unknown[]) => generateChatResponseMock(...args),
}));

import { generateBlockProse } from '../../../../../server/src/services/documentStudio/documentBlockProseGenerator.js';
import { createDocumentGenerationWarningCollector } from '../../../../../server/src/services/documentStudio/documentGenerationWarnings.js';
import type {
  DocumentIntake,
  DocumentSchema,
} from '../../../../../server/src/services/documentStudio/documentStudioTypes.js';

function makeSchema(): DocumentSchema {
  return {
    documentId: 'doc-1',
    artifactId: 'art-1',
    title: 'Test',
    documentType: 'generic_document',
    language: 'en',
    audience: ['exec'],
    goal: 'inform',
    communicationRegister: 'executive',
    density: 'standard',
    languageStyle: 'consulting',
    confidentiality: 'internal',
    // formattingSchema is not read by generateBlockProse; a loose cast keeps
    // the fixture minimal.
    formattingSchema: {} as DocumentSchema['formattingSchema'],
    sections: [
      {
        sectionId: 's1',
        orderIndex: 0,
        level: 1,
        title: 'Overview',
        blocks: [
          {
            blockId: 'blk-1',
            type: 'paragraph',
            content: { text: 'Placeholder prose goes here.' },
          },
        ],
        sourceRefs: [],
      },
    ],
    sourceRefs: [],
    createdAt: '2020-01-01T00:00:00.000Z',
    updatedAt: '2020-01-01T00:00:00.000Z',
  };
}

const intake: DocumentIntake = { description: 'brief' };

describe('generateBlockProse + generation warnings', () => {
  beforeEach(() => {
    generateChatResponseMock.mockReset();
  });

  it('records llm_prose_fallback and returns stubs unchanged when the LLM throws', async () => {
    generateChatResponseMock.mockRejectedValue(new Error('provider down'));
    const schema = makeSchema();
    const warnings = createDocumentGenerationWarningCollector();

    const result = await generateBlockProse(schema, intake, [], { enable: true, warnings });

    // Fallback intact: the deterministic stub survives.
    expect(result).toBe(schema);
    expect((result.sections[0].blocks[0].content as { text: string }).text).toBe(
      'Placeholder prose goes here.'
    );
    // Warning recorded.
    const list = warnings.list();
    expect(list).toHaveLength(1);
    expect(list[0].code).toBe('llm_prose_fallback');
    expect(list[0].scope).toBe('document');
    expect(list[0].message).toBe(
      'LLM prose generation partially failed; some sections retained deterministic placeholders.'
    );
    expect(list[0].message).not.toContain('provider down');
  });

  it('records llm_prose_fallback when the response is empty / unparseable', async () => {
    generateChatResponseMock.mockResolvedValue({ content: 'not json at all' });
    const warnings = createDocumentGenerationWarningCollector();

    const result = await generateBlockProse(makeSchema(), intake, [], { enable: true, warnings });

    const list = warnings.list();
    expect(list).toHaveLength(1);
    expect(list[0].code).toBe('llm_prose_fallback');
    // Deterministic stub retained.
    expect((result.sections[0].blocks[0].content as { text: string }).text).toBe(
      'Placeholder prose goes here.'
    );
  });

  it('records NO warning when generation succeeds', async () => {
    generateChatResponseMock.mockResolvedValue({
      content: JSON.stringify({
        blocks: [{ blockId: 'blk-1', text: 'Grounded, real prose.' }],
      }),
    });
    const warnings = createDocumentGenerationWarningCollector();

    const result = await generateBlockProse(makeSchema(), intake, [], { enable: true, warnings });

    expect(warnings.size()).toBe(0);
    expect((result.sections[0].blocks[0].content as { text: string }).text).toBe(
      'Grounded, real prose.'
    );
  });

  it('is a safe no-op when no collector is passed (LLM failure path)', async () => {
    generateChatResponseMock.mockRejectedValue(new Error('boom'));
    const schema = makeSchema();
    // Must not throw even without a collector.
    const result = await generateBlockProse(schema, intake, [], { enable: true });
    expect(result).toBe(schema);
  });
});
