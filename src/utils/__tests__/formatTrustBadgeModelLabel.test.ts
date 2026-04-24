/**
 * Chat V9 / TRUST T-TR1.2 — tests for the Trust Badge model label
 * formatter.
 *
 * Coverage:
 *   - Null / empty / non-string inputs return null.
 *   - UUID-looking ids mask to "Private model".
 *   - GPT / Claude / Gemini / Mistral / Llama family rules resolve
 *     to the documented human labels, including dated suffixes.
 *   - Unknown vendor passes through unchanged (but clipped to
 *     MAX_LABEL_LEN when too long).
 *   - Matching is case-insensitive.
 */

import { describe, expect, it } from 'vitest';

import { formatTrustBadgeModelLabel } from '../formatTrustBadgeModelLabel';

describe('formatTrustBadgeModelLabel', () => {
  it('returns null for non-string inputs', () => {
    expect(formatTrustBadgeModelLabel(null)).toBeNull();
    expect(formatTrustBadgeModelLabel(undefined)).toBeNull();
    expect(formatTrustBadgeModelLabel(42)).toBeNull();
    expect(formatTrustBadgeModelLabel({})).toBeNull();
  });

  it('returns null for empty / whitespace strings', () => {
    expect(formatTrustBadgeModelLabel('')).toBeNull();
    expect(formatTrustBadgeModelLabel('   ')).toBeNull();
  });

  it('masks UUID-like ids to "Private model"', () => {
    expect(formatTrustBadgeModelLabel('e3b0c442-98fc-1c14-9afb-c4e9c4e9c4e9')).toBe(
      'Private model'
    );
    expect(formatTrustBadgeModelLabel('E3B0C442-98FC-1C14-9AFB-C4E9C4E9C4E9')).toBe(
      'Private model'
    );
  });

  describe('GPT family', () => {
    it('gpt-4o base + dated suffix', () => {
      expect(formatTrustBadgeModelLabel('gpt-4o')).toBe('GPT-4o');
      expect(formatTrustBadgeModelLabel('gpt-4o-2024-08-06')).toBe('GPT-4o');
    });
    it('gpt-4o mini variant', () => {
      expect(formatTrustBadgeModelLabel('gpt-4o-mini')).toBe('GPT-4o mini');
    });
    it('gpt-4-turbo', () => {
      expect(formatTrustBadgeModelLabel('gpt-4-turbo')).toBe('GPT-4 Turbo');
      expect(formatTrustBadgeModelLabel('gpt-4-turbo-2024-04-09')).toBe('GPT-4 Turbo');
    });
    it('gpt-4 base', () => {
      expect(formatTrustBadgeModelLabel('gpt-4')).toBe('GPT-4');
    });
    it('gpt-3.5-turbo', () => {
      expect(formatTrustBadgeModelLabel('gpt-3.5-turbo')).toBe('GPT-3.5 Turbo');
      expect(formatTrustBadgeModelLabel('gpt-3.5-turbo-0125')).toBe('GPT-3.5 Turbo');
    });
    it('gpt-5', () => {
      expect(formatTrustBadgeModelLabel('gpt-5')).toBe('GPT-5');
    });
    it('o1 variants keep their exact id (no family collapse)', () => {
      expect(formatTrustBadgeModelLabel('o1-preview')).toBe('o1-preview');
      expect(formatTrustBadgeModelLabel('o1-mini')).toBe('o1-mini');
    });
  });

  describe('Claude family', () => {
    it('claude-3-5-sonnet + dated suffix', () => {
      expect(formatTrustBadgeModelLabel('claude-3-5-sonnet-20241022')).toBe('Claude 3.5 Sonnet');
    });
    it('claude-3-5-haiku', () => {
      expect(formatTrustBadgeModelLabel('claude-3-5-haiku-20241022')).toBe('Claude 3.5 Haiku');
    });
    it('claude-3-opus / claude-3-sonnet / claude-3-haiku', () => {
      expect(formatTrustBadgeModelLabel('claude-3-opus-20240229')).toBe('Claude 3 Opus');
      expect(formatTrustBadgeModelLabel('claude-3-sonnet-20240229')).toBe('Claude 3 Sonnet');
      expect(formatTrustBadgeModelLabel('claude-3-haiku-20240307')).toBe('Claude 3 Haiku');
    });
    it('claude-2', () => {
      expect(formatTrustBadgeModelLabel('claude-2.1')).toBe('Claude 2');
    });
  });

  describe('Gemini family', () => {
    it('gemini-1.5-pro / gemini-1.5-flash', () => {
      expect(formatTrustBadgeModelLabel('gemini-1.5-pro')).toBe('Gemini 1.5 Pro');
      expect(formatTrustBadgeModelLabel('gemini-1.5-flash')).toBe('Gemini 1.5 Flash');
    });
    it('gemini-pro base', () => {
      expect(formatTrustBadgeModelLabel('gemini-pro')).toBe('Gemini Pro');
    });
  });

  describe('Mistral / Llama', () => {
    it('mistral-large', () => {
      expect(formatTrustBadgeModelLabel('mistral-large-latest')).toBe('Mistral Large');
    });
    it('mixtral-8x7b', () => {
      expect(formatTrustBadgeModelLabel('mixtral-8x7b-instruct')).toBe('Mixtral 8x7B');
    });
    it('llama-3 and llama-3.1', () => {
      expect(formatTrustBadgeModelLabel('llama-3-70b-instruct')).toBe('Llama 3');
      expect(formatTrustBadgeModelLabel('llama-3.1-405b')).toBe('Llama 3.1');
    });
  });

  it('unknown vendor passes through unchanged', () => {
    expect(formatTrustBadgeModelLabel('custom-model-42')).toBe('custom-model-42');
  });

  it('unknown vendor is clipped at 32 characters with ellipsis', () => {
    const raw = 'some-absurdly-long-custom-model-id-that-should-clip';
    const out = formatTrustBadgeModelLabel(raw);
    expect(out).not.toBeNull();
    expect((out as string).length).toBeLessThanOrEqual(32);
    expect((out as string).endsWith('…')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(formatTrustBadgeModelLabel('GPT-4O-2024-08-06')).toBe('GPT-4o');
    expect(formatTrustBadgeModelLabel('CLAUDE-3-5-SONNET-20241022')).toBe('Claude 3.5 Sonnet');
  });

  it('trims leading / trailing whitespace before matching', () => {
    expect(formatTrustBadgeModelLabel('  gpt-4o  ')).toBe('GPT-4o');
  });
});
