/**
 * Document Narrative Refiner tests (MVP-1 finalization).
 *
 * The refiner is intentionally conservative: it must always return a valid
 * DocumentOutline that is a permutation of the deterministic outline, with
 * (at most) rewritten purpose strings. These tests pin all failure paths so
 * the deterministic fallback cannot regress.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentIntake } from '../documentStudioTypes.js';

vi.mock('../../aiService.js', () => ({
  generateChatResponse: vi.fn(),
}));

import { generateChatResponse } from '../../aiService.js';
import { planDocumentOutline } from '../documentNarrativePlanner.js';
import { refineOutlineWithLlm } from '../documentNarrativeRefiner.js';

const mockedLlm = vi.mocked(generateChatResponse);

const baseIntake: DocumentIntake = {
  description: 'Prepare an executive memo for the board with key findings and a recommendation.',
  audience: ['Board'],
  language: 'en',
  goal: 'decide',
};

describe('refineOutlineWithLlm', () => {
  beforeEach(() => {
    mockedLlm.mockReset();
  });

  it('returns deterministic outline when refinement is disabled', async () => {
    const deterministic = planDocumentOutline(baseIntake);
    const refined = await refineOutlineWithLlm(deterministic, baseIntake, { enable: false });
    expect(refined).toBe(deterministic);
    expect(mockedLlm).not.toHaveBeenCalled();
  });

  it('falls back to deterministic outline when the LLM throws (AI freeze, network, etc.)', async () => {
    const deterministic = planDocumentOutline(baseIntake);
    mockedLlm.mockRejectedValueOnce(new Error('AI_BUDGET_EXHAUSTED'));
    const refined = await refineOutlineWithLlm(deterministic, baseIntake, { enable: true });
    expect(refined.sections.map((s) => s.title)).toEqual(
      deterministic.sections.map((s) => s.title)
    );
  });

  it('falls back when the LLM returns malformed JSON', async () => {
    const deterministic = planDocumentOutline(baseIntake);
    mockedLlm.mockResolvedValueOnce({ content: 'not json at all <xml> blah' });
    const refined = await refineOutlineWithLlm(deterministic, baseIntake, { enable: true });
    expect(refined.sections.map((s) => s.title)).toEqual(
      deterministic.sections.map((s) => s.title)
    );
    expect(refined.sections.map((s) => s.purpose)).toEqual(
      deterministic.sections.map((s) => s.purpose)
    );
  });

  it('falls back when the LLM tries to invent a section not in the deterministic set', async () => {
    const deterministic = planDocumentOutline(baseIntake);
    const inventedTitle = 'Hallucinated Section That Does Not Exist';
    mockedLlm.mockResolvedValueOnce({
      content: JSON.stringify({
        sections: [
          ...deterministic.sections.map((s) => ({ title: s.title, purpose: s.purpose })),
          { title: inventedTitle, purpose: 'Fictional purpose.' },
        ],
      }),
    });
    const refined = await refineOutlineWithLlm(deterministic, baseIntake, { enable: true });
    expect(refined.sections.map((s) => s.title)).toEqual(
      deterministic.sections.map((s) => s.title)
    );
    expect(refined.sections.find((s) => s.title === inventedTitle)).toBeUndefined();
  });

  it('falls back when the LLM drops a deterministic section', async () => {
    const deterministic = planDocumentOutline(baseIntake);
    const partial = deterministic.sections.slice(0, deterministic.sections.length - 1);
    mockedLlm.mockResolvedValueOnce({
      content: JSON.stringify({
        sections: partial.map((s) => ({ title: s.title, purpose: s.purpose })),
      }),
    });
    const refined = await refineOutlineWithLlm(deterministic, baseIntake, { enable: true });
    expect(refined.sections.length).toBe(deterministic.sections.length);
    expect(refined.sections.map((s) => s.title)).toEqual(
      deterministic.sections.map((s) => s.title)
    );
  });

  it('accepts a valid permutation with refined purposes (reorder + rewrite)', async () => {
    const deterministic = planDocumentOutline(baseIntake);
    const reversed = [...deterministic.sections].reverse();
    mockedLlm.mockResolvedValueOnce({
      content: [
        '```json',
        JSON.stringify({
          sections: reversed.map((s, i) => ({
            title: s.title,
            purpose: `Refined purpose ${i + 1}`,
          })),
        }),
        '```',
      ].join('\n'),
    });
    const refined = await refineOutlineWithLlm(deterministic, baseIntake, { enable: true });
    expect(refined.sections.map((s) => s.title)).toEqual(reversed.map((s) => s.title));
    expect(refined.sections.every((s) => s.purpose.startsWith('Refined purpose '))).toBe(true);
    // Critical safety property: the set of titles equals the deterministic set.
    expect(new Set(refined.sections.map((s) => s.title))).toEqual(
      new Set(deterministic.sections.map((s) => s.title))
    );
  });

  it('preserves original purpose when LLM returns empty/whitespace purpose for a section', async () => {
    const deterministic = planDocumentOutline(baseIntake);
    mockedLlm.mockResolvedValueOnce({
      content: JSON.stringify({
        sections: deterministic.sections.map((s) => ({ title: s.title, purpose: '   ' })),
      }),
    });
    const refined = await refineOutlineWithLlm(deterministic, baseIntake, { enable: true });
    expect(refined.sections.map((s) => s.purpose)).toEqual(
      deterministic.sections.map((s) => s.purpose)
    );
  });
});
