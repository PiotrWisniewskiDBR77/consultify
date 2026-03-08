import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

export type CommunicationEventType =
  | 'decision_required'
  | 'gate_pending'
  | 'task_due'
  | 'risk_alert'
  | 'blocker_detected';

type CommunicationProvider = 'slack' | 'teams';

type ProjectChannelMapping = {
  projectId: string | null;
  channelId: string;
  channelLabel?: string | null;
  webhookUrl?: string | null;
  enabled?: boolean;
};

type CommunicationIntegrationRow = {
  integration_id: string;
  provider_name?: string | null;
  settings?: string | null;
};

type CommunicationIntegrationConfig = {
  webhookUrl?: string | null;
  projectChannelMappings?: ProjectChannelMapping[];
  defaultChannelId?: string | null;
};

export type CommunicationDeliveryResult = {
  integrationId: string;
  provider: CommunicationProvider;
  channelId: string | null;
  eventType: CommunicationEventType;
  success: boolean;
  skipped?: boolean;
  error?: string | null;
};

function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function extractWebhookUrl(cfg: Record<string, unknown>): string | null {
  const candidates = [
    (cfg as any).webhookUrl,
    (cfg as any).webhook_url,
    (cfg as any).incomingWebhookUrl,
    (cfg as any).incoming_webhook_url,
    (cfg as any)?.webhook?.url,
    (cfg as any)?.incoming_webhook?.url,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return null;
}

function normalizeMappings(raw: unknown): ProjectChannelMapping[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const obj = item as Record<string, unknown>;
        const projectIdRaw = obj.projectId ?? obj.project_id ?? obj.project ?? null;
        const channelIdRaw = obj.channelId ?? obj.channel_id ?? obj.channel ?? null;
        const webhookUrlRaw = obj.webhookUrl ?? obj.webhook_url ?? obj.incomingWebhookUrl ?? null;
        if (!channelIdRaw || typeof channelIdRaw !== 'string') return null;
        return {
          projectId:
            typeof projectIdRaw === 'string' && projectIdRaw.trim() ? projectIdRaw.trim() : null,
          channelId: channelIdRaw.trim(),
          channelLabel:
            typeof obj.channelLabel === 'string'
              ? obj.channelLabel
              : typeof obj.channel_label === 'string'
                ? obj.channel_label
                : null,
          webhookUrl:
            typeof webhookUrlRaw === 'string' && webhookUrlRaw.trim() ? webhookUrlRaw.trim() : null,
          enabled:
            typeof obj.enabled === 'boolean'
              ? obj.enabled
              : typeof obj.isActive === 'boolean'
                ? obj.isActive
                : true,
        };
      })
      .filter(Boolean) as ProjectChannelMapping[];
  }

  if (raw && typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .map(([projectId, value]) => {
        if (typeof value === 'string' && value.trim()) {
          return {
            projectId: projectId === '*' ? null : projectId,
            channelId: value.trim(),
            enabled: true,
          };
        }
        if (value && typeof value === 'object') {
          const obj = value as Record<string, unknown>;
          const channelId = obj.channelId ?? obj.channel_id ?? obj.channel;
          if (!channelId || typeof channelId !== 'string' || !channelId.trim()) return null;
          const webhookUrl = obj.webhookUrl ?? obj.webhook_url ?? obj.incomingWebhookUrl;
          return {
            projectId: projectId === '*' ? null : projectId,
            channelId: channelId.trim(),
            channelLabel:
              typeof obj.channelLabel === 'string'
                ? obj.channelLabel
                : typeof obj.channel_label === 'string'
                  ? obj.channel_label
                  : null,
            webhookUrl:
              typeof webhookUrl === 'string' && webhookUrl.trim() ? webhookUrl.trim() : null,
            enabled: typeof obj.enabled === 'boolean' ? obj.enabled : true,
          };
        }
        return null;
      })
      .filter(Boolean) as ProjectChannelMapping[];
  }

  return [];
}

