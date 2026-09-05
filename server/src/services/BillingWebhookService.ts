/**
 * Billing Webhook Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles triggering and recording of billing-related webhook events.
 * Fully migrated from server/services/billingWebhookService.js
 */

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export const BILLING_EVENT_TYPES = {
  // Subscription Events
  SUBSCRIPTION_CREATED: 'subscription.created',
  SUBSCRIPTION_UPDATED: 'subscription.updated',
  SUBSCRIPTION_CANCELED: 'subscription.canceled',
  SUBSCRIPTION_TRIAL_ENDING: 'subscription.trial_ending',
  SUBSCRIPTION_RENEWED: 'subscription.renewed',
  SUBSCRIPTION_PAUSED: 'subscription.paused',
  SUBSCRIPTION_RESUMED: 'subscription.resumed',

  // Invoice Events
  INVOICE_CREATED: 'invoice.created',
  INVOICE_SENT: 'invoice.sent',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
  INVOICE_OVERDUE: 'invoice.overdue',
  INVOICE_VOIDED: 'invoice.voided',
  INVOICE_FINALIZED: 'invoice.finalized',

  // Payment Events
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',
  PAYMENT_DISPUTED: 'payment.disputed',

  // Credit Note Events
  CREDIT_NOTE_ISSUED: 'credit_note.issued',
  CREDIT_NOTE_APPLIED: 'credit_note.applied',
  CREDIT_NOTE_REFUNDED: 'credit_note.refunded',
  CREDIT_NOTE_VOIDED: 'credit_note.voided',

  // Customer Events
  CUSTOMER_CREATED: 'customer.created',
  CUSTOMER_UPDATED: 'customer.updated',
  CUSTOMER_DELETED: 'customer.deleted',

  // Usage Events
  USAGE_LIMIT_APPROACHING: 'usage.limit_approaching',
  USAGE_LIMIT_EXCEEDED: 'usage.limit_exceeded',
  USAGE_RECORD_CREATED: 'usage.record_created',

  // Dunning Events
  DUNNING_STARTED: 'dunning.started',
  DUNNING_RETRY_SCHEDULED: 'dunning.retry_scheduled',
  DUNNING_FINAL_ATTEMPT: 'dunning.final_attempt',
  DUNNING_COMPLETED: 'dunning.completed',
  DUNNING_FAILED: 'dunning.failed',
} as const;

export type BillingEventType = (typeof BILLING_EVENT_TYPES)[keyof typeof BILLING_EVENT_TYPES];

export interface BillingWebhookEvent {
  id: string;
  organization_id: string;
  event_type: BillingEventType;
  payload: any;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  target_url: string | null;
  attempt_count: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BillingWebhookDeps {
  db: IDatabase;
  uuidv4: () => string;
  webhookService: any;
}

// ==========================================
// CLASS IMPLEMENTATION
// ==========================================

export class BillingWebhookServiceClass {
  #deps: BillingWebhookDeps | null = null;
  #initialized = false;
  #initPromise: Promise<void> | null = null;

  constructor(deps?: Partial<BillingWebhookDeps>) {
    if (deps?.db && deps?.uuidv4 && deps?.webhookService) {
      this.#deps = deps as BillingWebhookDeps;
      this.#initialized = true;
    }
  }

  async #initDeps() {
    if (this.#initialized) return;
    if (this.#initPromise) return this.#initPromise;

    this.#initPromise = (async () => {
      const [uuidModule, webhookModule] = await Promise.all([
        import('uuid'),
        import('./WebhookService.js'),
      ]);

      this.#deps = {
        db: getDatabase(),
        uuidv4: uuidModule.v4,
        webhookService: webhookModule.default || webhookModule,
      };
      this.#initialized = true;
    })();

