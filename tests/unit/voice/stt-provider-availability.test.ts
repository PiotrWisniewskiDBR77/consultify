/**
 * M10 Interview — server STT provider availability (HARVARD H6.1)
 *
 * WHY: Voice answers were "transcribed on screen but not saved". The FE
 * fail-safe (interim-flush) now always persists the browser transcript even
 * when server STT is down. But operators could not tell WHETHER server STT was
 * wired on a given deploy, because the /api/voice/health probe (and the mental
 * model) only looked at OPENAI_API_KEY — while STT actually also works with
 * GROQ_API_KEY or the Gemini/Google key that powers Teresa's voice.
 *
 * These tests pin the single source of truth used by the health probe and the
 * startup env warning: detectSttProviderFromEnv(). They assert STT is reported
 * available for EACH provider path, and unavailable only when truly no key is set.
 *
 * Run: npx vitest run tests/unit/voice/stt-provider-availability.test.ts
 */
import { describe, expect, it } from 'vitest';

import {
  STT_ENV_KEYS,
  detectSttProviderFromEnv,
} from '../../../server/src/services/ai/VoiceService.js';

const EMPTY: NodeJS.ProcessEnv = {};

describe('detectSttProviderFromEnv — server STT wiring diagnostics', () => {
  it('reports OpenAI Whisper available when OPENAI_API_KEY is a real key', () => {
    const r = detectSttProviderFromEnv({ OPENAI_API_KEY: 'sk-live-abc123' });
    expect(r.available).toBe(true);
    expect(r.provider).toBe('openai');
  });

  it('ignores OpenRouter / test placeholder OpenAI keys (not real Whisper keys)', () => {
    expect(detectSttProviderFromEnv({ OPENAI_API_KEY: 'sk-or-xyz' }).available).toBe(false);
    expect(detectSttProviderFromEnv({ OPENAI_API_KEY: 'sk-test-xyz' }).available).toBe(false);
  });

  it('reports Groq available when GROQ_API_KEY is set (no OpenAI)', () => {
    const r = detectSttProviderFromEnv({ GROQ_API_KEY: 'gsk-abc' });
    expect(r.available).toBe(true);
    expect(r.provider).toBe('groq');
  });

  it('reports Gemini available when only the Google/Teresa key is set', () => {
    // This is the DEMO/STAGING reality: Teresa voice uses GEMINI_API_KEY, and
    // STT falls back to Gemini. The old health check falsely said "unavailable".
    expect(detectSttProviderFromEnv({ GEMINI_API_KEY: 'g-abc' }).provider).toBe('gemini');
    expect(detectSttProviderFromEnv({ GOOGLE_AI_API_KEY: 'g-abc' }).provider).toBe('gemini');
    expect(detectSttProviderFromEnv({ GOOGLE_API_KEY: 'g-abc' }).provider).toBe('gemini');
  });

  it('treats the Gemini placeholder value as NOT configured', () => {
    const r = detectSttProviderFromEnv({ GEMINI_API_KEY: 'YOUR_GEMINI_API_KEY_HERE' });
    expect(r.available).toBe(false);
  });

  it('reports unavailable when no STT provider key is set at all', () => {
    const r = detectSttProviderFromEnv(EMPTY);
    expect(r.available).toBe(false);
    expect(r.provider).toBeNull();
  });

  it('always advertises the full list of env keys that would enable STT', () => {
    const r = detectSttProviderFromEnv(EMPTY);
    // Diagnostics must name the keys so demo/staging can be fixed without guessing.
    expect(r.requiredEnv).toEqual([
      'OPENAI_API_KEY',
      'GROQ_API_KEY',
      'GEMINI_API_KEY',
      'GOOGLE_AI_API_KEY',
      'GOOGLE_API_KEY',
    ]);
    expect(STT_ENV_KEYS.length).toBe(5);
  });

  it('prefers OpenAI over Groq over Gemini when multiple keys are present', () => {
    const all = {
      OPENAI_API_KEY: 'sk-live-1',
      GROQ_API_KEY: 'gsk-2',
      GEMINI_API_KEY: 'g-3',
    };
    expect(detectSttProviderFromEnv(all).provider).toBe('openai');
    const { OPENAI_API_KEY: _omit, ...noOpenai } = all;
    void _omit;
    expect(detectSttProviderFromEnv(noOpenai).provider).toBe('groq');
  });
});
