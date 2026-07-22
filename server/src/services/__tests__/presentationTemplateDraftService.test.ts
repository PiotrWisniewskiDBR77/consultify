/**
 * Deck Template Architect — draft/refine service tests.
 *
 * Mirrors the safety contract already covered for Word
 * (`documentStudio/__tests__/documentTemplateRefiner.test.ts`): this is the
 * first test coverage for `refinePresentationTemplateWithLlm` itself (the
 * existing `presentationTemplateArchitectService.test.ts` covers a
 * different, unrelated deterministic module — see 2026-07-22 Gen. Deck
 * catch-up audit). Focus: the new optional `contentHints` field added on
 * top of the existing title-only refiner contract must be strictly
 * additive — every pre-existing safety guarantee (intent immutability,
 * fallback on throw/malformed JSON/violation) must still hold unchanged.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../aiService.js', () => ({
  generateChatResponse: vi.fn(),
}));

import { generateChatResponse } from '../aiService.js';
import {
  draftPresentationTemplate,
  refinePresentationTemplateWithLlm,
  type DraftedPresentationTemplate,
  type PresentationTemplateDraftInput,
} from '../presentationTemplateDraftService.js';

const generateChatResponseMock = vi.mocked(generateChatResponse);

function deterministicTemplate(): {
  template: DraftedPresentationTemplate;
  input: PresentationTemplateDraftInput;
} {
  const input: PresentationTemplateDraftInput = {
    purpose: 'Quarterly steering committee update',
    deckType: 'steering_committee',
  };
  const { template } = draftPresentationTemplate({ input });
  return { template, input };
}

function mockLlmContent(content: string): void {
  generateChatResponseMock.mockResolvedValueOnce({ content } as any);
}

describe('refinePresentationTemplateWithLlm — content hints (additive, 2026-07-22)', () => {
  beforeEach(() => {
    generateChatResponseMock.mockReset();
  });

  it('falls back to null when the LLM throws (unchanged baseline contract)', async () => {
    const { template, input } = deterministicTemplate();
    generateChatResponseMock.mockRejectedValueOnce(new Error('FEATURE_UNAVAILABLE'));
    const refined = await refinePresentationTemplateWithLlm(template, input);
    expect(refined).toBeNull();
  });

  it('falls back to null on malformed JSON (unchanged baseline contract)', async () => {
    const { template, input } = deterministicTemplate();
    mockLlmContent('not json at all');
    const refined = await refinePresentationTemplateWithLlm(template, input);
    expect(refined).toBeNull();
  });

  it('falls back to null when an intent is renamed (unchanged baseline contract)', async () => {
    const { template, input } = deterministicTemplate();
    const tampered = {
      name: template.name,
      slides: template.outlineJson.map((s, i) => ({
        intent: i === 0 ? 'not_a_real_intent' : s.intent,
        title: s.title,
      })),
    };
    mockLlmContent(JSON.stringify(tampered));
    const refined = await refinePresentationTemplateWithLlm(template, input);
    expect(refined).toBeNull();
  });

  it('accepts valid contentHints and attaches them per-slide without touching intents/order', async () => {
    const { template, input } = deterministicTemplate();
    const hints = ['Frame the current-state pain points', 'Contrast before/after operating model'];
    const payload = {
      name: template.name,
      description: template.description,
      slides: template.outlineJson.map((s) => ({
        intent: s.intent,
        title: s.title,
        contentHints: hints,
      })),
    };
    mockLlmContent(JSON.stringify(payload));
    const refined = await refinePresentationTemplateWithLlm(template, input);
    expect(refined).not.toBeNull();
    expect(refined!.outlineJson.map((s) => s.intent)).toEqual(
      template.outlineJson.map((s) => s.intent)
    );
    for (const slide of refined!.outlineJson) {
      expect(slide.contentHints).toEqual(hints);
    }
  });

  it('caps contentHints at 4 items and 100 chars each, dropping non-string/empty entries', async () => {
    const { template, input } = deterministicTemplate();
    const longHint = 'x'.repeat(200);
    const rawHints = ['a', '', 42, 'b', 'c', longHint, 'd', 'e'];
    const payload = {
      slides: template.outlineJson.map((s) => ({
        intent: s.intent,
        title: s.title,
        contentHints: rawHints,
      })),
    };
    mockLlmContent(JSON.stringify(payload));
    const refined = await refinePresentationTemplateWithLlm(template, input);
    expect(refined).not.toBeNull();
    const hints = refined!.outlineJson[0].contentHints!;
    expect(hints.length).toBe(4);
    expect(hints).toEqual(['a', 'b', 'c', longHint.slice(0, 100)]);
    expect(hints.every((h) => h.length <= 100)).toBe(true);
  });

  it('omits contentHints (undefined) when the LLM does not supply any — never fails the refinement', async () => {
    const { template, input } = deterministicTemplate();
    const payload = {
      slides: template.outlineJson.map((s) => ({ intent: s.intent, title: `${s.title} (refined)` })),
    };
    mockLlmContent(JSON.stringify(payload));
    const refined = await refinePresentationTemplateWithLlm(template, input);
    expect(refined).not.toBeNull();
    for (const slide of refined!.outlineJson) {
      expect(slide.contentHints).toBeUndefined();
    }
  });

  it('an invalid contentHints value (not an array) is lenient — still refines title/intent fine', async () => {
    const { template, input } = deterministicTemplate();
    const payload = {
      slides: template.outlineJson.map((s) => ({
        intent: s.intent,
        title: s.title,
        contentHints: 'not an array',
      })),
    };
    mockLlmContent(JSON.stringify(payload));
    const refined = await refinePresentationTemplateWithLlm(template, input);
    expect(refined).not.toBeNull();
    expect(refined!.outlineJson[0].contentHints).toBeUndefined();
  });
});