function parseCommunicationConfig(raw: unknown): CommunicationIntegrationConfig {
  const cfg = parseJsonObject(raw);
  const projectChannelMappings = normalizeMappings(
    (cfg as any).projectChannelMappings ?? (cfg as any).project_channel_mappings ?? {}
  );
  const defaultChannelIdRaw =
    (cfg as any).defaultChannelId ?? (cfg as any).default_channel_id ?? (cfg as any).channelId;

  return {
    webhookUrl: extractWebhookUrl(cfg),
    projectChannelMappings,
    defaultChannelId:
      typeof defaultChannelIdRaw === 'string' && defaultChannelIdRaw.trim()
        ? defaultChannelIdRaw.trim()
        : null,
  };
}

function resolveProvider(providerName?: string | null): CommunicationProvider | null {
  const key = String(providerName || '')
    .trim()
    .toLowerCase();
  if (key === 'slack') return 'slack';
  if (key === 'microsoft_teams' || key === 'teams') return 'teams';
  return null;
}

function resolveProjectChannelMapping(
  cfg: CommunicationIntegrationConfig,
  projectId?: string | null
): ProjectChannelMapping | null {
  const mappings = (cfg.projectChannelMappings || []).filter((item) => item.enabled !== false);
  if (projectId) {
    const exact = mappings.find((item) => item.projectId === projectId);
    if (exact) return exact;
  }
  return mappings.find((item) => !item.projectId) || null;
}

async function postSlackWebhook(input: {
  webhookUrl: string;
  channelId?: string | null;
  title: string;
  body: string;
  deepLink?: string | null;
  severity?: 'low' | 'normal' | 'high' | 'critical';
}): Promise<void> {
  const response = await fetch(input.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `${input.title}\n${input.body}${input.deepLink ? `\n${input.deepLink}` : ''}`,
      channel: input.channelId || undefined,
      blocks: [
        {
          type: 'header',
          text: { type: 'plain_text', text: input.title, emoji: true },
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `${input.body}${input.deepLink ? `\n<${input.deepLink}|Open in Consultify>` : ''}`,
          },
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Event: ${input.severity || 'normal'}${input.channelId ? ` · Channel: ${input.channelId}` : ''}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed (HTTP ${response.status})`);
  }
}

async function postTeamsWebhook(input: {
  webhookUrl: string;
  channelId?: string | null;
  title: string;
  body: string;
  deepLink?: string | null;
}): Promise<void> {
  const response = await fetch(input.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: input.title,
      text: `${input.body}${input.deepLink ? `\n\nOpen: ${input.deepLink}` : ''}${
        input.channelId ? `\n\nChannel: ${input.channelId}` : ''
      }`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Teams webhook failed (HTTP ${response.status})`);
  }
}

