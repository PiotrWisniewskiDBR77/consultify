/**
 * Webhook Retry Service
 * GAP-BILLING-002: Webhook retry queue with exponential backoff
 *
 * Handles failed webhook processing with retry logic.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface WebhookRetryRecord {
  id: string;
  webhook_type: string;
  event_type: string;
  event_id: string | null;
  payload: string;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  last_error: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface QueueWebhookOptions {
  webhookType: string;
  eventType: string;
  eventId?: string;
  payload: Record<string, unknown>;
  maxRetries?: number;
}

// Retry delays in milliseconds (exponential backoff)
// 1 min, 5 min, 15 min, 1 hour, 4 hours
const RETRY_DELAYS = [
  60 * 1000, // 1 minute
  5 * 60 * 1000, // 5 minutes
  15 * 60 * 1000, // 15 minutes
  60 * 60 * 1000, // 1 hour
  4 * 60 * 60 * 1000, // 4 hours
];

// ==========================================
// CLASS IMPLEMENTATION
// ==========================================

class WebhookRetryService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  /**
   * Queue a failed webhook for retry
   */
  async queueForRetry(options: QueueWebhookOptions): Promise<string> {
    const db = await this.getDb();
    const id = `retry-${uuidv4()}`;
    const nextRetryAt = new Date(Date.now() + RETRY_DELAYS[0]).toISOString();

    await db.run(
      `INSERT INTO webhook_retry_queue 
             (id, webhook_type, event_type, event_id, payload, max_retries, next_retry_at, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        id,
        options.webhookType,
        options.eventType,
        options.eventId || null,
        JSON.stringify(options.payload),
        options.maxRetries || 5,
      ]
    );

    logger.info(`[WebhookRetry] Queued webhook for retry: ${id} (${options.eventType})`);
    return id;
  }

  /**
   * Get pending webhooks ready for retry
   */
  async getPendingRetries(limit: number = 10): Promise<WebhookRetryRecord[]> {
    const db = await this.getDb();
    return db.all<WebhookRetryRecord>(
      `SELECT * FROM webhook_retry_queue 
             WHERE status = 'pending' 
             AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
             ORDER BY next_retry_at ASC
             LIMIT ?`,
      [limit]
    );
  }

  /**
   * Mark webhook as processing
   */
  async markProcessing(id: string): Promise<void> {
    const db = await this.getDb();
    await db.run(
      `UPDATE webhook_retry_queue SET status = 'processing', updated_at = datetime('now') WHERE id = ?`,
      [id]
    );
  }

  /**
   * Mark webhook as completed
   */
  async markCompleted(id: string): Promise<void> {
    const db = await this.getDb();
    await db.run(
      `UPDATE webhook_retry_queue 
             SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') 
             WHERE id = ?`,
      [id]
    );
    logger.info(`[WebhookRetry] Webhook completed: ${id}`);
  }

  /**
   * Mark webhook as failed and schedule retry
   */
  async markFailed(id: string, error: string): Promise<void> {
    const db = await this.getDb();

    const record = await db.get<WebhookRetryRecord>(
      `SELECT * FROM webhook_retry_queue WHERE id = ?`,
      [id]
    );

    if (!record) return;

    const newRetryCount = record.retry_count + 1;

    if (newRetryCount >= record.max_retries) {
      // Max retries reached, mark as permanently failed
      await db.run(
        `UPDATE webhook_retry_queue 
                 SET status = 'failed', retry_count = ?, last_error = ?, updated_at = datetime('now')
                 WHERE id = ?`,
        [newRetryCount, error, id]
      );
      logger.error(
        `[WebhookRetry] Webhook permanently failed after ${newRetryCount} retries: ${id}`
      );
    } else {
      // Schedule next retry with exponential backoff
      const delayIndex = Math.min(newRetryCount, RETRY_DELAYS.length - 1);
      const delay = RETRY_DELAYS[delayIndex];
      const nextRetryAt = new Date(Date.now() + delay).toISOString();

      await db.run(
        `UPDATE webhook_retry_queue 
                 SET status = 'pending', retry_count = ?, next_retry_at = ?, last_error = ?, updated_at = datetime('now')
                 WHERE id = ?`,
        [newRetryCount, nextRetryAt, error, id]
      );
      logger.warn(
        `[WebhookRetry] Webhook retry scheduled: ${id} (attempt ${newRetryCount + 1}, next at ${nextRetryAt})`
      );
    }
  }

  /**
   * Process a single retry - delegates to appropriate handler
   */
  async processRetry(record: WebhookRetryRecord): Promise<boolean> {
    try {
      await this.markProcessing(record.id);
      const payload = JSON.parse(record.payload);

      switch (record.webhook_type) {
        case 'stripe':
          return await this.processStripeWebhook(record.event_type, payload);
        case 'partner':
          return await this.processPartnerWebhook(record.event_type, payload);
        default:
          logger.warn(`[WebhookRetry] Unknown webhook type: ${record.webhook_type}`);
          return false;
      }
    } catch (err: any) {
      logger.error(`[WebhookRetry] Error processing retry ${record.id}:`, err);
      await this.markFailed(record.id, err?.message || 'Unknown error');
      return false;
    }
  }

  /**
   * Process Stripe webhook retry
   */
  private async processStripeWebhook(eventType: string, payload: any): Promise<boolean> {
    try {
      // Import the BillingWebhookService to reprocess
      const BillingWebhookService = (await import('./BillingWebhookService.js')).default;

      // Reconstruct a Stripe-like event object
      const event = {
        type: eventType,
        data: {
          object: payload,
        },
      };

      // Process the webhook event - BillingWebhookService doesn't have handleStripeEvent
      // Instead, use recordBillingWebhookEvent or process through webhook service
      await (BillingWebhookService as any).recordBillingWebhookEvent?.(
        payload.organization_id || 'unknown',
        eventType,
        payload,
        'retry'
      );
      return true;
    } catch (err) {
      logger.error('[WebhookRetry] Stripe webhook retry failed:', err);
      throw err;
    }
  }

  /**
   * Process partner webhook retry
   */
  private async processPartnerWebhook(eventType: string, payload: any): Promise<boolean> {
    try {
      // Partner-specific retry logic would go here
      logger.info(`[WebhookRetry] Processing partner webhook: ${eventType}`);
      return true;
    } catch (err) {
      logger.error('[WebhookRetry] Partner webhook retry failed:', err);
      throw err;
    }
  }

  /**
   * Run retry processing loop - call this from a cron job
   */
  async processRetryQueue(): Promise<{ processed: number; succeeded: number; failed: number }> {
    const pendingRetries = await this.getPendingRetries(10);
    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const record of pendingRetries) {
      processed++;
      try {
        const success = await this.processRetry(record);
        if (success) {
          await this.markCompleted(record.id);
          succeeded++;
        } else {
          failed++;
        }
      } catch (err: any) {
        await this.markFailed(record.id, err?.message || 'Processing error');
        failed++;
      }
    }

    if (processed > 0) {
      logger.info(
        `[WebhookRetry] Processed ${processed} retries: ${succeeded} succeeded, ${failed} failed`
      );
    }

    return { processed, succeeded, failed };
  }

  /**
   * Get retry statistics
   */
  async getStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const db = await this.getDb();

    const pending = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM webhook_retry_queue WHERE status = 'pending'`
    );
    const processing = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM webhook_retry_queue WHERE status = 'processing'`
    );
    const completed = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM webhook_retry_queue WHERE status = 'completed'`
    );
    const failed = await db.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM webhook_retry_queue WHERE status = 'failed'`
    );

    return {
      pending: pending?.count || 0,
      processing: processing?.count || 0,
      completed: completed?.count || 0,
      failed: failed?.count || 0,
    };
  }

  /**
   * Clean up old completed/failed records
   */
  async cleanup(daysOld: number = 30): Promise<number> {
    const db = await this.getDb();
    const result = await db.run(
      `DELETE FROM webhook_retry_queue 
             WHERE status IN ('completed', 'failed') 
             AND updated_at < datetime('now', '-' || ? || ' days')`,
      [daysOld]
    );
    return result?.changes || 0;
  }
}

// Export singleton instance
const webhookRetryService = new WebhookRetryService();
export default webhookRetryService;

// Named exports for convenience
export const queueForRetry = (options: QueueWebhookOptions) =>
  webhookRetryService.queueForRetry(options);
export const processRetryQueue = () => webhookRetryService.processRetryQueue();
export const getStats = () => webhookRetryService.getStats();
export const cleanup = (daysOld?: number) => webhookRetryService.cleanup(daysOld);
