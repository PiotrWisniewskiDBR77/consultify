/**
 * Document Studio — AI Template Architect refiner tests (MVP-3).
 *
 * Mirrors the safety properties of `documentNarrativeRefiner.test.ts`:
 *
 *   - Disabled refinement returns the original template unchanged.
 *   - LLM throwing → deterministic fallback (no exception leaks to caller).
 *   - Malformed JSON → fallback.
 *   - Returning a new section title not in the blueprint → fallback.
 *   - Returning fewer / more sections than the blueprint → fallback.
 *   - Reordering sections (allowed for outline, NOT for templates) → fallback.
 *   - Successful purpose rewrite + name refinement → applied without changing
 *     any other field.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../aiService.js', () => ({
  generateChatResponse: vi.fn(),
}));

import { generateChatResponse } from '../../aiService.js';
import type { DocumentTemplate, TemplateDraftInput } from '../documentStudioTypes.js';
import { refineTemplateWithLlm } from '../documentTemplateRefiner.js';
import { __resetTemplateRegistryForTests, draftTemplate } from '../documentTemplateService.js';

const generateChatResponseMock = vi.mocked(generateChatResponse);

function deterministicTemplate(): { template: DocumentTemplate; input: TemplateDraftInput } {
  __resetTemplateRegistryForTests();
  const input: TemplateDraftInput = {
    documentType: 'executive_memo',
    purpose: 'Quarterly board memo template',
    audience: ['Board'],
  };
  const drafted = draftTemplate({
    organizationId: 'org-A',
    userId: 'arch-user',
    input,
  });
  return { template: drafted.template, input };
}

describe('AI Template Architect refiner safety contract (MVP-3)', () => {
  beforeEach(() => {
    generateChatResponseMock.mockReset();
  });

  it('returns the original template when disabled', async () => {
    const { template, input } = deterministicTemplate();
    const refined = await refineTemplateWithLlm(template, input, { enable: false });
    expect(refined).toBe(template);
    expect(generateChatResponseMock).not.toHaveBeenCalled();
  });

  it('falls back to the deterministic template when the LLM throws', async () => {
    const { template, input } = deterministicTemplate();
    generateChatResponseMock.mockRejectedValueOnce(new Error('FEATURE_UNAVAILABLE'));
    const refined = await refineTemplateWithLlm(template, input, { enable: true });
    expect(refined).toEqual(template);
  });

  it('falls back when the LLM returns malformed JSON', async () => {
    const { template, input } = deterministicTemplate();
    generateChatResponseMock.mockResolvedValueOnce({
      content: 'this is not JSON at all',
    });
    const refined = await refineTemplateWithLlm(template, input, { enable: true });
    expect(refined).toEqual(template);
  });

  it('falls back when the LLM invents a new section title', async () => {
    const { template, input } = deterministicTemplate();
    const fake = [
      ...template.sectionBlueprint.map((s) => ({ title: s.title, purpose: s.purpose })),
      { title: 'Brand New Section', purpose: 'Should not appear' },
    ];
    generateChatResponseMock.mockResolvedValueOnce({
      content: JSON.stringify({ sections: fake }),
    });
    const refined = await refineTemplateWithLlm(template, input, { enable: true });
    expect(refined).toEqual(template);
  });

  it('falls back when the LLM drops a section', async () => {
    const { template, input } = deterministicTemplate();
    const truncated = template.sectionBlueprint
      .slice(0, -1)
      .map((s) => ({ title: s.title, purpose: s.purpose }));
    generateChatResponseMock.mockResolvedValueOnce({
      content: JSON.stringify({ sections: truncated }),
    });
    const refined = await refineTemplateWithLlm(template, input, { enable: true });
    expect(refined).toEqual(template);
  });

  it('applies purpose rewrites and name refinement when the LLM returns a valid permutation', async () => {
    const { template, input } = deterministicTemplate();
    const sections = template.sectionBlueprint.map((s) => ({
      title: s.title,
      purpose: `Refined purpose for ${s.title}`,
    }));
    generateChatResponseMock.mockResolvedValueOnce({
      content: JSON.stringify({
        name: 'Quarterly Board Memo · Refined',
        sections,
      }),
    });
    const refined = await refineTemplateWithLlm(template, input, { enable: true });
    expect(refined.name).toBe('Quarterly Board Memo · Refined');
    expect(refined.documentType).toBe(template.documentType);
    expect(refined.formattingSchema).toEqual(template.formattingSchema);
    expect(refined.sectionBlueprint.length).toBe(template.sectionBlueprint.length);
    refined.sectionBlueprint.forEach((section, idx) => {
      const original = template.sectionBlueprint[idx];
      expect(section.title).toBe(original.title);
      expect(section.level).toBe(original.level);
      expect(section.required).toBe(original.required);
      expect(section.expectedLengthHint).toBe(original.expectedLengthHint);
      expect(section.purpose).toBe(`Refined purpose for ${section.title}`);
    });
  });

  it('preserves sectionBlueprint order even if the LLM reorders sections', async () => {
    const { template, input } = deterministicTemplate();
    const reversed = [...template.sectionBlueprint]
      .reverse()
      .map((s) => ({ title: s.title, purpose: `Reversed: ${s.purpose}` }));
    generateChatResponseMock.mockResolvedValueOnce({
      content: JSON.stringify({ sections: reversed }),
    });
    const refined = await refineTemplateWithLlm(template, input, { enable: true });
    // Title order must match the original deterministic order (templates
    // canonicalize section order; only purposes may change).
    refined.sectionBlueprint.forEach((section, idx) => {
      expect(section.title).toBe(template.sectionBlueprint[idx].title);
    });
  });
});
