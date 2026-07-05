/**
 * Execution Distribution Service (M14/F6 — 6.2)
 *
 * Turns `report_distributions` rows into actually-delivered status-report emails.
 *
 * Before this service, `POST /status-reports/:id/distribute` only INSERTed a
 * `report_distributions` row (intent), and `communication_send_log` only logged
 * intent — nothing was ever sent. This is the real email-worker: it picks up
 * undelivered distribution rows (`delivered_at IS NULL`), sends each one through
 * the existing `emailService`, and settles the row (`delivered_at = NOW()`,
 * `delivery_status`).
 *
 * Fail-safe per row: one failed recipient never blocks the rest of the batch.
 */

import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import emailService from './emailService.js';

// ==========================================
// TYPES
// ==========================================

export type DeliveryStatus = 'sent' | 'failed';

/**
 * One pending distribution joined with the report it belongs to.
 * `report_distributions` has no organization_id of its own — it is scoped
 * through `status_reports.organization_id`.
 */
interface PendingDistributionRow {
  id: string;
  report_id: string;
  recipient_email: string | null;
  organization_id: string;
  period_label: string | null;
  period_type: string | null;
  overall_status: string | null;
  executive_summary: string | null;
  initiative_id: string | null;
}

export interface DistributionResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}

// ==========================================
// EMAIL RENDERING
// ==========================================

function buildSubject(row: PendingDistributionRow): string {
  const label = row.period_label || row.period_type || 'Status Report';
  return `Status Report — ${label}`;
}

function buildHtml(row: PendingDistributionRow): string {
  const label = row.period_label || row.period_type || 'Status Report';
  const status = row.overall_status || 'N/A';
  const summary = row.executive_summary || 'No executive summary provided.';
  return [
    `<h1>${label}</h1>`,
    `<p><strong>Overall status:</strong> ${status}</p>`,
    `<h2>Executive summary</h2>`,
    `<p>${summary}</p>`,
  ].join('\n');
}

// ==========================================
// CORE
// ==========================================

/**
 * Mark a single distribution row as settled.
 * Helper kept separate so callers (and tests) can record delivery directly.
 */
export async function recordDelivery(
  orgId: string,
  distributionId: string,
  status: DeliveryStatus
): Promise<void> {
  await DbPromise.run(
    `UPDATE report_distributions AS rd
        SET delivered_at = NOW(), delivery_status = $1, sent_at = NOW()
       FROM status_reports AS sr
      WHERE rd.report_id = sr.id
        AND rd.id = $2
        AND sr.organization_id = $3`,
    [status, distributionId, orgId]
  );
}

/**
 * Process all undelivered distributions for an organization.
 *
 * Reads `report_distributions` rows where `delivered_at IS NULL` (scoped to the
 * org via the status_reports join), sends each via emailService, then settles
 * the row. Per-row try/catch so one bad recipient never stops the batch.
 */
export async function processReportDistributions(orgId: string): Promise<DistributionResult> {
  const result: DistributionResult = { processed: 0, sent: 0, failed: 0, skipped: 0 };

  const pending = await DbPromise.all<PendingDistributionRow>(
    `SELECT rd.id,
            rd.report_id,
            rd.recipient_email,
            sr.organization_id,
            sr.period_label,
            sr.period_type,
            sr.overall_status,
            sr.executive_summary,
            sr.initiative_id
       FROM report_distributions AS rd
       JOIN status_reports AS sr ON sr.id = rd.report_id
      WHERE sr.organization_id = $1
        AND rd.delivered_at IS NULL
      ORDER BY rd.created_at`,
    [orgId]
  );

  for (const row of pending) {
    result.processed += 1;

    if (!row.recipient_email) {
      // No address to send to — settle as failed so it does not loop forever.
      result.skipped += 1;
      try {
        await recordDelivery(orgId, row.id, 'failed');
      } catch (e) {
        logger.error(
          `[ExecutionDistribution] Failed to settle address-less row ${row.id}: ${(e as Error).message}`
        );
      }
      continue;
    }

    try {
      await emailService.send({
        to: row.recipient_email,
        subject: buildSubject(row),
        html: buildHtml(row),
      });
      await recordDelivery(orgId, row.id, 'sent');
      result.sent += 1;
    } catch (e) {
      // Fail-safe: log, mark failed, keep going with the rest of the batch.
      result.failed += 1;
      logger.error(
        `[ExecutionDistribution] Delivery failed for distribution ${row.id} (report ${row.report_id}): ${(e as Error).message}`
      );
      try {
        await recordDelivery(orgId, row.id, 'failed');
      } catch (settleErr) {
        logger.error(
          `[ExecutionDistribution] Could not record failure for ${row.id}: ${(settleErr as Error).message}`
        );
      }
    }
  }

  return result;
}

export default {
  processReportDistributions,
  recordDelivery,
};
