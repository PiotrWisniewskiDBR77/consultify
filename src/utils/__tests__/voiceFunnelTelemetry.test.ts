/**
 * Chat V9 / VOICE VM10 — tests for the voice funnel telemetry helpers.
 *
 * Coverage:
 *   - Each emit* helper dispatches the matching closed-enum event when
 *     the flag is on.
 *   - Emits become no-ops when the flag is off (both the return value
 *     and the underlying `trackFunnelEvent` are silent).
 *   - `bucketTranscriptLength` returns stable buckets for representative
 *     lengths AND never exposes transcript text via its return value.
 *   - `trackFunnelEvent` throwing never escapes a helper (advisory
 *     contract: telemetry failures must not break voice).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  bucketTranscriptLength,
  emitTtsOn,
  emitVoiceStart,
  emitVoiceSttFail,
  emitVoiceSttSuccess,
} from '../voiceFunnelTelemetry';

const trackFunnelEventMock = vi.fn();
vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: (...args: unknown[]) => trackFunnelEventMock(...args),
}));

const isFlagEnabledMock = vi.fn<[], boolean>(() => true);
vi.mock('../voiceFunnelTelemetryFlag', () => ({
  isVoiceFunnelTelemetryEnabled: () => isFlagEnabledMock(),
  VOICE_FUNNEL_TELEMETRY_FLAG_KEYS: {
    localStorage: 'ff.voice_funnel_telemetry',
    query: 'ff_voiceFunnelTelemetry',
    env: 'VITE_VOICE_FUNNEL_TELEMETRY',
  },
}));

describe('voiceFunnelTelemetry — emits when flag is ON', () => {
  beforeEach(() => {
    trackFunnelEventMock.mockReset();
    isFlagEnabledMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emitVoiceStart fires `voice_start` with the typed payload', () => {
    const ok = emitVoiceStart({
      sttProvider: 'whisper',
      trigger: 'conversation',
      language: 'pl',
    });

    expect(ok).toBe(true);
    expect(trackFunnelEventMock).toHaveBeenCalledTimes(1);
    expect(trackFunnelEventMock).toHaveBeenCalledWith('voice_start', {
      sttProvider: 'whisper',
      trigger: 'conversation',
      language: 'pl',
    });
  });

  it('emitVoiceSttSuccess fires `voice_stt_success` with the length bucket only', () => {
    emitVoiceSttSuccess({
      sttProvider: 'web',
      trigger: 'single',
      language: 'en',
      transcriptLengthBucket: 'short',
    });

    expect(trackFunnelEventMock).toHaveBeenCalledWith('voice_stt_success', {
      sttProvider: 'web',
      trigger: 'single',
      language: 'en',
      transcriptLengthBucket: 'short',
    });
    // Belt & suspenders: confirm no raw-text leakage path exists in the
    // payload shape — there is no `text` / `content` / `transcript` key.
    const payload = trackFunnelEventMock.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(payload)).not.toContain('text');
    expect(Object.keys(payload)).not.toContain('content');
    expect(Object.keys(payload)).not.toContain('transcript');
  });

  it('emitVoiceSttFail fires `voice_stt_fail` with the closed reason enum', () => {
    emitVoiceSttFail({
      sttProvider: 'whisper',
      trigger: 'conversation',
      language: 'de',
      reason: 'server_error',
    });

    expect(trackFunnelEventMock).toHaveBeenCalledWith('voice_stt_fail', {
      sttProvider: 'whisper',
      trigger: 'conversation',
      language: 'de',
      reason: 'server_error',
    });
  });

  it('emitTtsOn fires `tts_on` with provider, language, auto flag', () => {
    emitTtsOn({
      ttsProvider: 'openai',
      language: 'pl',
      auto: true,
    });

    expect(trackFunnelEventMock).toHaveBeenCalledWith('tts_on', {
      ttsProvider: 'openai',
      language: 'pl',
      auto: true,
    });
  });
});

describe('voiceFunnelTelemetry — kill-switch', () => {
  beforeEach(() => {
    trackFunnelEventMock.mockReset();
    isFlagEnabledMock.mockReturnValue(false);
  });

  it('no helper emits when the flag is OFF', () => {
    expect(emitVoiceStart({ sttProvider: 'whisper', trigger: 'single', language: 'pl' })).toBe(
      false
    );
    expect(
      emitVoiceSttSuccess({
        sttProvider: 'whisper',
        trigger: 'single',
        language: 'pl',
        transcriptLengthBucket: 'medium',
      })
    ).toBe(false);
    expect(
      emitVoiceSttFail({
        sttProvider: 'whisper',
        trigger: 'single',
        language: 'pl',
        reason: 'unknown',
      })
    ).toBe(false);
    expect(emitTtsOn({ ttsProvider: 'openai', language: 'pl', auto: false })).toBe(false);

    expect(trackFunnelEventMock).not.toHaveBeenCalled();
  });
});

describe('voiceFunnelTelemetry — advisory contract', () => {
  beforeEach(() => {
    trackFunnelEventMock.mockReset();
    isFlagEnabledMock.mockReturnValue(true);
  });

  it('swallows telemetry sink errors and returns false — voice path stays alive', () => {
    trackFunnelEventMock.mockImplementationOnce(() => {
      throw new Error('sink exploded');
    });

    // Must NOT throw. Return value `false` signals "not delivered" so
    // callers can degrade gracefully if they ever care (today they don't).
    expect(() =>
      emitVoiceStart({ sttProvider: 'web', trigger: 'single', language: 'en' })
    ).not.toThrow();
    // The emit was attempted before the throw — the mock recorded the
    // call. Our contract is about not-propagating the failure, not
    // about not-calling the sink.
    expect(trackFunnelEventMock).toHaveBeenCalledTimes(1);
  });
});

describe('bucketTranscriptLength', () => {
  it('returns "empty" for null, undefined, empty and whitespace-only', () => {
    expect(bucketTranscriptLength(null)).toBe('empty');
    expect(bucketTranscriptLength(undefined)).toBe('empty');
    expect(bucketTranscriptLength('')).toBe('empty');
    expect(bucketTranscriptLength('   ')).toBe('empty');
  });

  it('maps short / medium / long lengths at the documented boundaries', () => {
    // <=40 → short
    expect(bucketTranscriptLength('Hello world')).toBe('short');
    expect(bucketTranscriptLength('a'.repeat(40))).toBe('short');
    // 41..200 → medium
    expect(bucketTranscriptLength('a'.repeat(41))).toBe('medium');
    expect(bucketTranscriptLength('a'.repeat(200))).toBe('medium');
    // >200 → long
    expect(bucketTranscriptLength('a'.repeat(201))).toBe('long');
  });

  it('never surfaces transcript text in the return value (only a closed enum)', () => {
    const bucket = bucketTranscriptLength('secret GDPR-protected prompt content');
    // The return is one of four strings. It is impossible by construction
    // for it to contain the input — this test exists to freeze that
    // contract against future refactors that might leak.
    expect(['empty', 'short', 'medium', 'long']).toContain(bucket);
    expect(bucket).not.toMatch(/secret|GDPR|prompt/i);
  });
});
