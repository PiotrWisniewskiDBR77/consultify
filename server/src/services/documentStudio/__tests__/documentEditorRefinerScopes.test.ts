/**
 * Document Studio — Editor Refiner methodology + source scope tests
 * (Epic E3, Slices 4.1 + 4.2).
 *
 * These tests focus on the LLM-side contract of the refiner: that the
 * scope-specific system prompts are produced, that the source-scope
 * preservation guard correctly accepts faithful rewrites and rejects
 * fact-drift / citation-drift, and that the deterministic fallback
 * surfaces in those rejection paths.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateChatResponse } from '../../aiService.js';
import {
  preservesSourceFactsAndCitations,
  refineEditorTextWithLlm,
} from '../documentEditorRefiner.js';

vi.mock('../../aiService.js', () => ({
  generateChatResponse: vi.fn(),
}));

const mockedGenerate = vi.mocked(generateChatResponse);

afterEach(() => {
  mockedGenerate.mockReset();
});

describe('Editor Refiner — methodology scope', () => {
  it('passes scope hint through to the system prompt and accepts a faithful rewrite', async () => {
    mockedGenerate.mockResolvedValueOnce({
      content: JSON.stringify({
        text: 'We follow a three-phase approach: discovery, design and delivery, with explicit assumptions tracked per phase.',
      }),
    });

    const before =
      'Our approach is three phases: discovery, design and delivery, with explicit assumptions tracked per phase across the engagement timeline window.';
    const result = await refineEditorTextWithLlm(
      before,
      'Refine for executive register',
      {
        documentType: 'business_case',
        scope: 'methodology',
        communicationRegister: 'executive',
        language: 'en',
      },
      { enable: true }
    );
    expect(result).toContain('three-phase approach');
    expect(mockedGenerate).toHaveBeenCalledTimes(1);
    const callArgs = mockedGenerate.mock.calls[0]?.[0];
    expect(callArgs?.systemPrompt).toContain('METHODOLOGY SCOPE');
    expect(callArgs?.systemPrompt).toContain('MUST NOT invent new methodology steps');
  });

  it('still accepts a methodology rewrite that drops a digit (no source-scope guard active)', async () => {
    // Methodology scope deliberately does NOT enforce numeric preservation
    // because legitimate methodology refinements may rephrase "phase 1"
    // into "first phase" or drop step numbering. The guard is exclusive
    // to source scope.
    mockedGenerate.mockResolvedValueOnce({
      content: JSON.stringify({
        text: 'Our approach unfolds in phases: discovery, design and delivery, with explicit assumptions tracked at each step throughout engagement timeline window planning carefully.',
      }),
    });
    const before =
      'Our approach is three phases: discovery, design and delivery, with explicit assumptions tracked per phase across the engagement timeline window planning carefully.';
    const result = await refineEditorTextWithLlm(
      before,
      'Refine prose',
      { scope: 'methodology', language: 'en' },
      { enable: true }
    );
    expect(result).toBeTruthy();
    expect(result).not.toContain('three');
  });
});

describe('Editor Refiner — source scope preservation guard', () => {
  it('accepts a rewrite that preserves all numbers and citation markers', async () => {
    mockedGenerate.mockResolvedValueOnce({
      content: JSON.stringify({
        text: 'Adoption reached 12% in Q2 2026 [Source: McKinsey 2026], up from 7% the prior period.',
      }),
    });
    const before =
      'Adoption hit 12% in Q2 2026 [Source: McKinsey 2026], up from 7% in the prior period.';
    const result = await refineEditorTextWithLlm(
      before,
      'Polish prose',
      { scope: 'source', language: 'en' },
      { enable: true }
    );
    expect(result).toContain('12%');
    expect(result).toContain('[Source: McKinsey 2026]');
  });

  it('rejects a rewrite that silently changes a number (returns null → deterministic fallback)', async () => {
    mockedGenerate.mockResolvedValueOnce({
      content: JSON.stringify({
        text: 'Adoption reached 13% in Q2 2026 [Source: McKinsey 2026], up from 7% the prior period.',
      }),
    });
    const before =
      'Adoption hit 12% in Q2 2026 [Source: McKinsey 2026], up from 7% in the prior period.';
    const result = await refineEditorTextWithLlm(
      before,
      'Polish prose',
      { scope: 'source', language: 'en' },
      { enable: true }
    );
    expect(result).toBeNull();
  });

  it('rejects a rewrite that drops a citation marker', async () => {
    mockedGenerate.mockResolvedValueOnce({
      content: JSON.stringify({
        text: 'Adoption reached 12% in Q2 2026, up from 7% the prior period.',
      }),
    });
    const before =
      'Adoption hit 12% in Q2 2026 [Source: McKinsey 2026], up from 7% in the prior period.';
    const result = await refineEditorTextWithLlm(
      before,
      'Polish prose',
      { scope: 'source', language: 'en' },
      { enable: true }
    );
    expect(result).toBeNull();
  });

  it('rejects a rewrite that adds a fabricated citation marker', async () => {
    mockedGenerate.mockResolvedValueOnce({
      content: JSON.stringify({
        text: 'Adoption reached 12% in Q2 2026 [Source: McKinsey 2026] [Source: Internal Data 2026], up from 7% the prior period.',
      }),
    });
    const before =
      'Adoption hit 12% in Q2 2026 [Source: McKinsey 2026], up from 7% in the prior period.';
    const result = await refineEditorTextWithLlm(
      before,
      'Polish prose',
      { scope: 'source', language: 'en' },
      { enable: true }
    );
    expect(result).toBeNull();
  });

  it('tolerates Polish decimal comma vs English decimal point as the same value (12,5 == 12.5)', () => {
    const before = 'Marża operacyjna wzrosła do 12,5% w Q2 2026 [Source: PwC 2026].';
    const after = 'Marza operacyjna wzrosla do 12.5% w Q2 2026 [Source: PwC 2026].';
    expect(preservesSourceFactsAndCitations(before, after)).toBe(true);
  });

  it('rejects rewrites where citation marker changes case-sensitive content', () => {
    const before = 'Adoption hit 12% [Source: McKinsey 2026].';
    const after = 'Adoption hit 12% [Source: BCG 2026].';
    expect(preservesSourceFactsAndCitations(before, after)).toBe(false);
  });

  it('passes scope-specific guardrails through to the system prompt', async () => {
    mockedGenerate.mockResolvedValueOnce({
      content: JSON.stringify({
        text: 'Adoption hit 12% in Q2 2026 [Source: McKinsey 2026].',
      }),
    });
    await refineEditorTextWithLlm(
      'Adoption hit 12% in Q2 2026 [Source: McKinsey 2026].',
      'Polish prose',
      { scope: 'source', language: 'en' },
      { enable: true }
    );
    const callArgs = mockedGenerate.mock.calls[0]?.[0];
    expect(callArgs?.systemPrompt).toContain('SOURCE-ANCHORED SCOPE');
    expect(callArgs?.systemPrompt).toContain('MUST NOT modify any numbers');
    expect(callArgs?.systemPrompt).toContain('MUST PRESERVE every bracketed citation marker');
  });
});

describe('Editor Refiner — transformative scope (Slice E3.6)', () => {
  it('passes the TRANSFORMATIVE SCOPE prompt header through to the system prompt', async () => {
    mockedGenerate.mockResolvedValueOnce({
      content: JSON.stringify({
        text: 'A completely restructured executive narrative that reorganizes the underlying argument from analytical bullets into a tightly-scoped story arc that opens with the decision the leader must make today.',
      }),
    });
    const before =
      'Initial bullet 1: market growth slowed to 4%. Bullet 2: competitor moves are accelerating. Bullet 3: our share is stable but at risk.';
    const result = await refineEditorTextWithLlm(
      before,
      'Rebuild this as a single executive paragraph',
      { scope: 'transformative', documentType: 'executive_memo', language: 'en' },
      { enable: true }
    );
    expect(result).not.toBeNull();
    const callArgs = mockedGenerate.mock.calls[0]?.[0];
    expect(callArgs?.systemPrompt).toContain('TRANSFORMATIVE SCOPE');
    expect(callArgs?.systemPrompt).toContain('You MAY restructure paragraphs');
    expect(callArgs?.systemPrompt).toContain('You MAY shift the communication register');
    expect(callArgs?.systemPrompt).toContain('You MUST NOT fabricate new factual claims');
  });

  it('does NOT run the source-preservation guard for transformative (numbers MAY change)', async () => {
    // Transformative explicitly allows the model to drop a numeric
    // detail because the user has consciously authorized a rebuild.
    // For source scope, the same rewrite would have collapsed to null.
    mockedGenerate.mockResolvedValueOnce({
      content: JSON.stringify({
        text: 'Adoption surged this quarter, sustaining the upward trajectory we observed last period.',
      }),
    });
    const before =
      'Adoption hit 12% in Q2 2026 [Source: McKinsey 2026], up from 7% in the prior period.';
    const result = await refineEditorTextWithLlm(
      before,
      'Rebuild as a forward-looking narrative',
      { scope: 'transformative', language: 'en' },
      { enable: true }
    );
    expect(result).toBe(
      'Adoption surged this quarter, sustaining the upward trajectory we observed last period.'
    );
  });

  it('still enforces the absolute safety caps (4× growth) under transformative scope', async () => {
    const before = 'Q2 adoption reached 12% across enterprise customers in the EU region.';
    // 5× growth rewrite — exceeds the soft cap and must collapse to null
    // even under transformative scope. The cap is the absolute safety
    // net: structural freedom does not buy unlimited length.
    const after = 'A vast and elaborately detailed narrative recasting. '.repeat(40);
    mockedGenerate.mockResolvedValueOnce({ content: JSON.stringify({ text: after }) });
    const result = await refineEditorTextWithLlm(
      before,
      'Rebuild this as an analytical narrative',
      { scope: 'transformative', language: 'en' },
      { enable: true }
    );
    expect(result).toBeNull();
  });
});

describe('preservesSourceFactsAndCitations helper', () => {
  it('returns true for a no-op rewrite', () => {
    const text = 'Revenue grew to 1.2M [Ref: 12] in 2026.';
    expect(preservesSourceFactsAndCitations(text, text)).toBe(true);
  });

  it('returns false when a number is dropped', () => {
    expect(
      preservesSourceFactsAndCitations(
        'Revenue grew to 1.2M in 2026.',
        'Revenue grew significantly in 2026.'
      )
    ).toBe(false);
  });

  it('returns false when a citation marker count changes (1 → 2)', () => {
    expect(
      preservesSourceFactsAndCitations(
        'A [Source: X] paragraph.',
        'A [Source: X] [Source: Y] paragraph.'
      )
    ).toBe(false);
  });
});
