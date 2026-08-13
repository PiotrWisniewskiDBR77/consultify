import { all as dbAll } from '../utils/DbPromise.js';
import { recordConversionEvent } from './demoTrialTelemetryService.js';

export const PUBLIC_ANNA_FUNNEL_EVENT_NAMES = [
  'landing_anna_widget_opened',
  'landing_anna_message_sent',
  'landing_anna_fallback_shown',
  'landing_anna_handoff_clicked',
] as const;

export type LegacyPublicAnnaFunnelEventName = (typeof PUBLIC_ANNA_FUNNEL_EVENT_NAMES)[number];

export const ANNA_LP_CTA_VERBS = [
  'impression',
  'click',
  'start',
  'submit_attempt',
  'submit_success',
  'submit_error',
  'retry',
  'fallback_used',
] as const;

export type AnnaLpCtaVerb = (typeof ANNA_LP_CTA_VERBS)[number];
export type AnnaLpCtaEventName = `anna_lp.cta.${AnnaLpCtaVerb}`;

export type PublicAnnaFunnelEventName = LegacyPublicAnnaFunnelEventName | AnnaLpCtaEventName;

type PublicAnnaFunnelMetadata = {
  // Canonical (contract)
  session_id?: string | null;
  cta_type?: 'demo' | 'trial' | 'contact' | null;
  language?: 'pl' | 'en' | 'es' | 'de' | 'ja' | 'ar' | null;
  channel?: 'text' | 'voice' | null;
  turn_id?: string | null;
  source_intent?:
    | 'learn'
    | 'evaluate_fit'
    | 'pricing'
    | 'security_compliance'
    | 'get_started'
    | 'talk_to_human'
    | 'unknown'
    | null;

  // Legacy + compatibility
  sessionId?: string | null;
  locale?: string | null;
  source?: 'typed' | 'suggestion' | null;
  messageLength?: number | null;
  historyLength?: number | null;
  fallbackReason?: string | null;
  target?: 'demo' | 'trial' | 'contact' | null;
  voiceStatus?: 'idle' | 'connecting' | 'live' | 'error' | null;
};

export async function recordPublicAnnaFunnelEvent(args: {
  eventName: PublicAnnaFunnelEventName;
  metadata: PublicAnnaFunnelMetadata;
}): Promise<void> {
  const sessionId =
    String(args.metadata.session_id || '').trim() || String(args.metadata.sessionId || '').trim();

  await recordConversionEvent({
    eventType: args.eventName,
    source: 'landing_anna',
    metadata: {
      canonical_event: args.eventName,
      session_id: sessionId || null,
      sessionId: sessionId || null,
      cta_type: args.metadata.cta_type || args.metadata.target || null,
      language: args.metadata.language || args.metadata.locale || null,
      channel: args.metadata.channel || null,
      turn_id: args.metadata.turn_id || null,
      source_intent: args.metadata.source_intent || null,
      locale: args.metadata.locale || args.metadata.language || null,
      sourceDetail: args.metadata.source || null,
      messageLength: args.metadata.messageLength ?? null,
      historyLength: args.metadata.historyLength ?? null,
      fallbackReason: args.metadata.fallbackReason || null,
      target: args.metadata.target || args.metadata.cta_type || null,
      voiceStatus: args.metadata.voiceStatus || null,
    },
  });
}

type AnnaFunnelRecentEvent = {
  id: string;
  eventType: string;
  source: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export async function getPublicAnnaFunnelSummary(days = 30): Promise<{
  summary: {
    totalEvents: number;
    byEvent: Record<string, number>;
    localeDistribution: Record<string, number>;
    fallbackReasons: Record<string, number>;
    handoffTargets: Record<string, number>;
  };
  recentEvents: AnnaFunnelRecentEvent[];
}> {
  let rows: Array<{
    id: string;
    event_type: string;
    source: string;
    metadata: string | null;
    created_at: string;
  }> = [];

  try {
    rows = (await dbAll(
      `SELECT id, event_type, source, metadata, created_at
       FROM conversion_events
       WHERE source = ? AND created_at > NOW() - make_interval(days => ?)
       ORDER BY created_at DESC
       LIMIT 500`,
      ['landing_anna', days]
    )) as typeof rows;
  } catch {
    rows = [];
  }

  const byEvent: Record<string, number> = {};
  const localeDistribution: Record<string, number> = {};
  const fallbackReasons: Record<string, number> = {};
  const handoffTargets: Record<string, number> = {};

  const recentEvents = (rows || []).map((row) => {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : {};
    } catch {
      metadata = {};
    }

    const eventType = String(row.event_type || '');
    byEvent[eventType] = (byEvent[eventType] || 0) + 1;

    const locale =
      (typeof metadata.language === 'string' && metadata.language.trim()
        ? metadata.language.trim()
        : typeof metadata.locale === 'string' && metadata.locale.trim()
          ? metadata.locale.trim()
          : null) || null;
    if (locale) {
      localeDistribution[locale] = (localeDistribution[locale] || 0) + 1;
    }

    const fallbackReason =
      typeof metadata.fallbackReason === 'string' && metadata.fallbackReason.trim()
        ? metadata.fallbackReason.trim()
        : null;
    if (fallbackReason) {
      fallbackReasons[fallbackReason] = (fallbackReasons[fallbackReason] || 0) + 1;
    }

    const handoffTarget =
      (typeof metadata.cta_type === 'string' && metadata.cta_type.trim()
        ? metadata.cta_type.trim()
        : typeof metadata.target === 'string' && metadata.target.trim()
          ? metadata.target.trim()
          : null) || null;
    if (handoffTarget) {
      handoffTargets[handoffTarget] = (handoffTargets[handoffTarget] || 0) + 1;
    }

    return {
      id: String(row.id || ''),
      eventType,
      source: String(row.source || 'landing_anna'),
      metadata,
      createdAt: String(row.created_at || ''),
    };
  });

  return {
    summary: {
      totalEvents: recentEvents.length,
      byEvent,
      localeDistribution,
      fallbackReasons,
      handoffTargets,
    },
    recentEvents: recentEvents.slice(0, 50),
  };
}