    return this.#initPromise;
  }

  setDependencies(newDeps: Partial<BillingWebhookDeps>) {
    this.#deps = { ...this.#deps!, ...newDeps };
    this.#initialized = true;
  }

  private async dbGet<T>(sql: string, params: any[] = []): Promise<T | null> {
    await this.#initDeps();
    return DbPromise.get<T>(this.#deps!.db, sql, params, { fallback: false });
  }

  private async dbRun(
    sql: string,
    params: any[] = []
  ): Promise<{ lastID?: number; changes: number }> {
    await this.#initDeps();
    const result = await DbPromise.run(this.#deps!.db, sql, params, { fallback: false });
    return {
      lastID: result.lastID,
      changes: result.changes || 0,
    };
  }

  private async dbAll<T>(sql: string, params: any[] = []): Promise<T[]> {
    await this.#initDeps();
    return DbPromise.all<T>(this.#deps!.db, sql, params, { fallback: false });
  }

  /**
   * Record a billing webhook event in the database
   */
  async recordBillingWebhookEvent(
    organizationId: string,
    eventType: string,
    payload: any,
    targetUrl: string | null = null
  ): Promise<{ id: string; organizationId: string; eventType: string; status: string }> {
    await this.#initDeps();
    const { uuidv4 } = this.#deps!;

    const id = uuidv4();
    const now = new Date().toISOString();

    await this.dbRun(
      `INSERT INTO billing_webhook_events (
                id, organization_id, event_type, payload, status, target_url, attempt_count, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'pending', ?, 0, ?, ?)`,
      [id, organizationId, eventType, JSON.stringify(payload), targetUrl, now, now]
    );

    return { id, organizationId, eventType, status: 'pending' };
  }

  /**
   * Update the status of a billing webhook event
   */
  async updateEventStatus(eventId: string, status: string): Promise<{ updated: boolean }> {
    await this.#initDeps();

    // Day 314 — last_attempt_at / updated_at / next_retry_at are TEXT columns.
    // `datetime('now')` is rewritten to a Postgres timestamptz, and assigning a
    // timestamptz to a text column fails. Bind the formatted string instead, in
    // the same 'YYYY-MM-DD HH:MM:SS' UTC shape the table already stores.
    const nowText = BillingWebhookServiceClass.formatWebhookTimestamp(new Date());
    const updates = ['status = ?', 'attempt_count = attempt_count + 1', 'last_attempt_at = ?', 'updated_at = ?'];
    const params: any[] = [status, nowText, nowText];

    if (status === 'failed' || status === 'retrying') {
      const event = await this.getEventById(eventId);
      const attemptCount = (event?.attempt_count || 0) + 1;
      const delayMinutes = Math.min(Math.pow(2, attemptCount) * 5, 1440); // Max 24 hours
      updates.push('next_retry_at = ?');
      params.push(
        BillingWebhookServiceClass.formatWebhookTimestamp(
          new Date(Date.now() + delayMinutes * 60 * 1000)
        )
      );
    }

    params.push(eventId);

    const result = await this.dbRun(
      `UPDATE billing_webhook_events SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    return { updated: result.changes > 0 };
  }

  /**
   * Get a billing webhook event by ID
   */
  async getEventById(eventId: string): Promise<BillingWebhookEvent | null> {
    const row = await this.dbGet<any>('SELECT * FROM billing_webhook_events WHERE id = ?', [
      eventId,
    ]);

    if (row && row.payload) {
      try {
        row.payload = JSON.parse(row.payload);
      } catch (e) {
        logger.warn(`Failed to parse billing webhook payload for event ${eventId}`);
      }
    }
    return row;
  }

  /**
   * Get pending events for retry
   */
  async getPendingRetries(limit = 50): Promise<BillingWebhookEvent[]> {
    // Day 314 — next_retry_at is TEXT; comparing it against the rewritten
    // `datetime('now')` timestamptz has no Postgres operator (42883). Bind the
    // cutoff as text in the column's own format instead.
    const nowText = BillingWebhookServiceClass.formatWebhookTimestamp(new Date());
    const rows = await this.dbAll<any>(
      `SELECT * FROM billing_webhook_events 
             WHERE status IN ('pending', 'retrying') 
             AND (next_retry_at IS NULL OR next_retry_at <= ?)
             AND attempt_count < 5
             ORDER BY created_at ASC
             LIMIT ?`,
      [nowText, limit]
    );

    return rows.map((row) => {
      if (row.payload) {
        try {
          row.payload = JSON.parse(row.payload);
        } catch (e) {
          logger.warn(`Failed to parse billing webhook payload for event ${row.id}`);
        }
      }
      return row;
    });
  }

  /**
   * Trigger a billing webhook event
   */
  async triggerEvent(
    organizationId: string,
    eventType: string,
    data: any,
    options: { recordOnly?: boolean } = {}
  ): Promise<any> {
    await this.#initDeps();
    const { uuidv4, webhookService } = this.#deps!;

    const { recordOnly = false } = options;

    const eventPayload = {
      id: uuidv4(),
      type: eventType,
      created: new Date().toISOString(),
      livemode: process.env.NODE_ENV === 'production',
      data: {
        object: data,
      },
    };

    const recordedEvent = await this.recordBillingWebhookEvent(
      organizationId,
      eventType,
      eventPayload
    );

    if (recordOnly) {
      return { recorded: true, triggered: false, eventId: recordedEvent.id };
    }

    try {
      const result = await webhookService.trigger(organizationId, eventType, eventPayload);

      if (result.triggered > 0) {
        await this.updateEventStatus(recordedEvent.id, 'sent');
      }

      return {
        recorded: true,
        triggered: result.triggered,
        eventId: recordedEvent.id,
        results: result.results,
      };
    } catch (error: any) {
      logger.error('[BillingWebhook] Trigger error:', error);
      await this.updateEventStatus(recordedEvent.id, 'failed');
      return {
        recorded: true,
        triggered: false,
        eventId: recordedEvent.id,
        error: error.message,
      };
    }
  }

  // ==========================================
  // Convenience Methods
  // ==========================================

  async subscriptionCreated(orgId: string, sub: any) {
    return this.triggerEvent(orgId, BILLING_EVENT_TYPES.SUBSCRIPTION_CREATED, sub);
  }

  async subscriptionUpdated(orgId: string, sub: any, prev: any = {}) {
    return this.triggerEvent(orgId, BILLING_EVENT_TYPES.SUBSCRIPTION_UPDATED, {
      ...sub,
      previous_attributes: prev,
    });
  }

  async subscriptionCanceled(orgId: string, sub: any) {
    return this.triggerEvent(orgId, BILLING_EVENT_TYPES.SUBSCRIPTION_CANCELED, sub);
  }

  async invoicePaid(orgId: string, inv: any) {
    return this.triggerEvent(orgId, BILLING_EVENT_TYPES.INVOICE_PAID, inv);
  }

  async invoicePaymentFailed(orgId: string, inv: any, err: any = null) {
    return this.triggerEvent(orgId, BILLING_EVENT_TYPES.INVOICE_PAYMENT_FAILED, {
      ...inv,
      error: err,
    });
  }

  async paymentSucceeded(orgId: string, pay: any) {
    return this.triggerEvent(orgId, BILLING_EVENT_TYPES.PAYMENT_SUCCEEDED, pay);
  }

  async paymentFailed(orgId: string, pay: any, err: any = null) {
    return this.triggerEvent(orgId, BILLING_EVENT_TYPES.PAYMENT_FAILED, { ...pay, error: err });
  }

  async paymentRefunded(orgId: string, pay: any, refund: any) {
    return this.triggerEvent(orgId, BILLING_EVENT_TYPES.PAYMENT_REFUNDED, { payment: pay, refund });
  }

  async creditNoteIssued(orgId: string, cn: any) {
    return this.triggerEvent(orgId, BILLING_EVENT_TYPES.CREDIT_NOTE_ISSUED, cn);
  }

  async creditNoteApplied(orgId: string, cn: any, inv: any) {
    return this.triggerEvent(orgId, BILLING_EVENT_TYPES.CREDIT_NOTE_APPLIED, {
      credit_note: cn,
      invoice: inv,
    });
  }

  async usageLimitApproaching(orgId: string, data: any) {
    return this.triggerEvent(orgId, BILLING_EVENT_TYPES.USAGE_LIMIT_APPROACHING, data);
  }

  async usageLimitExceeded(orgId: string, data: any) {
    return this.triggerEvent(orgId, BILLING_EVENT_TYPES.USAGE_LIMIT_EXCEEDED, data);
  }

  async dunningStarted(orgId: string, data: any) {
    return this.triggerEvent(orgId, BILLING_EVENT_TYPES.DUNNING_STARTED, data);
  }

  async dunningCompleted(orgId: string, data: any) {
    return this.triggerEvent(orgId, BILLING_EVENT_TYPES.DUNNING_COMPLETED, data);
  }

  async dunningFailed(orgId: string, data: any) {
    return this.triggerEvent(orgId, BILLING_EVENT_TYPES.DUNNING_FAILED, data);
  }

  // ==========================================
  // Analytics
  // ==========================================

  /**
   * Day 314 — two defects in one statement.
   *
   * 1. `period` came straight from `?period=` on
   *    GET /api/billing/webhook-events/stats and was interpolated into the SQL
   *    string (`datetime('now', '-${period}')`). Anything the caller typed
   *    became SQL.
   * 2. `billing_webhook_events.created_at` is a TEXT column
   *    ('YYYY-MM-DD HH24:MI:SS', UTC). `datetime('now', ...)` is rewritten to a
   *    real Postgres timestamp, and `text >= timestamptz` has no operator, so
   *    the route answered 500 for every caller regardless of the period.
   *
   * Both go away by computing the cutoff in JS and BINDING it as a string in
   * the column's own format: text-vs-text compares correctly in Postgres and in
   * SQLite, and there is no interpolated fragment left to inject into.
   */
  static readonly DEFAULT_STATS_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

  static parseStatsPeriodMs(period: unknown): number {
    const raw = String(period ?? '')
      .trim()
      .toLowerCase();
    const match = /^(\d{1,4})\s+(hour|day|week|month|year)s?$/.exec(raw);
    if (!match) return BillingWebhookServiceClass.DEFAULT_STATS_PERIOD_MS;
    const amount = Number(match[1]);
    if (!Number.isFinite(amount) || amount <= 0) {
      return BillingWebhookServiceClass.DEFAULT_STATS_PERIOD_MS;
    }
    const unitMs: Record<string, number> = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000,
    };
    return amount * unitMs[match[2]];
  }

  /** Formats a Date the way this table stores created_at: 'YYYY-MM-DD HH:MM:SS' UTC. */
  static formatWebhookTimestamp(date: Date): string {
    return date.toISOString().replace('T', ' ').slice(0, 19);
  }

  async getEventStats(organizationId: string, period = '30 days'): Promise<any[]> {
    const cutoff = BillingWebhookServiceClass.formatWebhookTimestamp(
      new Date(Date.now() - BillingWebhookServiceClass.parseStatsPeriodMs(period))
    );
    return this.dbAll(
      `SELECT 
                event_type,
                status,
                COUNT(*) as count
             FROM billing_webhook_events
             WHERE organization_id = ?
             AND created_at >= ?
             GROUP BY event_type, status
             ORDER BY count DESC`,
      [organizationId, cutoff]
    );
  }

  async getRecentEvents(organizationId: string, limit = 100): Promise<BillingWebhookEvent[]> {
    const rows = await this.dbAll<any>(
      `SELECT * FROM billing_webhook_events
             WHERE organization_id = ?
             ORDER BY created_at DESC
             LIMIT ?`,
      [organizationId, limit]
    );

    return rows.map((row) => {
      if (row.payload) {
        try {
          row.payload = JSON.parse(row.payload);
        } catch (e) {
          logger.warn(`Failed to parse billing webhook payload for event ${row.id}`);
        }
      }
      return row;
    });
  }

  async getFailedEvents(limit = 50): Promise<BillingWebhookEvent[]> {
    const rows = await this.dbAll<any>(
      `SELECT * FROM billing_webhook_events
             WHERE status = 'failed'
             AND attempt_count < 5
             ORDER BY created_at DESC
             LIMIT ?`,
      [limit]
    );

    return rows.map((row) => {
      if (row.payload) {
        try {
          row.payload = JSON.parse(row.payload);
        } catch (e) {
          logger.warn(`Failed to parse billing webhook payload for event ${row.id}`);
        }
      }
      return row;
    });
  }
}

// ==========================================
// EXPORTS
// ==========================================

const BillingWebhookService = new BillingWebhookServiceClass();

export const recordBillingWebhookEvent = (
  orgId: string,
  type: string,
  payload: any,
  url?: string | null
) => BillingWebhookService.recordBillingWebhookEvent(orgId, type, payload, url);
export const updateEventStatus = (id: string, status: string) =>
  BillingWebhookService.updateEventStatus(id, status);
export const getEventById = (id: string) => BillingWebhookService.getEventById(id);
export const triggerEvent = (orgId: string, type: string, data: any, options?: any) =>
  BillingWebhookService.triggerEvent(orgId, type, data, options);

export default BillingWebhookService;
