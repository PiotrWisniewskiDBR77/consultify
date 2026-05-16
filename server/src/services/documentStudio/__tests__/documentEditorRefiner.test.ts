/**
 * Document Studio — AI Editor refiner safety contract tests (MVP-3 hardening).
 *
 * Mirrors the safety properties of `documentTemplateRefiner.test.ts`:
 *
 *   - Disabled refinement returns null (caller falls back).
 *   - LLM throwing → null (no exception leaks).
 *   - Malformed JSON → null.
 *   - JSON without a string `text` field → null.
 *   - Empty / whitespace-only rewrite → null.
 *   - Output exceeding the absolute character cap → null.
 *   - Output exceeding the soft growth cap (4× input) → null (when input is
 *     non-trivial).
 *   - Empty instruction → null without invoking the LLM.
 *   - Empty source text → null without invoking the LLM.
 *   - Valid rewrite within all bounds → returned trimmed.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../aiService.js', () => ({
  generateChatResponse: vi.fn(),
}));

import { generateChatResponse } from '../../aiService.js';
import type { EditorRefinerContext } from '../documentEditorRefiner.js';
import { refineEditorTextWithLlm } from '../documentEditorRefiner.js';

const generateChatResponseMock = vi.mocked(generateChatResponse);

const baseContext: EditorRefinerContext = {
  documentType: 'executive_memo',
  scope: 'local',
  communicationRegister: 'executive',
  language: 'en',
};

describe('AI Editor refiner safety contract (MVP-3 hardening)', () => {
  beforeEach(() => {
    generateChatResponseMock.mockReset();
  });

  it('returns null when refinement is disabled', async () => {
    const result = await refineEditorTextWithLlm(
      'Source paragraph that is non-trivial enough to bypass the empty checks.',
      'Make it more concise.',
      baseContext,
      { enable: false }
    );
    expect(result).toBeNull();
    expect(generateChatResponseMock).not.toHaveBeenCalled();
  });

  it('returns null without calling the LLM when the instruction is empty', async () => {
    const result = await refineEditorTextWithLlm(
      'Source paragraph that is non-trivial enough.',
      '   ',
      baseContext
    );
    expect(result).toBeNull();
    expect(generateChatResponseMock).not.toHaveBeenCalled();
  });

  it('returns null without calling the LLM when the source text is empty', async () => {
    const result = await refineEditorTextWithLlm('   ', 'Make it more concise.', baseContext);
    expect(result).toBeNull();
    expect(generateChatResponseMock).not.toHaveBeenCalled();
  });

  it('falls back to null when the LLM throws', async () => {
    generateChatResponseMock.mockRejectedValueOnce(new Error('FEATURE_UNAVAILABLE'));
    const result = await refineEditorTextWithLlm(
      'Source paragraph that is non-trivial enough.',
      'Make it more concise.',
      baseContext
    );
    expect(result).toBeNull();
  });

  it('falls back to null when the LLM returns malformed JSON', async () => {
    generateChatResponseMock.mockResolvedValueOnce({
      content: 'this is not JSON, just prose',
    });
    const result = await refineEditorTextWithLlm(
      'Source paragraph that is non-trivial enough.',
      'Make it more concise.',
      baseContext
    );
    expect(result).toBeNull();
  });

  it('falls back to null when JSON has no text field', async () => {
    generateChatResponseMock.mockResolvedValueOnce({
      content: JSON.stringify({ rewrite: 'wrong key' }),
    });
    const result = await refineEditorTextWithLlm(
      'Source paragraph that is non-trivial enough.',
      'Make it more concise.',
      baseContext
    );
    expect(result).toBeNull();
  });

  it('falls back to null when the rewrite is empty', async () => {
    generateChatResponseMock.mockResolvedValueOnce({
      content: JSON.stringify({ text: '   ' }),
    });
    const result = await refineEditorTextWithLlm(
      'Source paragraph that is non-trivial enough.',
      'Make it more concise.',
      baseContext
    );
    expect(result).toBeNull();
  });

  it('falls back to null when the rewrite exceeds the absolute character cap', async () => {
    const huge = 'X'.repeat(5000);
    generateChatResponseMock.mockResolvedValueOnce({
      content: JSON.stringify({ text: huge }),
    });
    const result = await refineEditorTextWithLlm(
      'Source paragraph that is non-trivial enough to make the cap relevant.',
      'Expand massively.',
      baseContext
    );
    expect(result).toBeNull();
  });

  it('falls back to null when the rewrite exceeds 4× input length on a non-trivial input', async () => {
    const before = 'A short executive paragraph used as the soft growth cap baseline today now.';
    expect(before.length).toBeGreaterThanOrEqual(40);
    const inflated = `${before} `.repeat(20).trim();
    generateChatResponseMock.mockResolvedValueOnce({
      content: JSON.stringify({ text: inflated }),
    });
    const result = await refineEditorTextWithLlm(before, 'Inflate dramatically.', baseContext);
    expect(result).toBeNull();
  });

  it('returns the trimmed rewrite when within all bounds', async () => {
    generateChatResponseMock.mockResolvedValueOnce({
      content: JSON.stringify({
        text: '   Refined and concise version of the executive paragraph.   ',
      }),
    });
    const result = await refineEditorTextWithLlm(
      'Original executive paragraph that needs tightening.',
      'Make it punchier.',
      baseContext
    );
    expect(result).toBe('Refined and concise version of the executive paragraph.');
  });

  it('accepts JSON wrapped in fenced code blocks', async () => {
    generateChatResponseMock.mockResolvedValueOnce({
      content: '```json\n{"text":"Tighter version of the original paragraph."}\n```',
    });
    const result = await refineEditorTextWithLlm(
      'Original executive paragraph that needs tightening for board attention.',
      'Tighten it.',
      baseContext
    );
    expect(result).toBe('Tighter version of the original paragraph.');
  });
});
