/**
 * Outbound Webhooks Dispatcher (Airtable-style)
 * Manages webhook lifecycle, stores payloads, and sends pings with HMAC signing.
 */

import crypto from 'crypto';

import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';
import { decryptSecret, encryptSecret } from '../../utils/secretEncryption.js';

export interface WebhookEvent {
  source: 'client' | 'publicApi' | 'formSubmission' | 'automation';
  sourceMetadata?: { userId?: string };
  actionType: string;
  tableId: string;
  recordId?: string;
  fieldId?: string;
  oldCellValues?: Record<string, unknown>;
  newCellValues?: Record<string, unknown>;
}

export class WebhookDispatcherService {
  private transactionCounter = new Map<string, number>();

  async createWebhook(
    baseId: string,
    notificationUrl: string,
    specification: unknown,
    createdBy?: string
  ): Promise<{
    id: string;
    macSecret: string;
    expirationTime: string;
    cursorForNextPayload: number;
  }> {
    const db = getDatabase();
    const hmacSecret = crypto.randomBytes(32).toString('hex');
    const result = await db.query(
      `INSERT INTO tp_webhooks (base_id, notification_url, specification, hmac_secret, created_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        baseId,
        notificationUrl,
        JSON.stringify(specification),
        encryptSecret(hmacSecret),
        createdBy ?? null,
      ]
    );
    const webhook = result.rows[0] as Record<string, unknown>;
    return {
      id: webhook.id as string,
      macSecret: hmacSecret,
      expirationTime: webhook.expires_at as string,
      cursorForNextPayload: 1,
    };
  }

  async listWebhooks(baseId: string): Promise<unknown[]> {
    const db = getDatabase();
    const result = await db.query(
      `SELECT id, base_id, notification_url, specification, is_active, expires_at, created_at
       FROM tp_webhooks WHERE base_id = $1 ORDER BY created_at DESC`,
      [baseId]
    );
    return result.rows;
  }

  async deleteWebhook(webhookId: string): Promise<void> {
    const db = getDatabase();
    await db.query('DELETE FROM tp_webhooks WHERE id = $1', [webhookId]);
  }

  async refreshWebhook(webhookId: string): Promise<{ expiresAt: string }> {
    const db = getDatabase();
    const result = await db.query(
      `UPDATE tp_webhooks SET expires_at = NOW() + INTERVAL '7 days' WHERE id = $1 RETURNING expires_at`,
      [webhookId]
    );
    return { expiresAt: (result.rows[0] as Record<string, unknown>)?.expires_at as string };
  }

  async listPayloads(
    webhookId: string,
    cursor?: number,
    limit = 50
  ): Promise<{
    payloads: Array<{
      timestamp: string;
      baseTransactionNumber: number;
      actionMetadata: unknown;
    }>;
    cursor: number;
    mightHaveMore: boolean;
  }> {
    const db = getDatabase();
    const startCursor = cursor || 1;
    const result = await db.query(
      `SELECT * FROM tp_webhook_payloads
       WHERE webhook_id = $1 AND cursor_number >= $2
       ORDER BY cursor_number ASC LIMIT $3`,
      [webhookId, startCursor, limit + 1]
    );

    const hasMore = result.rows.length > limit;
    const payloads = result.rows.slice(0, limit) as Array<Record<string, unknown>>;
    const lastCursor =
      payloads.length > 0 ? (payloads[payloads.length - 1].cursor_number as number) : startCursor;

    this.refreshWebhook(webhookId).catch((err) => {
      logger.warn('[WebhookDispatcher] refresh on payload access failed', {
        webhookId,
        error: (err as Error).message,
      });
    });

    return {
      payloads: payloads.map((p) => ({
        timestamp: p.timestamp as string,
        baseTransactionNumber: p.base_transaction_number as number,
        actionMetadata: p.action_metadata,
      })),
      cursor: lastCursor + 1,
      mightHaveMore: hasMore,
    };
  }

  async dispatchEvent(baseId: string, event: WebhookEvent): Promise<void> {
    const db = getDatabase();
    const webhooks = await db.query(
      `SELECT * FROM tp_webhooks WHERE base_id = $1 AND is_active = true AND expires_at > NOW()`,
      [baseId]
    );

    if (webhooks.rows.length === 0) return;

    const txNum = (this.transactionCounter.get(baseId) || 0) + 1;
    this.transactionCounter.set(baseId, txNum);

    for (const row of webhooks.rows) {
      const webhook = row as Record<string, unknown>;

      if (!this.matchesFilter(event, webhook.specification)) continue;

      const cursorNum = (webhook.cursor_number as number) + 1;
      await db.query(
        `INSERT INTO tp_webhook_payloads (webhook_id, cursor_number, base_transaction_number, action_metadata)
         VALUES ($1, $2, $3, $4)`,
        [
          webhook.id,
          cursorNum,
          txNum,
          JSON.stringify({
            source: event.source,
            sourceMetadata: event.sourceMetadata,
            actionType: event.actionType,
            tableId: event.tableId,
            recordId: event.recordId,
            fieldId: event.fieldId,
            oldCellValues: event.oldCellValues,
            newCellValues: event.newCellValues,
          }),
        ]
      );

      await db.query('UPDATE tp_webhooks SET cursor_number = $2 WHERE id = $1', [
        webhook.id,
        cursorNum,
      ]);

      this.sendPing(webhook).catch((err) => {
        logger.error(`[WebhookDispatcher] Ping failed for ${webhook.id}:`, err.message);
      });
    }
  }

  private async sendPing(webhook: Record<string, unknown>): Promise<void> {
    const body = JSON.stringify({
      base: { id: webhook.base_id },
      webhook: { id: webhook.id },
      timestamp: new Date().toISOString(),
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (webhook.hmac_secret) {
      const secret = decryptSecret(webhook.hmac_secret as string);
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(body);
      headers['X-Airtable-Content-MAC'] = `hmac-sha256=${hmac.digest('hex')}`;
    }

    await fetch(webhook.notification_url as string, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(10_000),
    });
  }

  private matchesFilter(event: WebhookEvent, specification: unknown): boolean {
    const spec = specification as Record<string, unknown> | null;
    const filters = (spec?.options as Record<string, unknown> | undefined)?.filters as
      | Record<string, unknown>
      | undefined;
    if (!filters || Object.keys(filters).length === 0) return true;

    if (Array.isArray(filters.dataTypes) && !filters.dataTypes.includes(event.actionType)) {
      return false;
    }

    if (Array.isArray(filters.sourceTypes) && !filters.sourceTypes.includes(event.source)) {
      return false;
    }

    const recordChangeScope = filters.recordChangeScope as Record<string, unknown> | undefined;
    if (
      Array.isArray(recordChangeScope?.tableIds) &&
      !recordChangeScope!.tableIds.includes(event.tableId)
    ) {
      return false;
    }

    return true;
  }
}

export const webhookDispatcher = new WebhookDispatcherService();
