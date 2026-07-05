import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, run as dbRun } from '../utils/DbPromise.js';

export type IntegrationConnectionEventType =
  | 'connect_initiated'
  | 'configuration_submitted'
  | 'external_auth_prepared'
  | 'external_auth_callback_received'
  | 'disconnect_requested'
  | 'reauth_started'
  | 'error';

async function ensureIntegrationConnectionEventsTable(): Promise<void> {
  // Fail-soft: opportunistic idempotent DDL invoked first by the read path
  // (listIntegrationConnectionEvents). Use fallback:true so a transient DDL
  // failure can NEVER reject and bubble up as a bare HTTP 500 — the list read
  // degrades to empty instead. Only the DDL is fail-soft; the event INSERT below
  // keeps fallback:false so real write failures still surface.
  await dbRun(
    `
      CREATE TABLE IF NOT EXISTS integration_connection_events (
        id TEXT PRIMARY KEY,
        organization_id TEXT NOT NULL,
        user_id TEXT,
        integration_id TEXT NOT NULL,
        connector_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        metadata TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `,
    [],
    { fallback: true }
  );

  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_integration_connection_events_org_time
     ON integration_connection_events(organization_id, created_at DESC)`,
    [],
    { fallback: true }
  );
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_integration_connection_events_org_user
     ON integration_connection_events(organization_id, user_id)`,
    [],
    { fallback: true }
  );
  await dbRun(
    `CREATE INDEX IF NOT EXISTS idx_integration_connection_events_org_connector
     ON integration_connection_events(organization_id, connector_id)`,
    [],
    { fallback: true }
  );
}

export async function logIntegrationConnectionEvent(params: {
  organizationId: string;
  userId?: string | null;
  integrationId: string;
  connectorId: string;
  eventType: IntegrationConnectionEventType;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await ensureIntegrationConnectionEventsTable();

  const id = `ice-${uuidv4()}`;
  await dbRun(
    `
      INSERT INTO integration_connection_events (
        id, organization_id, user_id, integration_id, connector_id, event_type,
        metadata, ip_address, user_agent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      params.organizationId,
      params.userId ?? null,
      params.integrationId,
      params.connectorId,
      params.eventType,
      params.metadata ? JSON.stringify(params.metadata) : null,
      params.ipAddress ?? null,
      params.userAgent ?? null,
    ],
    { fallback: false }
  );
}

export async function listIntegrationConnectionEvents(params: {
  organizationId: string;
  limit?: number;
  offset?: number;
  userId?: string;
  connectorId?: string;
  integrationId?: string;
  eventType?: string;
}): Promise<{
  items: Array<{
    id: string;
    organizationId: string;
    userId: string | null;
    integrationId: string;
    connectorId: string;
    eventType: string;
    metadata: Record<string, unknown> | null;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
  }>;
  total: number;
}> {
  await ensureIntegrationConnectionEventsTable();

  const limit = Math.max(1, Math.min(Number(params.limit ?? 50), 200));
  const offset = Math.max(0, Number(params.offset ?? 0));

  const where: string[] = ['organization_id = ?'];
  const args: any[] = [params.organizationId];

  if (params.userId) {
    where.push('user_id = ?');
    args.push(params.userId);
  }
  if (params.connectorId) {
    where.push('connector_id = ?');
    args.push(params.connectorId);
  }
  if (params.integrationId) {
    where.push('integration_id = ?');
    args.push(params.integrationId);
  }
  if (params.eventType) {
    where.push('event_type = ?');
    args.push(params.eventType);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const totalRows =
    (await dbAll<{ count: number | string }>(
      `SELECT COUNT(*) as count FROM integration_connection_events ${whereSql}`,
      args,
      { fallback: true }
    )) || [];
  const total = Number(totalRows[0]?.count || 0);

  const rows =
    (await dbAll<{
      id: string;
      organization_id: string;
      user_id: string | null;
      integration_id: string;
      connector_id: string;
      event_type: string;
      metadata: string | null;
      ip_address: string | null;
      user_agent: string | null;
      created_at: string;
    }>(
      `
        SELECT
          id,
          organization_id,
          user_id,
          integration_id,
          connector_id,
          event_type,
          metadata,
          ip_address,
          user_agent,
          created_at
        FROM integration_connection_events
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `,
      [...args, limit, offset],
      { fallback: true }
    )) || [];

  return {
    total,
    items: rows.map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      userId: r.user_id ?? null,
      integrationId: r.integration_id,
      connectorId: r.connector_id,
      eventType: r.event_type,
      metadata: r.metadata ? safeJsonObject(r.metadata) : null,
      ipAddress: r.ip_address ?? null,
      userAgent: r.user_agent ?? null,
      createdAt: r.created_at,
    })),
  };
}

function safeJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    return null;
  } catch {
    return null;
  }
}
