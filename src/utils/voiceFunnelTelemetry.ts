/**
 * Chat V9 / VOICE VM10 — voice funnel telemetry helpers.
 *
 * Spec: `VOICE_MODE_AUDIO_EXPERIENCE_DEVELOPMENT_PLAN_2026-04-18.md#VM10`
 *
 *   > Zdarzenia: `voice_start`, `voice_stt_success|fail`, `tts_on`,
 *   > `barge_in`, `voice_to_module_nav` (opcjonalnie). RODO-safe
 *   > (bez treści audio).
 *
 * VM4 already shipped `voice_barge_in_notified` — this module owns the
 * remaining four events. `voice_to_module_nav` stays deferred: it needs
 * a routing-layer hook that does not exist on this branch yet.
 *
 * RODO / PII contract
 * -------------------
 * Closed-enum payloads only. No transcript content, no audio blobs, no
 * server response bodies, no timing precision finer than 100 ms buckets.
 * Every helper accepts an explicit typed payload so the call sites
 * cannot accidentally leak user data.
 *
 * Safe dimensions:
 *   - `sttProvider`: 'whisper' | 'web'
 *   - `ttsProvider`: 'openai' | 'edge' | 'web'
 *   - `trigger`: 'single' | 'conversation'
 *   - `language`: 2-letter code the user already chose publicly (pl/en/…)
 *   - `reason` (failures): closed enum, never raw error strings.
 *
 * Forbidden:
 *   - Transcript text (`string`).
 *   - `durationMs` at anything finer than 100 ms (identifying).
 *   - Any field named `text`, `content`, `audio`, `blob`.
 *
 * Every helper is wrapped in try/catch: telemetry is **advisory**, it
 * must never break voice functionality. The flag + try/catch together
 * mean a single emit call at a hot site is safe.
 */

import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { isVoiceFunnelTelemetryEnabled } from './voiceFunnelTelemetryFlag';

// ---------------------------------------------------------------------------
// Closed enums
// ---------------------------------------------------------------------------

export type VoiceSttProvider = 'whisper' | 'web';
export type VoiceTtsProvider = 'openai' | 'edge' | 'web';
export type VoiceSttTrigger = 'single' | 'conversation';

/**
 * Reason codes for `voice_stt_fail`. Keep this list closed — new reasons
 * must be added explicitly. Never pass a raw `error.message` as a reason:
 * messages include server-specific strings that may leak infra details.
 */
export type VoiceSttFailReason =
  | 'permission_denied' // getUserMedia rejected by user or policy.
  | 'no_speech' // Web Speech API signalled `no-speech`.
  | 'server_error' // /api/voice/stt returned non-OK.
  | 'network' // Fetch rejected — offline, CORS, DNS, etc.
  | 'aborted' // User stopped recording before anything transcribed.
  | 'unknown'; // Catch-all — should trend toward zero as we map more cases.

// ---------------------------------------------------------------------------
// Payload shapes — exported so call sites get type-checked.
// ---------------------------------------------------------------------------

export interface VoiceStartPayload {
  readonly sttProvider: VoiceSttProvider;
  readonly trigger: VoiceSttTrigger;
  readonly language: string;
}

export interface VoiceSttSuccessPayload {
  readonly sttProvider: VoiceSttProvider;
  readonly trigger: VoiceSttTrigger;
  readonly language: string;
  /** Transcript *length bucket* — never the text itself. */
  readonly transcriptLengthBucket: 'empty' | 'short' | 'medium' | 'long';
}

export interface VoiceSttFailPayload {
  readonly sttProvider: VoiceSttProvider;
  readonly trigger: VoiceSttTrigger;
  readonly language: string;
  readonly reason: VoiceSttFailReason;
}

export interface TtsOnPayload {
  readonly ttsProvider: VoiceTtsProvider;
  readonly language: string;
  /** Whether auto-speak kicked in (vs a manual replay). */
  readonly auto: boolean;
}

// ---------------------------------------------------------------------------
// Safe-emit wrapper
// ---------------------------------------------------------------------------

function safeTrack(eventName: string, payload: Record<string, unknown>): boolean {
  if (!isVoiceFunnelTelemetryEnabled()) return false;
  try {
    // `trackFunnelEvent` typing is a closed string union on the caller
    // side. We trust the per-helper `eventName` string below to match a
    // registered FunnelEventName — the cast is local and audited here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    trackFunnelEvent(eventName as any, payload);
    return true;
  } catch {
    // Telemetry is advisory — swallowing the error keeps the voice hot
    // path responsive even when the analytics sink misbehaves.
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public emit helpers. Each is a thin, typed wrapper that forces the
// call site through the closed-enum payload.
// ---------------------------------------------------------------------------

/** Transcript length bucket — collapses text into 4 cardinalities. */
export function bucketTranscriptLength(
  text: string | null | undefined
): VoiceSttSuccessPayload['transcriptLengthBucket'] {
  if (!text) return 'empty';
  const len = text.trim().length;
  if (len === 0) return 'empty';
  if (len <= 40) return 'short';
  if (len <= 200) return 'medium';
  return 'long';
}

export function emitVoiceStart(payload: VoiceStartPayload): boolean {
  return safeTrack('voice_start', { ...payload });
}

export function emitVoiceSttSuccess(payload: VoiceSttSuccessPayload): boolean {
  return safeTrack('voice_stt_success', { ...payload });
}

export function emitVoiceSttFail(payload: VoiceSttFailPayload): boolean {
  return safeTrack('voice_stt_fail', { ...payload });
}

export function emitTtsOn(payload: TtsOnPayload): boolean {
  return safeTrack('tts_on', { ...payload });
}
