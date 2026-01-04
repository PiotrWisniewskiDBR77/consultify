/**
 * Webhook Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Trigger webhooks for various events with full CRUD and delivery management
 */

import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface WebhookFilters {
    enabled?: boolean;
}

export interface WebhookDeliveryFilters {
    status?: 'pending' | 'success' | 'failed';
    eventType?: string;
}

export interface PaginationOptions {
    page?: number;
    pageSize?: number;
}

export interface WebhookData {
    organization_id: string;
    name?: string;
    description?: string;
    url: string;
    events?: string[];
    secret?: string;
    is_active?: boolean;
    retry_policy?: {
        max_attempts: number;
        backoff: 'exponential' | 'linear';
    };
    headers?: Record<string, string>;
    payload_template?: Record<string, unknown> | null;
    created_by?: string;
}

export interface WebhookUpdate {
    name?: string;
    description?: string;
    url?: string;
    events?: string[];
    secret?: string;
    is_active?: boolean;
    retry_policy?: {
        max_attempts: number;
        backoff: 'exponential' | 'linear';
    };
    headers?: Record<string, string>;
    payload_template?: Record<string, unknown> | null;
}

export interface Webhook {
    id: string;
    organization_id: string;
    name?: string;
    description?: string;
    url: string;
    events: string[];
    secret?: string;
    is_active: boolean;
    retry_policy: {
        max_attempts: number;
        backoff: 'exponential' | 'linear';
    } | null;
    headers: Record<string, string> | null;
    payload_template: Record<string, unknown> | null;
    created_at: string;
    updated_at: string;
    created_by?: string;
}

export interface WebhookDelivery {
    id: string;
    webhook_id: string;
    event_type: string;
    payload: Record<string, unknown> | null;
    status: 'pending' | 'success' | 'failed';
    attempts: number;
    response_code?: number | null;
    response_body?: string | null;
    delivered_at?: string | null;
    created_at: string;
}

export interface FetchFunction {
    (url: string, options?: RequestInit): Promise<Response>;
}

// ==========================================
// SERVICE CLASS
// ==========================================

export class WebhookService {
    private _db: IDatabase;
    private fetch: FetchFunction;

    constructor(dbInstance?: IDatabase, options?: { fetch?: FetchFunction }) {
        this._db = dbInstance || getDatabase();
        this.fetch = options?.fetch || globalThis.fetch.bind(globalThis);
    }

    /**
     * Get all webhooks for an organization
     */
    async getWebhooks(organizationId: string, filters: WebhookFilters = {}): Promise<Webhook[]> {
        const { enabled } = filters;

        let query = 'SELECT * FROM webhooks WHERE organization_id = ?';
        const params: unknown[] = [organizationId];

        if (enabled !== undefined) {
            query += ' AND is_active = ?';
            params.push(enabled ? 1 : 0);
        }

        query += ' ORDER BY created_at DESC';

        const rows = await DbPromise.all<Record<string, unknown>>(query, params);

        const webhooks = (rows || []).map((row: Record<string, unknown>) => ({
            ...row,
            events: row.events ? JSON.parse(row.events as string) : [],
            retry_policy: row.retry_policy ? JSON.parse(row.retry_policy as string) : null,
            headers: row.headers ? JSON.parse(row.headers as string) : null,
            payload_template: row.payload_template ? JSON.parse(row.payload_template as string) : null,
            is_active: row.is_active === 1,
        })) as Webhook[];

        return webhooks;
    }

    /**
     * Get webhook by ID
     */
    async getWebhookById(id: string): Promise<Webhook | null> {
        const row = await DbPromise.get<Record<string, unknown>>('SELECT * FROM webhooks WHERE id = ?', [id]);

        if (!row) {
            return null;
        }

        return {
            ...row,
            events: row.events ? JSON.parse(row.events as string) : [],
            retry_policy: row.retry_policy ? JSON.parse(row.retry_policy as string) : null,
            headers: row.headers ? JSON.parse(row.headers as string) : null,
            payload_template: row.payload_template ? JSON.parse(row.payload_template as string) : null,
            is_active: row.is_active === 1,
        } as Webhook;
    }

