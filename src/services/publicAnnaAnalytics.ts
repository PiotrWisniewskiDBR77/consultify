export type PublicAnnaFunnelEventName =
  | 'landing_anna_widget_opened'
  | 'landing_anna_message_sent'
  | 'landing_anna_fallback_shown'
  | 'landing_anna_handoff_clicked';

export type PublicAnnaFunnelEventPayload = {
  sessionId: string;
  locale?: string;
  source?: 'typed' | 'suggestion';
  messageLength?: number;
  historyLength?: number;
  fallbackReason?: string;
  target?: 'demo' | 'trial' | 'contact';
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
  const sessionId = sanitizeString(payload.sessionId, 120);
  if (!sessionId || typeof fetch !== 'function') return;

  await fetch('/api/public/anna/funnel-event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      eventName,
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
