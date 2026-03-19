/**
 * Webhook Connector — receives push-based data via HTTP webhooks.
 * Payloads are buffered in tp_webhook_buffer and consumed during sync runs.
 */

import { timingSafeEqual } from 'crypto';
import type {
  IConnector,
  ExternalSchema,
  ExternalRecord,
} from '../connectorFramework.js';
import { getDatabase } from '../../../database/Database.js';
import logger from '../../../utils/Logger.js';

const MAX_BUFFER_FETCH = 5_000;

export function validateWebhookSecret(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const webhookConnector: IConnector = {
  type: 'webhook',

  async testConnection(
    _config: Record<string, unknown>
  ): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  },

  async fetchSchema(config: Record<string, unknown>): Promise<ExternalSchema> {
    const schema = config.schema as ExternalSchema | undefined;
    if (schema?.tables?.length) return schema;

    const db = getDatabase();
    const connectorId = config._connectorId as string | undefined;
    if (connectorId) {
      const result = await db.query<{ payload: Record<string, unknown> }>(
        `SELECT payload FROM tp_webhook_buffer
         WHERE connector_id = $1 AND processed_at IS NULL
         ORDER BY received_at ASC LIMIT 1`,
        [connectorId]
      );
      if (result.rows[0]) {
        const payload = result.rows[0].payload as Record<string, unknown>;
        const fields = Object.entries(payload).map(([key, value]) => ({
          name: key,
          externalType: typeof value === 'number' ? 'number' : 'string',
          inferredType: typeof value === 'number' ? 'number' : 'singleLineText',
          sample: value,
        }));
        return { tables: [{ name: 'Webhook', fields }] };
      }
    }

    return { tables: [{ name: 'Webhook', fields: [] }] };
  },

  async fetchRecords(config: Record<string, unknown>): Promise<ExternalRecord[]> {
    const connectorId = config._connectorId as string | undefined;
    if (!connectorId) {
      logger.warn('[WebhookConnector] fetchRecords called without _connectorId');
      return [];
    }

    const db = getDatabase();
    const result = await db.query<{ id: string; payload: Record<string, unknown> }>(
      `SELECT id, payload FROM tp_webhook_buffer
       WHERE connector_id = $1 AND processed_at IS NULL
       ORDER BY received_at ASC
       LIMIT $2`,
      [connectorId, MAX_BUFFER_FETCH]
    );

    if (result.rows.length === 0) return [];

    const records: ExternalRecord[] = [];
    const processedIds: string[] = [];

    for (const row of result.rows) {
      const payload = row.payload as Record<string, unknown>;
      records.push({
        externalId: row.id as string,
        data: payload,
      });
      processedIds.push(row.id as string);
    }

    if (processedIds.length > 0) {
      await db.query(
        `UPDATE tp_webhook_buffer SET processed_at = NOW()
         WHERE id = ANY($1::uuid[])`,
        [processedIds]
      );
    }

    return records;
  },
};

export default webhookConnector;
