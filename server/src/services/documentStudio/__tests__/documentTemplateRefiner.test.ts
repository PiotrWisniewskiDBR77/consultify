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

  // ---------------------------------------------------------------------
  // contentHints (additive, 2026-07-23) — mirrors the Deck Template
  // Architect's `refinePresentationTemplateWithLlm` content-hints contract
  // (`presentationTemplateDraftService.test.ts`). Every pre-existing safety
  // guarantee above (fallback on throw/malformed JSON/violation, intent —
  // here title — immutability) is unaffected; these cases cover only the
  // new optional field.
  // ---------------------------------------------------------------------

  it('accepts valid contentHints and attaches them per-section without touching titles/order', async () => {
    const { template, input } = deterministicTemplate();
    const hints = ['Frame the current-state pain points', 'Contrast before/after operating model'];
    const sections = template.sectionBlueprint.map((s) => ({
      title: s.title,
      purpose: s.purpose,
      contentHints: hints,
    }));
    generateChatResponseMock.mockResolvedValueOnce({
      content: JSON.stringify({ sections }),
    });
    const refined = await refineTemplateWithLlm(template, input, { enable: true });
    expect(refined.sectionBlueprint.map((s) => s.title)).toEqual(
      template.sectionBlueprint.map((s) => s.title)
    );
    for (const section of refined.sectionBlueprint) {
      expect(section.contentHints).toEqual(hints);
    }
  });

  it('caps contentHints at 4 items and 100 chars each, dropping non-string/empty entries', async () => {
    const { template, input } = deterministicTemplate();
    const longHint = 'x'.repeat(200);
    const rawHints = ['a', '', 42, 'b', 'c', longHint, 'd', 'e'];
    const sections = template.sectionBlueprint.map((s) => ({
      title: s.title,
      purpose: s.purpose,
      contentHints: rawHints,
    }));
    generateChatResponseMock.mockResolvedValueOnce({
      content: JSON.stringify({ sections }),
    });
    const refined = await refineTemplateWithLlm(template, input, { enable: true });
    const hints = refined.sectionBlueprint[0].contentHints!;
    expect(hints.length).toBe(4);
    expect(hints).toEqual(['a', 'b', 'c', longHint.slice(0, 100)]);
    expect(hints.every((h) => h.length <= 100)).toBe(true);
  });

  it('omits contentHints (undefined) when the LLM does not supply any — never fails the refinement', async () => {
    const { template, input } = deterministicTemplate();
    const sections = template.sectionBlueprint.map((s) => ({
      title: s.title,
      purpose: `${s.purpose} (refined)`,
    }));
    generateChatResponseMock.mockResolvedValueOnce({
      content: JSON.stringify({ sections }),
    });
    const refined = await refineTemplateWithLlm(template, input, { enable: true });
    for (const section of refined.sectionBlueprint) {
      expect(section.contentHints).toBeUndefined();
    }
  });

  it('an invalid contentHints value (not an array) is lenient — still refines purpose fine', async () => {
    const { template, input } = deterministicTemplate();
    const sections = template.sectionBlueprint.map((s) => ({
      title: s.title,
      purpose: s.purpose,
      contentHints: 'not an array',
    }));
    generateChatResponseMock.mockResolvedValueOnce({
      content: JSON.stringify({ sections }),
    });
    const refined = await refineTemplateWithLlm(template, input, { enable: true });
    expect(refined.sectionBlueprint[0].contentHints).toBeUndefined();
  });

  // ---------------------------------------------------------------------
  // keyMessage / dataNeeded / suggestedEvidence (additive, 2026-07-23) —
  // mirrors the contentHints contract above: lenient sanitize (invalid/
  // missing → undefined, never fails the refinement), title/order
  // immutability unaffected.
  // ---------------------------------------------------------------------

  it('accepts valid keyMessage, dataNeeded and suggestedEvidence per-section without touching titles/order', async () => {
    const { template, input } = deterministicTemplate();
    const dataNeeded = ['Latest org chart', 'Customer churn by segment, last 4 quarters'];
    const sections = template.sectionBlueprint.map((s) => ({
      title: s.title,
      purpose: s.purpose,
      keyMessage: 'The current operating model cannot scale past 3x volume.',
      dataNeeded,
      suggestedEvidence: 'quote from stakeholder interview',
    }));
    generateChatResponseMock.mockResolvedValueOnce({
      content: JSON.stringify({ sections }),
    });
    const refined = await refineTemplateWithLlm(template, input, { enable: true });
    expect(refined.sectionBlueprint.map((s) => s.title)).toEqual(
      template.sectionBlueprint.map((s) => s.title)
    );
    for (const section of refined.sectionBlueprint) {
      expect(section.keyMessage).toBe('The current operating model cannot scale past 3x volume.');
      expect(section.dataNeeded).toEqual(dataNeeded);
      expect(section.suggestedEvidence).toBe('quote from stakeholder interview');
    }
  });

  it('caps dataNeeded at 6 items and 100 chars, keyMessage at 200 chars, suggestedEvidence at 150 chars', async () => {
    const { template, input } = deterministicTemplate();
    const longItem = 'x'.repeat(200);
    const rawDataNeeded = ['a', '', 42, 'b', 'c', 'd', 'e', longItem, 'g'];
    const longKeyMessage = 'k'.repeat(300);
    const longEvidence = 'e'.repeat(250);
    const sections = template.sectionBlueprint.map((s) => ({
      title: s.title,
      purpose: s.purpose,
      keyMessage: longKeyMessage,
      dataNeeded: rawDataNeeded,
      suggestedEvidence: longEvidence,
    }));
    generateChatResponseMock.mockResolvedValueOnce({
      content: JSON.stringify({ sections }),
    });
    const refined = await refineTemplateWithLlm(template, input, { enable: true });
    const section = refined.sectionBlueprint[0];
    expect(section.keyMessage).toBe(longKeyMessage.slice(0, 200));
    expect(section.keyMessage!.length).toBe(200);
    expect(section.dataNeeded!.length).toBe(6);
    expect(section.dataNeeded).toEqual(['a', 'b', 'c', 'd', 'e', longItem.slice(0, 100)]);
    expect(section.dataNeeded!.every((v) => v.length <= 100)).toBe(true);
    expect(section.suggestedEvidence).toBe(longEvidence.slice(0, 150));
    expect(section.suggestedEvidence!.length).toBe(150);
  });

  it('omits keyMessage/dataNeeded/suggestedEvidence (undefined) when the LLM does not supply any — never fails the refinement', async () => {
    const { template, input } = deterministicTemplate();
    const sections = template.sectionBlueprint.map((s) => ({
      title: s.title,
      purpose: `${s.purpose} (refined)`,
    }));
    generateChatResponseMock.mockResolvedValueOnce({
      content: JSON.stringify({ sections }),
    });
    const refined = await refineTemplateWithLlm(template, input, { enable: true });
    for (const section of refined.sectionBlueprint) {
      expect(section.keyMessage).toBeUndefined();
      expect(section.dataNeeded).toBeUndefined();
      expect(section.suggestedEvidence).toBeUndefined();
    }
  });

  it('invalid keyMessage/dataNeeded/suggestedEvidence values are lenient — still refines purpose fine', async () => {
    const { template, input } = deterministicTemplate();
    const sections = template.sectionBlueprint.map((s) => ({
      title: s.title,
      purpose: s.purpose,
      keyMessage: 42,
      dataNeeded: 'not an array',
      suggestedEvidence: { nested: true },
    }));
    generateChatResponseMock.mockResolvedValueOnce({
      content: JSON.stringify({ sections }),
    });
    const refined = await refineTemplateWithLlm(template, input, { enable: true });
    expect(refined.sectionBlueprint[0].keyMessage).toBeUndefined();
    expect(refined.sectionBlueprint[0].dataNeeded).toBeUndefined();
    expect(refined.sectionBlueprint[0].suggestedEvidence).toBeUndefined();
    expect(refined.sectionBlueprint[0].purpose).toBe(template.sectionBlueprint[0].purpose);
  });
});
