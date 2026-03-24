/**
 * Webhook Relay Service — Zapier/Make integration layer.
 * Forwards table events (record CRUD) to external URLs with HMAC signing.
 */

import crypto from 'crypto';
import { getDatabase } from '../../database/Database.js';
import logger from '../../utils/Logger.js';

export interface WebhookRelay {
  id: string;
  base_id: string;
  name: string;
  target_url: string;
  secret: string | null;
  event_types: string[];
  is_active: boolean;
  last_triggered_at: string | null;
  trigger_count: number;
  created_by: string;
  created_at: string;
}

export type RelayEventType = 'record.created' | 'record.updated' | 'record.deleted';

const ALL_EVENT_TYPES: RelayEventType[] = ['record.created', 'record.updated', 'record.deleted'];

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

class WebhookRelayService {
  async createRelay(
    baseId: string,
    name: string,
    targetUrl: string,
    secret?: string,
    eventTypes?: string[],
    userId?: string
  ): Promise<WebhookRelay> {
    const db = getDatabase();
    const types = eventTypes?.length ? eventTypes : ALL_EVENT_TYPES;
    const result = await db.query(
      `INSERT INTO tp_webhook_relays (base_id, name, target_url, secret, event_types, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [baseId, name, targetUrl, secret ?? null, types, userId ?? 'system']
    );
    return result.rows[0] as WebhookRelay;
  }

  async listRelays(baseId: string): Promise<WebhookRelay[]> {
    const db = getDatabase();
    const result = await db.query(
      `SELECT * FROM tp_webhook_relays WHERE base_id = $1 ORDER BY created_at DESC`,
      [baseId]
    );
    return result.rows as WebhookRelay[];
  }

  async getRelay(relayId: string): Promise<WebhookRelay | null> {
    const db = getDatabase();
    const result = await db.query(
      `SELECT * FROM tp_webhook_relays WHERE id = $1`,
      [relayId]
    );
    return (result.rows[0] as WebhookRelay) ?? null;
  }

  async updateRelay(
    relayId: string,
    updates: Partial<Pick<WebhookRelay, 'name' | 'target_url' | 'secret' | 'event_types' | 'is_active'>>
  ): Promise<WebhookRelay | null> {
    const db = getDatabase();
    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (updates.name !== undefined) {
      sets.push(`name = $${idx++}`);
      params.push(updates.name);
    }
    if (updates.target_url !== undefined) {
      sets.push(`target_url = $${idx++}`);
      params.push(updates.target_url);
    }
    if (updates.secret !== undefined) {
      sets.push(`secret = $${idx++}`);
      params.push(updates.secret);
    }
    if (updates.event_types !== undefined) {
      sets.push(`event_types = $${idx++}`);
      params.push(updates.event_types);
    }
    if (updates.is_active !== undefined) {
      sets.push(`is_active = $${idx++}`);
      params.push(updates.is_active);
    }

    if (sets.length === 0) return this.getRelay(relayId);

    params.push(relayId);
    const result = await db.query(
      `UPDATE tp_webhook_relays SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );
    return (result.rows[0] as WebhookRelay) ?? null;
  }

  async deleteRelay(relayId: string): Promise<void> {
    const db = getDatabase();
    await db.query('DELETE FROM tp_webhook_relays WHERE id = $1', [relayId]);
  }

  async testRelay(relayId: string): Promise<{ success: boolean; statusCode?: number; error?: string }> {
    const relay = await this.getRelay(relayId);
    if (!relay) return { success: false, error: 'Relay not found' };

    const body = JSON.stringify({
      event: 'test',
      timestamp: new Date().toISOString(),
      baseId: relay.base_id,
      payload: { message: 'Test event from Consultify Table Platform' },
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Consultify-Event': 'test',
    };

    if (relay.secret) {
      headers['X-Consultify-Signature'] = signPayload(body, relay.secret);
    }

    try {
      const resp = await fetch(relay.target_url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });
      return { success: resp.ok, statusCode: resp.status };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async dispatchEvent(
    baseId: string,
    eventType: RelayEventType,
    payload: Record<string, unknown>
  ): Promise<void> {
    const db = getDatabase();

    let relays: WebhookRelay[];
    try {
      const result = await db.query(
        `SELECT * FROM tp_webhook_relays
         WHERE base_id = $1 AND is_active = true AND $2 = ANY(event_types)`,
        [baseId, eventType]
      );
      relays = result.rows as WebhookRelay[];
    } catch (err) {
      logger.error('[WebhookRelay] Failed to query relays', { baseId, error: (err as Error).message });
      return;
    }

    if (relays.length === 0) return;

    for (const relay of relays) {
      this.fireRelay(relay, eventType, baseId, payload).catch((err) => {
        logger.warn('[WebhookRelay] dispatch failed', { relayId: relay.id, error: (err as Error).message });
      });
    }
  }

  private async fireRelay(
    relay: WebhookRelay,
    eventType: string,
    baseId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const body = JSON.stringify({
      event: eventType,
      timestamp: new Date().toISOString(),
      baseId,
      payload,
    });

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Consultify-Event': eventType,
    };

    if (relay.secret) {
      headers['X-Consultify-Signature'] = signPayload(body, relay.secret);
    }

    try {
      await fetch(relay.target_url, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      logger.warn('[WebhookRelay] HTTP request failed', {
        relayId: relay.id,
        url: relay.target_url,
        error: (err as Error).message,
      });
    }

    const db = getDatabase();
    try {
      await db.query(
        `UPDATE tp_webhook_relays
         SET last_triggered_at = NOW(), trigger_count = COALESCE(trigger_count, 0) + 1
         WHERE id = $1`,
        [relay.id]
      );
    } catch (err) {
      logger.warn('[WebhookRelay] Failed to update trigger stats', {
        relayId: relay.id,
        error: (err as Error).message,
      });
    }
  }
}

export const webhookRelayService = new WebhookRelayService();
export default webhookRelayService;
