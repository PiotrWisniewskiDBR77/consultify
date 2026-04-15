import { v4 as uuidv4 } from 'uuid';

import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export const DEMO_TRIAL_EVENT_TYPES = {
  DEMO_STARTED: 'demo_started',
  DEMO_MODE_ENABLED: 'demo_mode_enabled',
  DEMO_MODE_DISABLED: 'demo_mode_disabled',
  DEMO_AI_LIMIT_REACHED: 'demo_ai_limit_reached',
  TRIAL_STARTED: 'trial_started',
  TRIAL_EXPIRY_WARNING_SHOWN: 'trial_expiry_warning_shown',
  TRIAL_CONVERTED_TO_PAID: 'trial_converted_to_paid',
} as const;

export type DemoTrialEventType =
  (typeof DEMO_TRIAL_EVENT_TYPES)[keyof typeof DEMO_TRIAL_EVENT_TYPES];

interface RecordDemoTrialEventInput {
  eventType: DemoTrialEventType;
  organizationId?: string | null;
  userId?: string | null;
  source?: string | null;
  language?: string | null;
  metadata?: Record<string, unknown>;
}

interface RecordConversionEventInput {
  eventType: string;
  organizationId?: string | null;
  userId?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown>;
}

function mapToFunnelEventType(
  eventType: DemoTrialEventType,
  metadata?: Record<string, unknown>
): string | null {
  const experienceType = String(metadata?.experienceType || '')
    .trim()
    .toLowerCase();

  if (experienceType === 'workspace_demo') {
    if (eventType === DEMO_TRIAL_EVENT_TYPES.DEMO_STARTED) {
      return 'WORKSPACE_DEMO_STARTED';
    }
    if (eventType === DEMO_TRIAL_EVENT_TYPES.DEMO_MODE_ENABLED) {
      return 'WORKSPACE_DEMO_ENABLED';
    }
    if (eventType === DEMO_TRIAL_EVENT_TYPES.DEMO_MODE_DISABLED) {
      return 'WORKSPACE_DEMO_DISABLED';
    }
  }

  if (
    eventType === DEMO_TRIAL_EVENT_TYPES.DEMO_STARTED ||
    eventType === DEMO_TRIAL_EVENT_TYPES.DEMO_MODE_ENABLED
  ) {
    return 'DEMO';
  }
  if (eventType === DEMO_TRIAL_EVENT_TYPES.TRIAL_STARTED) {
    return 'TRIAL_START';
  }
  if (eventType === DEMO_TRIAL_EVENT_TYPES.TRIAL_CONVERTED_TO_PAID) {
    return 'PAID';
  }
  return null;
}

let tableEnsured = false;

async function ensureConversionEventsTable(): Promise<void> {
  if (tableEnsured) return;

  await DbPromise.run(
    `
      CREATE TABLE IF NOT EXISTS conversion_events (
        id TEXT PRIMARY KEY,
        organization_id TEXT,
        user_id TEXT,
        event_type TEXT NOT NULL,
        source TEXT DEFAULT 'direct',
        utm_campaign TEXT,
        utm_source TEXT,
        utm_medium TEXT,
        referrer_url TEXT,
        partner_id TEXT,
        metadata TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `,
    [],
    { fallback: true }
  );

  tableEnsured = true;
}

export async function recordConversionEvent(input: RecordConversionEventInput): Promise<void> {
  try {
    await ensureConversionEventsTable();

    await DbPromise.run(
      `INSERT INTO conversion_events (id, organization_id, user_id, event_type, source, metadata, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        uuidv4(),
        input.organizationId || null,
        input.userId || null,
        String(input.eventType || '').trim(),
        input.source || 'direct',
        JSON.stringify(input.metadata || {}),
      ],
      { fallback: true }
    );
  } catch (error) {
    logger.warn('[ConversionTelemetry] Failed to record event', {
      eventType: input.eventType,
      error: (error as Error)?.message || String(error),
    });
  }
}

export async function recordDemoTrialEvent(input: RecordDemoTrialEventInput): Promise<void> {
  const funnelEventType = mapToFunnelEventType(input.eventType, input.metadata) || input.eventType;
  return recordConversionEvent({
    eventType: funnelEventType,
    organizationId: input.organizationId,
    userId: input.userId,
    source: input.source,
    metadata: {
      canonical_event: input.eventType,
      language: input.language || null,
      ...(input.metadata || {}),
    },
  });
}
