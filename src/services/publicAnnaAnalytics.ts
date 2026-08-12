export type AnnaLpCtaType = 'demo' | 'trial' | 'contact';
export type AnnaLpChannel = 'text' | 'voice';
export type AnnaLpLanguage = 'pl' | 'en' | 'es' | 'de' | 'ja' | 'ar';
export type AnnaLpSourceIntent =
  | 'learn'
  | 'evaluate_fit'
  | 'pricing'
  | 'security_compliance'
  | 'get_started'
  | 'talk_to_human'
  | 'unknown';

export type AnnaLpCtaVerb =
  | 'impression'
  | 'click'
  | 'start'
  | 'submit_attempt'
  | 'submit_success'
  | 'submit_error'
  | 'retry'
  | 'fallback_used';

export type AnnaLpCtaEventName = `anna_lp.cta.${AnnaLpCtaVerb}`;

// Legacy (kept for continuity while migrating dashboards/tests).
export type LegacyPublicAnnaFunnelEventName =
  | 'landing_anna_widget_opened'
  | 'landing_anna_message_sent'
  | 'landing_anna_fallback_shown'
  | 'landing_anna_handoff_clicked';

export type PublicAnnaFunnelEventName = AnnaLpCtaEventName | LegacyPublicAnnaFunnelEventName;

export type PublicAnnaFunnelEventPayload = {
  // Always required (canonical)
  session_id: string;

  // Canonical CTA event contract (required for anna_lp.cta.*)
  cta_type?: AnnaLpCtaType;
  language?: AnnaLpLanguage;
  channel?: AnnaLpChannel;
  turn_id?: string;
  source_intent?: AnnaLpSourceIntent;

  // Legacy + compatibility fields (optional)
  sessionId?: string;
  locale?: string;
  source?: 'typed' | 'suggestion';
  messageLength?: number;
  historyLength?: number;
  fallbackReason?: string;
  target?: AnnaLpCtaType;
  voiceStatus?: 'idle' | 'connecting' | 'live' | 'error';
};

function sanitizeString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, maxLength);
}

function sanitizeInteger(value: unknown, max: number): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  const normalized = Math.max(0, Math.min(max, Math.round(Number(value))));
  return normalized;
}

export async function postPublicAnnaFunnelEvent(
  eventName: PublicAnnaFunnelEventName,
  payload: PublicAnnaFunnelEventPayload
): Promise<void> {
  const sessionId =
    sanitizeString(payload.session_id, 120) || sanitizeString(payload.sessionId, 120);
  if (!sessionId || typeof fetch !== 'function') return;

  await fetch('/api/public/anna/funnel-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      eventName,
      // Canonical contract keys (preferred)
      session_id: sessionId,
      cta_type: payload.cta_type,
      language: sanitizeString(payload.language, 20),
      channel: payload.channel,
      turn_id: sanitizeString(payload.turn_id, 120),
      source_intent: payload.source_intent,

      // Legacy keys (kept for continuity)
      sessionId,
      locale: sanitizeString(payload.locale, 20),
      source: payload.source,
      messageLength: sanitizeInteger(payload.messageLength, 2000),
      historyLength: sanitizeInteger(payload.historyLength, 8),
      fallbackReason: sanitizeString(payload.fallbackReason, 80),
      target: payload.target,
      voiceStatus: payload.voiceStatus,
    }),
  }).catch(() => {});
}
