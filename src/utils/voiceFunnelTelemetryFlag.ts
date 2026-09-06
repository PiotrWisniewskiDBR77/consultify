/**
 * Chat V9 / VOICE VM10 — feature flag for the voice funnel telemetry.
 *
 * What this gates
 * ---------------
 *   - All `emit*` helpers in `voiceFunnelTelemetry.ts` become no-ops when
 *     this flag is off. The underlying voice behaviour (`useUniversalVoice`
 *     STT / TTS) is untouched — we only gate whether the funnel emits
 *     `voice_start`, `voice_stt_success`, `voice_stt_fail`, `tts_on`.
 *
 * Why a dedicated flag (and not piggy-back on individual UI flags)
 * ----------------------------------------------------------------
 *   The funnel is cross-cutting. If we ever need to disable all voice
 *   telemetry (e.g. a GDPR / data-residency escalation) we want ONE
 *   switch, not four. Likewise, a vendor change (e.g. swap Whisper for
 *   another STT) might need us to pause emits for a day while a schema
 *   settles — that is exactly the emergency this flag is built for.
 *
 * Resolution order (highest wins):
 *   1. URL query `?ff_voiceFunnelTelemetry=0|1` — operator bypass.
 *   2. `localStorage["ff.voice_funnel_telemetry"]` — user override.
 *   3. `import.meta.env.VITE_VOICE_FUNNEL_TELEMETRY` — build-time default.
 *   4. Default: ON. Payloads are closed-enum + no transcript content —
 *      safe to ship by default (see `voiceFunnelTelemetry.ts` for the
 *      exact PII contract).
 */

const LS_KEY = 'ff.voice_funnel_telemetry';
const QUERY_KEY = 'ff_voiceFunnelTelemetry';
const ENV_KEY = 'VITE_VOICE_FUNNEL_TELEMETRY';

function parseFlag(raw: string | null | undefined): boolean | null {
  if (raw === null || raw === undefined) return null;
  const normalized = String(raw).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return null;
}

function readEnvFlag(): boolean {
  try {
    const parsed = parseFlag(
      (import.meta.env as unknown as Record<string, string | undefined>)?.[ENV_KEY]
    );
    return parsed === null ? true : parsed;
  } catch {
    return true;
  }
}

function readQueryOverride(): boolean | null {
  if (typeof window === 'undefined' || !window.location) return null;
  try {
    return parseFlag(new URLSearchParams(window.location.search).get(QUERY_KEY));
  } catch {
    return null;
  }
}

function readLocalStorage(): boolean | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return parseFlag(window.localStorage.getItem(LS_KEY));
  } catch {
    return null;
  }
}

export function isVoiceFunnelTelemetryEnabled(): boolean {
  const fromQuery = readQueryOverride();
  if (fromQuery !== null) return fromQuery;
  const fromLs = readLocalStorage();
  if (fromLs !== null) return fromLs;
  return readEnvFlag();
}

export const VOICE_FUNNEL_TELEMETRY_FLAG_KEYS = {
  localStorage: LS_KEY,
  query: QUERY_KEY,
  env: ENV_KEY,
} as const;
