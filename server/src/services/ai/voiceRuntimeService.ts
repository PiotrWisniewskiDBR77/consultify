/**
 * Voice runtime resolver — single source of truth for assistant voice config.
 *
 * Both the public Anna voice surface (`/api/public/anna/voice-config`) and the
 * authenticated Teresa V10 surface (`/api/v10/teresa/voice-config`) resolve their
 * "is voice enabled / what model / what voice / mint a session" decision here, so
 * the AI OS diagnostics panel can never disagree with what actually powers voice.
 *
 * Config precedence:
 *   1. DB-backed virtual worker record (voice_enabled / voice_name / status / surface)
 *   2. Environment fallback (TERESA_VOICE_ENABLED / TERESA_VOICE_NAME / TERESA_VOICE_MODEL)
 *      — used when there is no worker row for the assistant (e.g. teresa).
 */

import {
  mintGeminiLiveEphemeralToken,
  resolveGeminiLiveServerKey,
} from './geminiLiveTokenService.js';
import { getWorkerWithProfile } from './virtualWorkerService.js';

const DEFAULT_VOICE_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';

export type VoiceRuntimeResult = {
  enabled: boolean;
  model: string;
  voiceName: string | null;
  session: unknown | null;
  unavailableReason: string | null;
  /** Where the enable decision came from, for diagnostics. */
  source: 'worker' | 'env';
  /** Admin-configured persona (from the active worker profile), when available. */
  persona: string | null;
  /** Admin-configured tone (from the active worker profile), when available. */
  tone: string | null;
};

export type ResolveVoiceRuntimeOptions = {
  /** Virtual worker id, e.g. 'anna' | 'teresa'. */
  assistant: string;
  /** Stable key for rate-limiting / session subject. */
  subjectKey: string;
  /** When true (public landing surfaces), the worker must expose a public surface. */
  requirePublicSurface?: boolean;
  /** When false, resolve config only (do not mint a live session token). */
  mintSession?: boolean;
  /**
   * Which config governs the enable decision:
   *   - 'worker' (default): the DB virtual-worker record is authoritative (status,
   *     voice_enabled, surface all gate). Used by Anna (public).
   *   - 'env': the TERESA_VOICE_ENABLED flag is authoritative; the worker is only
   *     consulted for voice name / persona.
   */
  enableSource?: 'worker' | 'env';
  /**
   * Only meaningful with enableSource='worker'. When true, a NON-ACTIVE worker row
   * (draft/disabled) does NOT disable the assistant — it falls back to env. Used by
   * Teresa so a stale/not-yet-activated worker row can't silently kill workspace
   * voice. Anna leaves this false: a disabled Anna worker must turn voice off.
   */
  fallbackToEnvWhenInactive?: boolean;
};

/**
 * Resolve the voice runtime for an assistant. Reads the DB worker record first
 * and falls back to env. Optionally mints a Gemini Live ephemeral session.
 */
export async function resolveVoiceRuntime(
  options: ResolveVoiceRuntimeOptions
): Promise<VoiceRuntimeResult> {
  const {
    assistant,
    subjectKey,
    requirePublicSurface = false,
    mintSession = true,
    enableSource = 'worker',
    fallbackToEnvWhenInactive = false,
  } = options;

  const hasServerKey = Boolean(resolveGeminiLiveServerKey());

  const envEnabled = String(process.env.TERESA_VOICE_ENABLED || 'true').toLowerCase() !== 'false';
  const envVoiceName = String(process.env.TERESA_VOICE_NAME || '').trim() || null;
  const model = String(process.env.TERESA_VOICE_MODEL || '').trim() || DEFAULT_VOICE_MODEL;

  let voiceName: string | null = envVoiceName;
  // Default enable decision = env flag. An ACTIVE worker overrides it below.
  let enabledByConfig = envEnabled;
  let source: 'worker' | 'env' = 'env';
  let persona: string | null = null;
  let tone: string | null = null;

  try {
    const workerConfig = await getWorkerWithProfile(assistant);
    const worker = workerConfig?.worker;
    if (worker) {
      // The worker record always supplies the voice name when configured.
      const configuredVoiceName = String(worker.voice_name || '').trim();
      if (configuredVoiceName) voiceName = configuredVoiceName;

      if (enableSource === 'worker') {
        const isActive = worker.status === 'active';
        if (isActive) {
          // Active worker is authoritative: voice_enabled + surface gate, persona/tone apply.
          source = 'worker';
          const publicSurfaceOk =
            !requirePublicSurface || worker.surface === 'landing_page' || worker.surface === 'both';
          enabledByConfig = worker.voice_enabled !== false && publicSurfaceOk;

          const profile = workerConfig?.profile;
          if (profile) {
            persona = String(profile.persona_description || '').trim() || null;
            tone = String(profile.tone_description || '').trim() || null;
          }
        } else if (fallbackToEnvWhenInactive) {
          // Lenient (Teresa): a stale/not-yet-activated row must not kill voice → keep env.
        } else {
          // Strict (Anna): a disabled/draft worker turns voice off.
          source = 'worker';
          enabledByConfig = false;
        }
      }
    }
  } catch {
    // Worker table may not exist yet — keep env fallback.
  }

  const session =
    mintSession && hasServerKey && enabledByConfig
      ? await mintGeminiLiveEphemeralToken({
          assistant: assistant as 'anna' | 'teresa',
          subjectKey,
        })
      : null;

  const enabled = Boolean(session) && enabledByConfig;

  const unavailableReason = enabled
    ? null
    : hasServerKey
      ? 'server_voice_proxy_required'
      : 'server_missing_gemini_live_key';

  return {
    enabled,
    model,
    voiceName,
    session,
    unavailableReason,
    source,
    persona,
    tone,
  };
}