async function logCommunicationEvent(input: {
  integrationId: string;
  eventType: CommunicationEventType;
  direction?: 'read_only' | 'bidirectional';
  status: 'success' | 'partial' | 'failed';
  errorSummary?: string | null;
  errorDetails?: unknown;
  channelId?: string | null;
}): Promise<void> {
  try {
    const cols = await dbAll<{ name: string }>('PRAGMA table_info(integration_sync_log)', []);
    const names = new Set((cols || []).map((c) => String(c.name || '')));
    if (!names.size) return;

    const now = new Date().toISOString();
    const details =
      input.errorDetails == null
        ? { eventType: input.eventType, channelId: input.channelId || null }
        : {
            eventType: input.eventType,
            channelId: input.channelId || null,
            error: input.errorDetails,
          };

    if (names.has('items_processed')) {
      await dbRun(
        `INSERT INTO integration_sync_log (
           id, integration_id, sync_type, direction, trigger_type,
           status, items_processed, items_created, items_updated, items_failed,
           error_summary, error_details, started_at, completed_at, duration_ms
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `log-${uuidv4()}`,
          input.integrationId,
          input.eventType,
          input.direction || 'read_only',
          'event',
          input.status,
          1,
          0,
          1,
          input.status === 'success' ? 0 : 1,
          input.errorSummary || null,
          JSON.stringify(details),
          now,
          now,
          0,
        ]
      );
      return;
    }

    await dbRun(
      `INSERT INTO integration_sync_log (
         id, integration_id, sync_type, direction, status, items_synced, items_failed, error_details,
         started_at, completed_at, duration_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `log-${uuidv4()}`,
        input.integrationId,
        input.eventType,
        input.direction || 'read_only',
        input.status,
        input.status === 'success' ? 1 : 0,
        input.status === 'success' ? 0 : 1,
        JSON.stringify(details),
        now,
        now,
        0,
      ]
    );
  } catch (err: any) {
    logger.warn('[CommunicationSync] Failed to write sync log', { error: err?.message });
  }
}

async function getCommunicationIntegrations(
  organizationId: string
): Promise<CommunicationIntegrationRow[]> {
  return (await dbAll<CommunicationIntegrationRow>(
    `
      SELECT i.id as integration_id, i.settings, p.name as provider_name
      FROM integrations i
      LEFT JOIN integration_providers p ON p.id = i.provider_id
      WHERE i.organization_id = ?
        AND (i.status IS NULL OR i.status IN ('active','connected'))
        AND (p.name IN ('slack', 'microsoft_teams', 'teams') OR i.provider_id IN ('slack', 'microsoft_teams', 'teams'))
    `,
    [organizationId]
  ).catch(() => [])) as CommunicationIntegrationRow[];
}

export async function dispatchProjectCommunicationEvent(input: {
  organizationId: string;
  projectId?: string | null;
  eventType: CommunicationEventType;
  title: string;
  body: string;
  deepLink?: string | null;
  severity?: 'low' | 'normal' | 'high' | 'critical';
}): Promise<CommunicationDeliveryResult[]> {
  const integrations = await getCommunicationIntegrations(input.organizationId);
  const deliveries: CommunicationDeliveryResult[] = [];

  for (const row of integrations || []) {
    const provider = resolveProvider(row.provider_name);
    if (!provider) continue;

    const cfg = parseCommunicationConfig(row.settings || null);
    const mapping = resolveProjectChannelMapping(cfg, input.projectId);
    const webhookUrl = mapping?.webhookUrl || cfg.webhookUrl || null;
    const channelId = mapping?.channelId || cfg.defaultChannelId || null;

    if (!webhookUrl) {
      const result: CommunicationDeliveryResult = {
        integrationId: row.integration_id,
        provider,
        channelId,
        eventType: input.eventType,
        success: false,
        skipped: true,
        error: 'Missing webhookUrl',
      };
      deliveries.push(result);
      await logCommunicationEvent({
        integrationId: row.integration_id,
        eventType: input.eventType,
        status: 'failed',
        errorSummary: 'missing_webhook_url',
        errorDetails: result.error,
        channelId,
      });
      continue;
    }

    try {
      if (provider === 'slack') {
        await postSlackWebhook({
          webhookUrl,
          channelId,
          title: input.title,
          body: input.body,
          deepLink: input.deepLink,
          severity: input.severity,
        });
      } else {
        await postTeamsWebhook({
          webhookUrl,
          channelId,
          title: input.title,
          body: input.body,
          deepLink: input.deepLink,
        });
      }

      const result: CommunicationDeliveryResult = {
        integrationId: row.integration_id,
        provider,
        channelId,
        eventType: input.eventType,
        success: true,
      };
      deliveries.push(result);
      await logCommunicationEvent({
        integrationId: row.integration_id,
        eventType: input.eventType,
        status: 'success',
        channelId,
      });
    } catch (err: any) {
      const message = String(err?.message || 'Communication dispatch failed');
      logger.warn('[CommunicationSync] Delivery failed', {
        integrationId: row.integration_id,
        provider,
        projectId: input.projectId,
        eventType: input.eventType,
        error: message,
      });
      deliveries.push({
        integrationId: row.integration_id,
        provider,
        channelId,
        eventType: input.eventType,
        success: false,
        error: message,
      });
      await logCommunicationEvent({
        integrationId: row.integration_id,
        eventType: input.eventType,
        status: 'partial',
        errorSummary: 'delivery_failed',
        errorDetails: message,
        channelId,
      });
    }
  }

  return deliveries;
}