    /**
     * Create a webhook
     */
    async createWebhook(webhookData: WebhookData): Promise<Webhook> {
        const {
            organization_id,
            name,
            description,
            url,
            events = [],
            secret,
            is_active = true,
            retry_policy = { max_attempts: 3, backoff: 'exponential' },
            headers = {},
            payload_template = null,
            created_by,
        } = webhookData;

        const id = uuidv4();
        const now = new Date().toISOString();

        const runResult = await DbPromise.run(
            `INSERT INTO webhooks (
                id, organization_id, name, description, url, events, secret,
                is_active, retry_policy, headers, payload_template,
                created_at, updated_at, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id,
                organization_id,
                name,
                description,
                url,
                JSON.stringify(events),
                secret,
                is_active ? 1 : 0,
                JSON.stringify(retry_policy),
                JSON.stringify(headers),
                payload_template ? JSON.stringify(payload_template) : null,
                now,
                now,
                created_by,
            ],
        );

        if (!runResult.success) {
            throw new Error(runResult.error || 'Failed to create webhook');
        }

        const webhook = await this.getWebhookById(id);
        if (!webhook) {
            throw new Error('Failed to retrieve created webhook');
        }

        return webhook;
    }

    /**
     * Update a webhook
     */
    async updateWebhook(id: string, updates: WebhookUpdate): Promise<Webhook> {
        const { name, description, url, events, secret, is_active, retry_policy, headers, payload_template } = updates;

        const updatesList: string[] = [];
        const params: unknown[] = [];

        if (name !== undefined) {
            updatesList.push('name = ?');
            params.push(name);
        }
        if (description !== undefined) {
            updatesList.push('description = ?');
            params.push(description);
        }
        if (url !== undefined) {
            updatesList.push('url = ?');
            params.push(url);
        }
        if (events !== undefined) {
            updatesList.push('events = ?');
            params.push(JSON.stringify(events));
        }
        if (secret !== undefined) {
            updatesList.push('secret = ?');
            params.push(secret);
        }
        if (is_active !== undefined) {
            updatesList.push('is_active = ?');
            params.push(is_active ? 1 : 0);
        }
        if (retry_policy !== undefined) {
            updatesList.push('retry_policy = ?');
            params.push(JSON.stringify(retry_policy));
        }
        if (headers !== undefined) {
            updatesList.push('headers = ?');
            params.push(JSON.stringify(headers));
        }
        if (payload_template !== undefined) {
            updatesList.push('payload_template = ?');
            params.push(payload_template ? JSON.stringify(payload_template) : null);
        }

        if (updatesList.length === 0) {
            const webhook = await this.getWebhookById(id);
            if (!webhook) {
                throw new Error('Webhook not found');
            }
            return webhook;
        }

        updatesList.push('updated_at = ?');
        params.push(new Date().toISOString());
        params.push(id);

        const runResult = await DbPromise.run(`UPDATE webhooks SET ${updatesList.join(', ')} WHERE id = ?`, params);

        if (!runResult.success) {
            throw new Error(runResult.error || 'Failed to update webhook');
        }

        const webhook = await this.getWebhookById(id);
        if (!webhook) {
            throw new Error('Failed to retrieve updated webhook');
        }

        return webhook;
    }

    /**
     * Delete a webhook
     */
    async deleteWebhook(id: string): Promise<{ deleted: boolean }> {
        const result = await DbPromise.run('DELETE FROM webhooks WHERE id = ?', [id]);
        if (!result.success) {
            throw new Error(result.error || 'Failed to delete webhook');
        }
        return { deleted: (result.changes || 0) > 0 };
    }

    /**
     * Test a webhook
     */
    async testWebhook(
        id: string,
        testPayload: Record<string, unknown> = {},
    ): Promise<{ success: boolean; result?: { status: number; statusText: string }; error?: string }> {
        const webhook = await this.getWebhookById(id);
        if (!webhook) {
            throw new Error('Webhook not found');
        }

        const payload = testPayload.event
            ? testPayload
            : {
                  event: 'webhook.test',
                  timestamp: new Date().toISOString(),
                  data: testPayload,
              };

        try {
            const result = await this.sendWebhook(
                webhook,
                payload.event as string,
                payload.data as Record<string, unknown>,
            );
            return { success: true, result };
        } catch (error: unknown) {
            const err = error as Error;
            return { success: false, error: err.message };
        }
    }

    /**
     * Get webhook deliveries
     */
    async getDeliveries(
        webhookId: string,
        filters: WebhookDeliveryFilters = {},
        pagination: PaginationOptions = { page: 1, pageSize: 50 },
    ): Promise<WebhookDelivery[]> {
        const { status, eventType } = filters;
        const { page = 1, pageSize = 50 } = pagination;
        const offset = (page - 1) * pageSize;

        let query = 'SELECT * FROM webhook_deliveries WHERE webhook_id = ?';
        const params: unknown[] = [webhookId];

        if (status) {
            query += ' AND status = ?';
            params.push(status);
        }
        if (eventType) {
            query += ' AND event_type = ?';
            params.push(eventType);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(pageSize, offset);

        const rows = await DbPromise.all<Record<string, unknown>>(query, params);

        const deliveries = (rows || []).map((row: Record<string, unknown>) => ({
            ...row,
            payload: row.payload ? JSON.parse(row.payload as string) : null,
        })) as WebhookDelivery[];

        return deliveries;
    }

    /**
     * Record a webhook delivery
     */
    async recordDelivery(
        webhookId: string,
        eventType: string,
        payload: Record<string, unknown>,
        status: 'pending' | 'success' | 'failed' = 'pending',
    ): Promise<{ id: string; webhook_id: string; status: string }> {
        const id = uuidv4();
        const now = new Date().toISOString();

        const runResult = await DbPromise.run(
            `INSERT INTO webhook_deliveries (
                id, webhook_id, event_type, payload, status, attempts, created_at
            ) VALUES (?, ?, ?, ?, ?, 0, ?)`,
            [id, webhookId, eventType, JSON.stringify(payload), status, now],
        );

        if (!runResult.success) {
            throw new Error(runResult.error || 'Failed to record delivery');
        }

        return { id, webhook_id: webhookId, status };
    }

    /**
     * Update delivery status
     */
    async updateDeliveryStatus(
        deliveryId: string,
        status: 'pending' | 'success' | 'failed',
        responseCode: number | null = null,
        responseBody: string | null = null,
    ): Promise<{ updated: boolean }> {
        const updates: string[] = ['status = ?', 'attempts = attempts + 1'];
        const params: unknown[] = [status];

        if (responseCode !== null) {
            updates.push('response_code = ?');
            params.push(responseCode);
        }
        if (responseBody !== null) {
            updates.push('response_body = ?');
            params.push(responseBody);
        }
        if (status === 'success') {
            updates.push('delivered_at = ?');
            params.push(new Date().toISOString());
        }

        params.push(deliveryId);

        const runResult = await DbPromise.run(
            `UPDATE webhook_deliveries SET ${updates.join(', ')} WHERE id = ?`,
            params,
        );

        if (!runResult.success) {
            throw new Error(runResult.error || 'Failed to update delivery status');
        }

        return { updated: (runResult.changes || 0) > 0 };
    }

    /**
     * Retry a failed delivery
     */
    async retryDelivery(
        deliveryId: string,
    ): Promise<{ success: boolean; result?: { status: number; statusText: string } }> {
        const delivery =
            (await DbPromise.get<Record<string, unknown>>('SELECT * FROM webhook_deliveries WHERE id = ?', [
                deliveryId,
            ])) || {};

        if (!delivery || !delivery.webhook_id) {
            throw new Error('Delivery not found');
        }

        const webhook = await this.getWebhookById(delivery.webhook_id as string);
        if (!webhook) {
            throw new Error('Webhook not found');
        }

        const payload = delivery.payload ? JSON.parse(delivery.payload as string) : {};

        try {
            const result = await this.sendWebhook(webhook, delivery.event_type as string, payload);
            await this.updateDeliveryStatus(deliveryId, 'success', result.status, result.statusText);
            return { success: true, result };
        } catch (error: unknown) {
            const err = error as Error;
            await this.updateDeliveryStatus(deliveryId, 'failed', null, err.message);
            throw error;
        }
    }

    /**
     * Trigger webhooks for a specific event
     */
    async trigger(
        organizationId: string,
        eventType: string,
        data: Record<string, unknown>,
    ): Promise<{
        triggered: number;
        results: Array<{
            webhookId: string;
            success: boolean;
            result?: { status: number; statusText: string };
            error?: string;
        }>;
    }> {
        const webhooks = await DbPromise.all<Record<string, unknown>>(
            `SELECT * FROM webhooks 
             WHERE organization_id = ? 
             AND is_active = 1 
             AND events LIKE ?`,
            [organizationId, `%${eventType}%`],
        );

        if (!webhooks || webhooks.length === 0) {
            return { triggered: 0, results: [] };
        }

        const results: Array<{
            webhookId: string;
            success: boolean;
            result?: { status: number; statusText: string };
            error?: string;
        }> = [];

        for (const webhookRow of webhooks) {
            const webhook = {
                ...webhookRow,
                events: webhookRow.events ? JSON.parse(webhookRow.events as string) : [],
                retry_policy: webhookRow.retry_policy ? JSON.parse(webhookRow.retry_policy as string) : null,
                headers: webhookRow.headers ? JSON.parse(webhookRow.headers as string) : null,
                payload_template: webhookRow.payload_template
                    ? JSON.parse(webhookRow.payload_template as string)
                    : null,
                is_active: webhookRow.is_active === 1,
            } as Webhook;

            try {
                const result = await this.sendWebhook(webhook, eventType, data);
                results.push({ webhookId: webhook.id, success: true, result });
            } catch (error: unknown) {
                const err = error as Error;
                results.push({ webhookId: webhook.id, success: false, error: err.message });
                logger.error(`[Webhook] Failed to send to ${webhook.url}:`, err.message);
            }
        }

        return { triggered: results.length, results };
    }

    /**
     * Send individual webhook
     */
    async sendWebhook(
        webhook: Webhook,
        eventType: string,
        data: Record<string, unknown>,
    ): Promise<{ status: number; statusText: string }> {
        const payload = {
            event: eventType,
            timestamp: new Date().toISOString(),
            data,
        };

        // Create HMAC signature
        const signature = crypto
            .createHmac('sha256', webhook.secret || '')
            .update(JSON.stringify(payload))
            .digest('hex');

        const response = await this.fetch(webhook.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Consultify-Signature': signature,
                'X-Consultify-Event': eventType,
                'User-Agent': 'Consultify-Webhook/1.0',
                ...(webhook.headers || {}),
            },
            body: JSON.stringify(payload),
            // @ts-expect-error - timeout is not standard but may be supported
            timeout: 5000,
        });

        if (!response.ok) {
            throw new Error(`Webhook returned ${response.status}: ${response.statusText}`);
        }

        return {
            status: response.status,
            statusText: response.statusText,
        };
    }

    /**
     * Send Slack notification
     */
    async sendSlackNotification(
        webhookUrl: string,
        message: Record<string, unknown>,
    ): Promise<{ success: boolean; status?: number; error?: string }> {
        try {
            const response = await this.fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(message),
            });

            return { success: response.ok, status: response.status };
        } catch (error: unknown) {
            const err = error as Error;
            logger.error('[Slack] Notification failed:', err);
            return { success: false, error: err.message };
        }
    }

    /**
     * Format Slack message for initiative update
     */
    formatInitiativeMessage(initiative: Record<string, unknown>, action: string): Record<string, unknown> {
        return {
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*${action}:* ${initiative.name}\n*Axis:* ${initiative.axis}\n*Priority:* ${initiative.priority}`,
                    },
                },
                {
                    type: 'context',
                    elements: [
                        {
                            type: 'mrkdwn',
                            text: `ROI: ${initiative.roi}% | Cost: $${initiative.capex || 0}`,
                        },
                    ],
                },
            ],
        };
    }

    /**
     * Format Slack message for task update
     */
    formatTaskMessage(task: Record<string, unknown>, action: string): Record<string, unknown> {
        const statusEmoji: Record<string, string> = {
            not_started: '⚪',
            in_progress: '🟡',
            completed: '✅',
            blocked: '🔴',
        };

        return {
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `${statusEmoji[task.status as string] || '⚪'} *${action}*\n*Task:* ${task.title}\n*Status:* ${task.status}`,
                    },
                },
            ],
        };
    }

    /**
     * Generate HMAC signature for webhook payload
     */
    generateHMACSignature(payload: string, secret: string): string {
        return crypto.createHmac('sha256', secret).update(payload).digest('hex');
    }
}

// Export singleton instance
const webhookService = new WebhookService();
export default webhookService;
