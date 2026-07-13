/**
 * P02 §2.3.12 — Calendar Sync Runtime
 *
 * Background sync orchestrator: dispatches per-source sync loops through
 * provider adapters, manages checkpoints, maps errors → lifecycle states.
 */

import { run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';
import {
  type CalendarSource,
  createCalendarItem,
  type CreateCalendarItemParams,
  getCalendarItems,
  getCalendarSource,
  getCalendarSources,
  handleSyncError,
  type SyncCheckpoint,
  type SyncResult,
  updateCalendarItem,
} from './calendarInteropService.js';
import { getCalendarAdapter } from './calendarProviders/index.js';
import type { ConnectionRef, ProviderEvent } from './calendarProviders/types.js';

const LOG_PREFIX = '[P02-SyncRuntime]';

const SYNC_WINDOW_DAYS_BACK = 30;
const SYNC_WINDOW_DAYS_FORWARD = 90;
const BACKOFF_SKIP_MS = 5 * 60 * 1000;

/**
 * P02 §2.3.12 bridge — map a canonical calendar provider to the connector id
 * used by the shared integrationOAuthEngine token store (integration_oauth_tokens).
 * This lets a calendar the user connected through the Settings → Calendar Sync UI
 * (which stores an encrypted OAuth token under these connector ids) feed the v8
 * bidirectional sync runtime. Returns null for providers with no OAuth connector.
 */
const PROVIDER_TO_OAUTH_CONNECTOR: Partial<Record<CalendarSource['provider'], string>> = {
  google: 'google_calendar',
  microsoft: 'outlook_calendar',
};

/**
 * Main tick: sync all connected/degraded sources for an organization.
 * Called by cron every 5 minutes.
 */
export async function syncAllSources(organizationId?: string): Promise<void> {
  let sources: CalendarSource[];

  if (organizationId) {
    sources = await getCalendarSources(organizationId);
  } else {
    const { all: dbAll } = await import('../../utils/DbPromise.js');
    const rows = await dbAll<Record<string, unknown>>(
      `SELECT DISTINCT organization_id FROM v8_calendar_sources WHERE lifecycle_state IN ('connected', 'degraded')`,
      [],
      { fallback: true }
    );
    const orgIds = (rows || []).map((r) => r.organization_id as string);
    sources = [];
    for (const oid of orgIds) {
      const orgSources = await getCalendarSources(oid);
      sources.push(...orgSources);
    }
  }

  const syncableSources = sources.filter(
    (s) => s.lifecycleState === 'connected' || s.lifecycleState === 'degraded'
  );

  for (const source of syncableSources) {
    if (shouldSkipDueToBackoff(source)) {
      logger.info(`${LOG_PREFIX} Skipping source ${source.calendarSourceId} (backoff)`);
      continue;
    }

    try {
      await syncSource(source);
    } catch (err) {
      logger.error(
        `${LOG_PREFIX} Sync failed for source ${source.calendarSourceId}: ${(err as Error).message}`
      );
      try {
        await handleSyncError(source.calendarSourceId, source.organizationId, classifyError(err));
      } catch (innerErr) {
        logger.error(`${LOG_PREFIX} Failed to record sync error: ${(innerErr as Error).message}`);
      }
    }
  }
}

/**
 * Sync a single CalendarSource using its provider adapter.
 */
export async function syncSource(source: CalendarSource): Promise<SyncResult> {
  const adapter = getCalendarAdapter(source.provider);
  if (!adapter) {
    logger.warn(`${LOG_PREFIX} No adapter for provider ${source.provider}`);
    return {
      sourceId: source.calendarSourceId,
      syncType: 'incremental',
      itemsProcessed: 0,
      checkpoint: source.syncCheckpoint,
      errors: [`No adapter for provider: ${source.provider}`],
    };
  }

  const connection = await buildConnectionRef(source);
  const cursor = source.syncCheckpoint.cursor;

  const window = getDefaultSyncWindow();

  logger.info(
    `${LOG_PREFIX} Syncing source ${source.calendarSourceId} (${source.provider}, cursor=${cursor ? 'present' : 'none'})`
  );

  const result = await adapter.fetchEvents(connection, window, cursor);

  if (result.fullSyncRequired) {
    logger.info(`${LOG_PREFIX} Full resync required for source ${source.calendarSourceId}`);
    return performAdapterFullResync(source, adapter, connection, window);
  }

  let itemsProcessed = 0;

  for (const providerEvent of result.events) {
    try {
      await upsertCalendarItem(source, providerEvent);
      itemsProcessed++;
    } catch (err) {
      logger.error(
        `${LOG_PREFIX} Failed to upsert event ${providerEvent.providerEventId}: ${(err as Error).message}`
      );
    }
  }

  const now = new Date().toISOString();
  const updatedCheckpoint: SyncCheckpoint = {
    ...source.syncCheckpoint,
    cursor: result.nextCursor,
    lastIncrementalSyncAt: now,
  };

  await dbRun(
    `UPDATE v8_calendar_sources
       SET sync_checkpoint_json = ?,
           last_sync_at = ?,
           last_ok_at = ?,
           lifecycle_state = CASE WHEN lifecycle_state = 'degraded' THEN 'connected' ELSE lifecycle_state END,
           last_error = NULL,
           updated_at = ?
     WHERE calendar_source_id = ? AND organization_id = ?`,
    [
      JSON.stringify(updatedCheckpoint),
      now,
      now,
      now,
      source.calendarSourceId,
      source.organizationId,
    ]
  );

  logger.info(
    `${LOG_PREFIX} Incremental sync done: ${itemsProcessed} events for source ${source.calendarSourceId}`
  );

  return {
    sourceId: source.calendarSourceId,
    syncType: 'incremental',
    itemsProcessed,
    checkpoint: updatedCheckpoint,
    errors: [],
  };
}

async function performAdapterFullResync(
  source: CalendarSource,
  adapter: ReturnType<typeof getCalendarAdapter>,
  connection: ConnectionRef,
  window: { startAt: string; endAt: string }
): Promise<SyncResult> {
  if (!adapter) throw new Error('Adapter required for full resync');

  const result = await adapter.fetchEvents(connection, window, null);

  let itemsProcessed = 0;
  for (const providerEvent of result.events) {
    try {
      await upsertCalendarItem(source, providerEvent);
      itemsProcessed++;
    } catch (err) {
      logger.error(`${LOG_PREFIX} Failed to upsert during full resync: ${(err as Error).message}`);
    }
  }

  const now = new Date().toISOString();
  const resetCheckpoint: SyncCheckpoint = {
    cursor: result.nextCursor,
    rangeWatermark: window,
    lastFullSyncAt: now,
    lastIncrementalSyncAt: null,
    integrityGuards: [],
  };

  await dbRun(
    `UPDATE v8_calendar_sources
       SET sync_checkpoint_json = ?,
           last_sync_at = ?,
           last_ok_at = ?,
           lifecycle_state = 'connected',
           requires_action_reason = NULL,
           last_error = NULL,
           updated_at = ?
     WHERE calendar_source_id = ? AND organization_id = ?`,
    [JSON.stringify(resetCheckpoint), now, now, now, source.calendarSourceId, source.organizationId]
  );

  logger.info(
    `${LOG_PREFIX} Full resync done: ${itemsProcessed} events for source ${source.calendarSourceId}`
  );

  return {
    sourceId: source.calendarSourceId,
    syncType: 'full',
    itemsProcessed,
    checkpoint: resetCheckpoint,
    errors: [],
  };
}

async function upsertCalendarItem(source: CalendarSource, event: ProviderEvent): Promise<void> {
  const existing = await findExistingItem(source, event.providerEventId);

  const sourceSystem =
    source.provider === 'google'
      ? 'google_calendar'
      : source.provider === 'microsoft'
        ? 'outlook_calendar'
        : 'caldav';

  if (existing) {
    if (event.status === 'cancelled') {
      await updateCalendarItem(existing.calendarItemId, source.organizationId, {
        syncState: 'stale',
      });
      return;
    }

    if (existing.etag && event.etag && existing.etag !== event.etag) {
      if (existing.syncState === 'pending') {
        await updateCalendarItem(existing.calendarItemId, source.organizationId, {
          syncState: 'conflict',
        });
        return;
      }

      await updateCalendarItem(existing.calendarItemId, source.organizationId, {
        title: event.title,
        startAt: event.startAt,
        endAt: event.endAt,
        allDay: event.allDay,
        timezone: event.timezone,
        recurrenceModel: event.recurrence ?? null,
        syncState: 'in_sync',
      });
    }
    return;
  }

  if (event.status === 'cancelled') return;

  const editAuthority = deriveEditAuthority(source, event);
  const visibilityClass = source.permissionGradient === 'free_busy' ? 'free_busy_only' : 'details';

  const params: CreateCalendarItemParams = {
    organizationId: source.organizationId,
    sourceId: source.calendarSourceId,
    itemType: 'external_event',
    sourceSystem: sourceSystem as 'google_calendar' | 'outlook_calendar' | 'caldav',
    sourceObjectRef: event.providerEventId,
    title: visibilityClass === 'free_busy_only' ? null : event.title,
    startAt: event.startAt,
    endAt: event.endAt,
    allDay: event.allDay,
    timezone: event.timezone,
    visibilityClass,
    editAuthority,
    recurrenceModel: event.recurrence ?? null,
    syncState: 'in_sync',
  };

  await createCalendarItem(params);
}

function deriveEditAuthority(
  source: CalendarSource,
  event: ProviderEvent
): 'none' | 'local_only' | 'remote_owner' | 'delegate' {
  if (source.effectiveMode === 'read') return 'none';
  if (event.organizer?.self) return 'remote_owner';
  if (source.permissionGradient === 'delegate') return 'delegate';
  if (source.permissionGradient === 'write') return 'remote_owner';
  return 'none';
}

async function findExistingItem(source: CalendarSource, providerEventId: string) {
  const items = await getCalendarItems(source.organizationId, {
    sourceId: source.calendarSourceId,
  });
  return items.find((i) => i.sourceObjectRef === providerEventId) ?? null;
}

async function buildConnectionRef(source: CalendarSource): Promise<ConnectionRef> {
  let accessToken = '';

  if (source.connectionId) {
    try {
      const { get: dbGet } = await import('../../utils/DbPromise.js');
      const row = await dbGet<Record<string, unknown>>(
        `SELECT access_token, credentials, server_url FROM integrations WHERE id = ?`,
        [source.connectionId],
        { fallback: true }
      );
      if (row) {
        accessToken = (row.access_token as string) || '';
        if (!accessToken && row.credentials) {
          try {
            const creds =
              typeof row.credentials === 'string' ? JSON.parse(row.credentials) : row.credentials;
            accessToken =
              (creds as Record<string, string>).access_token ||
              (creds as Record<string, string>).password ||
              '';
          } catch {
            /* credentials not JSON */
          }
        }
        return {
          connectionId: source.connectionId,
          provider: source.provider,
          accessToken,
          accountRef: source.accountRef,
          selectedCalendars: source.selectedCalendars,
          serverUrl: (row.server_url as string) || undefined,
        };
      }
    } catch (err) {
      logger.warn(
        `${LOG_PREFIX} Failed to resolve token for connection ${source.connectionId}: ${(err as Error).message}`
      );
    }
  }

  if (!accessToken) {
    try {
      const { get: dbGet } = await import('../../utils/DbPromise.js');
      const v8Row = await dbGet<Record<string, unknown>>(
        `SELECT encrypted_credentials FROM v8_connection_credentials
         WHERE connector_id = ? AND organization_id = ?
         ORDER BY created_at DESC LIMIT 1`,
        [source.provider, source.organizationId || ''],
        { fallback: true }
      );
      if (v8Row?.encrypted_credentials) {
        try {
          const creds =
            typeof v8Row.encrypted_credentials === 'string'
              ? JSON.parse(v8Row.encrypted_credentials)
              : v8Row.encrypted_credentials;
          accessToken = (creds as Record<string, string>).access_token || '';
        } catch {
          /* not JSON */
        }
      }
    } catch {
      logger.debug(
        `${LOG_PREFIX} v8_connection_credentials fallback unavailable for ${source.provider}`
      );
    }
  }

  // Bridge: fall back to the shared OAuth token store (integration_oauth_tokens)
  // populated by the Settings → Calendar Sync connect flow. getValidAccessToken
  // transparently refreshes an expired token when a refresh_token is present.
  if (!accessToken && source.userId) {
    const connectorId = PROVIDER_TO_OAUTH_CONNECTOR[source.provider];
    if (connectorId) {
      try {
        const { getValidAccessToken } = await import('../integrationOAuthEngine.js');
        const oauthToken = await getValidAccessToken(source.userId, connectorId);
        if (oauthToken) {
          accessToken = oauthToken;
        }
      } catch (err) {
        logger.debug(
          `${LOG_PREFIX} integration_oauth_tokens bridge unavailable for ${source.provider}: ${(err as Error).message}`
        );
      }
    }
  }

  return {
    connectionId: source.connectionId ?? source.calendarSourceId,
    provider: source.provider,
    accessToken,
    accountRef: source.accountRef,
    selectedCalendars: source.selectedCalendars,
  };
}

function getDefaultSyncWindow(): { startAt: string; endAt: string } {
  const now = new Date();
  const start = new Date(now);
  start.setDate(start.getDate() - SYNC_WINDOW_DAYS_BACK);
  const end = new Date(now);
  end.setDate(end.getDate() + SYNC_WINDOW_DAYS_FORWARD);
  return {
    startAt: start.toISOString(),
    endAt: end.toISOString(),
  };
}

function shouldSkipDueToBackoff(source: CalendarSource): boolean {
  if (source.lifecycleState !== 'degraded' || !source.lastError) return false;
  const lastSync = source.lastSyncAt ? new Date(source.lastSyncAt).getTime() : 0;
  return Date.now() - lastSync < BACKOFF_SKIP_MS;
}

function classifyError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('auth'))
      return 'token_expired';
    if (msg.includes('403') || msg.includes('forbidden') || msg.includes('scope'))
      return 'insufficient_permissions';
    if (msg.includes('429') || msg.includes('rate') || msg.includes('throttl'))
      return 'rate_limited';
    if (
      msg.includes('410') ||
      msg.includes('gone') ||
      msg.includes('sync token') ||
      msg.includes('delta')
    )
      return 'sync_token_invalid';
    if (msg.includes('network') || msg.includes('ECONNREFUSED') || msg.includes('ETIMEDOUT'))
      return 'network_error';
    if (msg.includes('unavailable') || msg.includes('503')) return 'provider_unavailable';
  }
  return 'network_error';
}

/**
 * Handle webhook notification from a provider.
 * Triggers immediate incremental sync for the affected source.
 */
export async function handleWebhookNotification(
  provider: 'google' | 'microsoft',
  resourceId: string
): Promise<void> {
  const { all: dbAll } = await import('../../utils/DbPromise.js');
  const rows = await dbAll<Record<string, unknown>>(
    `SELECT * FROM v8_calendar_sources WHERE provider = ? AND lifecycle_state IN ('connected', 'degraded')`,
    [provider],
    { fallback: true }
  );

  if (!rows || rows.length === 0) {
    logger.info(`${LOG_PREFIX} Webhook for ${provider}/${resourceId}: no matching sources`);
    return;
  }

  for (const row of rows) {
    const sourceId = row.calendar_source_id as string;
    const orgId = row.organization_id as string;
    const source = await getCalendarSource(sourceId, orgId);
    if (source) {
      try {
        await syncSource(source);
      } catch (err) {
        logger.error(
          `${LOG_PREFIX} Webhook-triggered sync failed for source ${sourceId}: ${(err as Error).message}`
        );
      }
    }
  }
}
