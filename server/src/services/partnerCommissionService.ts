/**
 * Partner Commission Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Handles commission calculations, tracking, and payouts:
 * - Commission calculation on customer payments
 * - Commission approval workflow
 * - Payout management
 * - Earnings reporting
 *
 * @module PartnerCommissionService
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import PartnerProgramLedgerService from './partnerProgramLedgerService.js';

// ==========================================
// TYPES
// ==========================================

export const TRANSACTION_TYPES = {
  INITIAL: 'INITIAL',
  SUBSCRIPTION: 'SUBSCRIPTION',
  RENEWAL: 'RENEWAL',
  UPSELL: 'UPSELL',
  ONE_TIME: 'ONE_TIME',
  REFUND: 'REFUND',
  BONUS: 'BONUS',
} as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[keyof typeof TRANSACTION_TYPES];

export const TRANSACTION_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  DISPUTED: 'DISPUTED',
} as const;

export type TransactionStatus = (typeof TRANSACTION_STATUS)[keyof typeof TRANSACTION_STATUS];

export const PAYOUT_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type PayoutStatus = (typeof PAYOUT_STATUS)[keyof typeof PAYOUT_STATUS];

export interface CommissionTransaction {
  id: string;
  partnerOrgId: string;
  attributionId?: string;
  organizationId: string;
  organizationName?: string;
  transactionType: TransactionType;
  transactionDate: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  grossAmount: number;
  commissionRate: number;
  commissionAmount: number;
  currency: string;
  invoiceId?: string;
  stripePaymentId?: string;
  status: TransactionStatus;
  approvedAt?: string;
  approvedBy?: string;
  payoutId?: string;
  notes?: string;
  createdAt: string;
}

export interface CreateCommissionParams {
  partnerOrgId: string;
  attributionId?: string;
  organizationId: string;
  transactionType: TransactionType;
  grossAmount: number;
  commissionRate: number;
  currency?: string;
  invoiceId?: string;
  stripePaymentId?: string;
  stripeInvoiceId?: string;
  billingPeriodStart?: string;
  billingPeriodEnd?: string;
  notes?: string;
}

export interface EarningsSummary {
  totalEarned: number;
  totalPending: number;
  totalApproved: number;
  totalPaid: number;
  thisMonth: number;
  thisMonthCount: number;
  lastMonth: number;
  readyForPayout: number;
  currency: string;
}

export interface Payout {
  id: string;
  partnerOrgId: string;
  payoutAccountId?: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  fees: number;
  taxWithheld: number;
  netAmount: number;
  currency: string;
  transactionCount: number;
  status: PayoutStatus;
  payoutMethod?: string;
  payoutReference?: string;
  requestedAt: string;
  requestedBy?: string;
  processedAt?: string;
  completedAt?: string;
  failureReason?: string;
  notes?: string;
  createdAt: string;
}

export interface PayoutRequest {
  partnerOrgId: string;
  payoutAccountId?: string;
  requestedBy?: string;
  notes?: string;
}

// ==========================================
// DATABASE TYPES
// ==========================================

interface CommissionRow {
  id: string;
  partner_org_id: string;
  attribution_id: string | null;
  organization_id: string;
  transaction_type: string;
  transaction_date: string;
  billing_period_start: string | null;
  billing_period_end: string | null;
  gross_amount: number;
  commission_rate: number;
  commission_amount: number;
  currency: string;
  invoice_id: string | null;
  stripe_payment_id: string | null;
  stripe_invoice_id: string | null;
  status: string;
  approved_at: string | null;
  approved_by: string | null;
  payout_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  org_name?: string;
}

interface PayoutRow {
  id: string;
  partner_org_id: string;
  payout_account_id: string | null;
  payout_period_start: string;
  payout_period_end: string;
  gross_amount: number;
  fees: number;
  tax_withheld: number;
  net_amount: number;
  currency: string;
  transaction_count: number;
  status: string;
  payout_method: string | null;
  payout_reference: string | null;
  external_payout_id: string | null;
  requested_at: string;
  requested_by: string | null;
  processed_at: string | null;
  processed_by: string | null;
  completed_at: string | null;
  failure_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ==========================================
// SERVICE
// ==========================================

let db: IDatabase = getDatabase();

function toNumber(value: unknown): number {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function toIsoDateString(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const raw = String(value || '').trim();
  if (!raw) return new Date().toISOString().slice(0, 10);
  return raw.includes('T') ? raw.split('T')[0] : raw.slice(0, 10);
}

async function getPayoutRowById(payoutId: string): Promise<PayoutRow | null> {
  const row = await DbPromise.get<PayoutRow>(
    db,
    `SELECT *
     FROM partner_payouts
     WHERE id = ?`,
    [payoutId]
  );
  return row ?? null;
}

/**
 * Set database instance (for testing)
 */
export function setDependencies(newDeps: { db?: IDatabase } = {}): void {
  if (newDeps.db) {
    db = newDeps.db;
  }
}

// ==========================================
// COMMISSION OPERATIONS
// ==========================================

/**
 * Create a commission transaction
 * Called when a customer makes a payment and has a partner attribution
 */
export async function createCommission(
  params: CreateCommissionParams
): Promise<CommissionTransaction> {
  const {
    partnerOrgId,
    attributionId,
    organizationId,
    transactionType,
    grossAmount,
    commissionRate,
    currency = 'EUR',
    invoiceId,
    stripePaymentId,
    stripeInvoiceId,
    billingPeriodStart,
    billingPeriodEnd,
    notes,
  } = params;

  const id = uuidv4();
  const commissionAmount = Math.round(grossAmount * commissionRate) / 100;
  const transactionDate = new Date().toISOString();

  try {
    await DbPromise.run(
      db,
      `INSERT INTO partner_commission_transactions 
             (id, partner_org_id, attribution_id, organization_id, transaction_type,
              transaction_date, billing_period_start, billing_period_end,
              gross_amount, commission_rate, commission_amount, currency,
              invoice_id, stripe_payment_id, stripe_invoice_id, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        partnerOrgId,
        attributionId || null,
        organizationId,
        transactionType,
        transactionDate,
        billingPeriodStart || null,
        billingPeriodEnd || null,
        grossAmount,
        commissionRate,
        commissionAmount,
        currency,
        invoiceId || null,
        stripePaymentId || null,
        stripeInvoiceId || null,
        notes || null,
      ]
    );

    logger.info(
      `[PartnerCommissionService] Created commission: €${commissionAmount} for partner ${partnerOrgId}`
    );

    return {
      id,
      partnerOrgId,
      attributionId,
      organizationId,
      transactionType,
      transactionDate,
      billingPeriodStart,
      billingPeriodEnd,
      grossAmount,
      commissionRate,
      commissionAmount,
      currency,
      invoiceId,
      stripePaymentId,
      status: 'PENDING',
      notes,
      createdAt: transactionDate,
    };
  } catch (err: any) {
    logger.error('[PartnerCommissionService] Error creating commission:', err);
    throw err;
  }
}

/**
 * Get commission transactions for a partner
 */
export async function getCommissions(
  partnerOrgId: string,
  options: {
    status?: TransactionStatus;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<CommissionTransaction[]> {
  const { status, startDate, endDate, limit = 50, offset = 0 } = options;

  let query = `SELECT pct.*, o.name as org_name
                 FROM partner_commission_transactions pct
                 LEFT JOIN organizations o ON o.id = pct.organization_id::text
                 WHERE pct.partner_org_id = ?`;
  const params: any[] = [partnerOrgId];

  if (status) {
    query += ` AND pct.status = ?`;
    params.push(status);
  }

  if (startDate) {
    query += ` AND pct.transaction_date >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND pct.transaction_date <= ?`;
    params.push(endDate);
  }

  query += ` ORDER BY pct.transaction_date DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  try {
    const rows = await DbPromise.all<CommissionRow>(db, query, params);

    return rows.map((row) => ({
      id: row.id,
      partnerOrgId: row.partner_org_id,
      attributionId: row.attribution_id || undefined,
      organizationId: row.organization_id,
      organizationName: row.org_name,
      transactionType: row.transaction_type as TransactionType,
      transactionDate: row.transaction_date,
      billingPeriodStart: row.billing_period_start || undefined,
      billingPeriodEnd: row.billing_period_end || undefined,
      grossAmount: Number(row.gross_amount ?? 0),
      commissionRate: Number(row.commission_rate ?? 0),
      commissionAmount: Number(row.commission_amount ?? 0),
      currency: row.currency,
      invoiceId: row.invoice_id || undefined,
      stripePaymentId: row.stripe_payment_id || undefined,
      status: row.status as TransactionStatus,
      approvedAt: row.approved_at || undefined,
      approvedBy: row.approved_by || undefined,
      payoutId: row.payout_id || undefined,
      notes: row.notes || undefined,
      createdAt: row.created_at,
    }));
  } catch (err: any) {
    logger.error('[PartnerCommissionService] Error getting commissions:', err);
    return [];
  }
}

/**
 * Approve commission transactions (admin action)
 */
export async function approveCommissions(
  commissionIds: string[],
  approvedBy: string
): Promise<{ success: boolean; approvedCount: number }> {
  if (commissionIds.length === 0) {
    return { success: false, approvedCount: 0 };
  }

  try {
    const placeholders = commissionIds.map(() => '?').join(', ');
    const pendingRows = await DbPromise.all<CommissionRow>(
      db,
      `SELECT id, partner_org_id, attribution_id, organization_id, transaction_type,
              transaction_date, billing_period_start, billing_period_end,
              gross_amount, commission_rate, commission_amount, currency,
              invoice_id, stripe_payment_id, stripe_invoice_id, status,
              approved_at, approved_by, payout_id, notes, created_at, updated_at
       FROM partner_commission_transactions
       WHERE id IN (${placeholders}) AND status = 'PENDING'`,
      commissionIds
    );
    const result = await DbPromise.run(
      db,
      `UPDATE partner_commission_transactions 
             SET status = 'APPROVED', approved_at = NOW(), approved_by = ?, updated_at = NOW()
             WHERE id IN (${placeholders}) AND status = 'PENDING'`,
      [approvedBy, ...commissionIds]
    );

    for (const row of pendingRows) {
      await PartnerProgramLedgerService.appendEntry({
        partnerOrgId: row.partner_org_id,
        entryType: 'accrual.posted',
        ruleVersion: 'partner-commission-approval-v1',
        amount: Number(row.commission_amount || 0),
        currency: row.currency || 'EUR',
        actor: 'operator',
        actorId: approvedBy || null,
        idempotencyKey: `partner-commission-approved:${row.id}`,
        sourceRef: {
          commissionId: row.id,
          organizationId: row.organization_id,
          transactionType: row.transaction_type,
        },
        note: row.notes || 'Commission approved and posted to governed ledger',
      });
    }

    logger.info(
      `[PartnerCommissionService] Approved ${result.changes} commissions by ${approvedBy}`
    );

    return { success: true, approvedCount: result.changes || 0 };
  } catch (err: any) {
    logger.error('[PartnerCommissionService] Error approving commissions:', err);
    return { success: false, approvedCount: 0 };
  }
}

/**
 * Cancel a commission transaction
 */
export async function cancelCommission(
  commissionId: string,
  reason: string,
  cancelledBy: string
): Promise<boolean> {
  try {
    const result = await DbPromise.run(
      db,
      `UPDATE partner_commission_transactions 
             SET status = 'CANCELLED', notes = COALESCE(notes, '') || '. Cancelled: ' || ?, updated_at = NOW()
             WHERE id = ? AND status IN ('PENDING', 'APPROVED')`,
      [reason, commissionId]
    );

    if (result.changes && result.changes > 0) {
      logger.info(
        `[PartnerCommissionService] Cancelled commission ${commissionId} by ${cancelledBy}`
      );
    }

    return (result.changes || 0) > 0;
  } catch (err: any) {
    logger.error('[PartnerCommissionService] Error cancelling commission:', err);
    return false;
  }
}

// ==========================================
// EARNINGS & REPORTING
// ==========================================

/**
 * Get earnings summary for a partner
 */
export async function getEarningsSummary(partnerOrgId: string): Promise<EarningsSummary> {
  try {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

    const stats = await DbPromise.get<{
      total_pending: number;
      total_approved: number;
      total_paid: number;
      ready_for_payout: number;
      this_month: number;
      this_month_count: number;
      last_month: number;
    }>(
      db,
      `SELECT 
                COALESCE(SUM(commission_amount) FILTER (WHERE status = 'PENDING'), 0) as total_pending,
                COALESCE(SUM(commission_amount) FILTER (WHERE status = 'APPROVED'), 0) as total_approved,
                COALESCE(SUM(commission_amount) FILTER (WHERE status = 'PAID'), 0) as total_paid,
                COALESCE(SUM(commission_amount) FILTER (WHERE status = 'APPROVED' AND payout_id IS NULL), 0) as ready_for_payout,
                COALESCE(SUM(commission_amount) FILTER (WHERE transaction_date >= ? AND status != 'CANCELLED'), 0) as this_month,
                COUNT(*) FILTER (WHERE transaction_date >= ? AND status != 'CANCELLED') as this_month_count,
                COALESCE(SUM(commission_amount) FILTER (WHERE transaction_date >= ? AND transaction_date <= ? AND status != 'CANCELLED'), 0) as last_month
             FROM partner_commission_transactions 
             WHERE partner_org_id = ?`,
      [thisMonthStart, thisMonthStart, lastMonthStart, lastMonthEnd, partnerOrgId]
    );

    const totalPending = toNumber(stats?.total_pending);
    const totalApproved = toNumber(stats?.total_approved);
    const totalPaid = toNumber(stats?.total_paid);
    const thisMonth = toNumber(stats?.this_month);
    const thisMonthCount = toNumber(stats?.this_month_count);
    const lastMonth = toNumber(stats?.last_month);
    const readyForPayout = toNumber(stats?.ready_for_payout);
    const totalEarned = totalPending + totalApproved + totalPaid;

    return {
      totalEarned,
      totalPending,
      totalApproved,
      totalPaid,
      thisMonth,
      thisMonthCount,
      lastMonth,
      readyForPayout,
      currency: 'EUR',
    };
  } catch (err: any) {
    logger.error('[PartnerCommissionService] Error getting earnings summary:', err);
    return {
      totalEarned: 0,
      totalPending: 0,
      totalApproved: 0,
      totalPaid: 0,
      thisMonth: 0,
      thisMonthCount: 0,
      lastMonth: 0,
      readyForPayout: 0,
      currency: 'EUR',
    };
  }
}

// ==========================================
// PAYOUT OPERATIONS
// ==========================================

/**
 * Request a payout (partner action)
 */
export async function requestPayout(params: PayoutRequest): Promise<Payout | null> {
  const { partnerOrgId, payoutAccountId, requestedBy, notes } = params;

  try {
    // Get approved commissions not yet paid
    const approvedCommissions = await DbPromise.all<{
      id: string;
      commission_amount: number;
      currency: string;
      transaction_date: string;
    }>(
      db,
      `SELECT id, commission_amount, currency, transaction_date
             FROM partner_commission_transactions 
             WHERE partner_org_id = ? AND status = 'APPROVED' AND payout_id IS NULL
             ORDER BY transaction_date`,
      [partnerOrgId]
    );

    if (approvedCommissions.length === 0) {
      logger.warn(`[PartnerCommissionService] No approved commissions for payout: ${partnerOrgId}`);
      return null;
    }

    // Calculate totals
    const grossAmount = approvedCommissions.reduce(
      (sum, c) => sum + Number(c.commission_amount || 0),
      0
    );
    const fees = Math.max(grossAmount * 0.01, 0); // 1% fee, minimum €0
    const netAmount = grossAmount - fees;

    // Get payout threshold
    const partner = await DbPromise.get<{ payout_threshold: number; payout_method: string }>(
      db,
      `SELECT payout_threshold, payout_method FROM partner_organizations WHERE id = ?`,
      [partnerOrgId]
    );

    const threshold = partner?.payout_threshold || 100;
    if (netAmount < threshold) {
      logger.warn(
        `[PartnerCommissionService] Payout amount €${netAmount} below threshold €${threshold}`
      );
      return null;
    }

    // Determine period
    const periodStart = toIsoDateString(approvedCommissions[0].transaction_date);
    const periodEnd = toIsoDateString(
      approvedCommissions[approvedCommissions.length - 1].transaction_date
    );

    // Create payout record
    const payoutId = uuidv4();
    const now = new Date().toISOString();

    await DbPromise.run(
      db,
      `INSERT INTO partner_payouts 
             (id, partner_org_id, payout_account_id, payout_period_start, payout_period_end,
              gross_amount, fees, net_amount, currency, transaction_count, status,
              payout_method, requested_by, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'EUR', ?, 'PENDING', ?, ?, ?)`,
      [
        payoutId,
        partnerOrgId,
        payoutAccountId || null,
        periodStart,
        periodEnd,
        grossAmount,
        fees,
        netAmount,
        approvedCommissions.length,
        partner?.payout_method || 'BANK_TRANSFER',
        requestedBy || null,
        notes || null,
      ]
    );

    // Link commissions to payout
    const commissionIds = approvedCommissions.map((c) => c.id);
    const placeholders = commissionIds.map(() => '?').join(', ');
    await DbPromise.run(
      db,
      `UPDATE partner_commission_transactions 
             SET payout_id = ?, updated_at = NOW()
             WHERE id IN (${placeholders})`,
      [payoutId, ...commissionIds]
    );

    logger.info(
      `[PartnerCommissionService] Created payout request: €${netAmount} for partner ${partnerOrgId}`
    );

    return {
      id: payoutId,
      partnerOrgId,
      payoutAccountId,
      periodStart,
      periodEnd,
      grossAmount,
      fees,
      taxWithheld: 0,
      netAmount,
      currency: 'EUR',
      transactionCount: approvedCommissions.length,
      status: 'PENDING',
      payoutMethod: partner?.payout_method || 'BANK_TRANSFER',
      requestedAt: now,
      requestedBy,
      notes,
      createdAt: now,
    };
  } catch (err: any) {
    logger.error('[PartnerCommissionService] Error requesting payout:', err);
    return null;
  }
}

/**
 * Get payouts for a partner
 */
export async function getPayouts(
  partnerOrgId: string,
  options: { status?: PayoutStatus; limit?: number; offset?: number } = {}
): Promise<Payout[]> {
  const { status, limit = 50, offset = 0 } = options;

  let query = `SELECT * FROM partner_payouts WHERE partner_org_id = ?`;
  const params: any[] = [partnerOrgId];

  if (status) {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY requested_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  try {
    const rows = await DbPromise.all<PayoutRow>(db, query, params);

    return rows.map((row) => ({
      id: row.id,
      partnerOrgId: row.partner_org_id,
      payoutAccountId: row.payout_account_id || undefined,
      periodStart: row.payout_period_start,
      periodEnd: row.payout_period_end,
      grossAmount: Number(row.gross_amount ?? 0),
      fees: Number(row.fees ?? 0),
      taxWithheld: Number(row.tax_withheld ?? 0),
      netAmount: Number(row.net_amount ?? 0),
      currency: row.currency,
      transactionCount: row.transaction_count,
      status: row.status as PayoutStatus,
      payoutMethod: row.payout_method || undefined,
      payoutReference: row.payout_reference || undefined,
      requestedAt: row.requested_at,
      requestedBy: row.requested_by || undefined,
      processedAt: row.processed_at || undefined,
      completedAt: row.completed_at || undefined,
      failureReason: row.failure_reason || undefined,
      notes: row.notes || undefined,
      createdAt: row.created_at,
    }));
  } catch (err: any) {
    logger.error('[PartnerCommissionService] Error getting payouts:', err);
    return [];
  }
}

/**
 * Process a payout (admin/system action)
 */
export async function processPayout(
  payoutId: string,
  processedBy: string,
  options?: {
    payoutReference?: string;
    externalPayoutId?: string;
    dualControlConfirmed?: boolean;
    reason?: string;
  }
): Promise<boolean> {
  try {
    const payout = await getPayoutRowById(payoutId);
    if (!payout) return false;
    const result = await DbPromise.run(
      db,
      `UPDATE partner_payouts 
             SET status = 'PROCESSING', processed_at = NOW(), processed_by = ?,
                 payout_reference = COALESCE(?, payout_reference),
                 external_payout_id = COALESCE(?, external_payout_id),
                 updated_at = NOW()
             WHERE id = ? AND status = 'PENDING'`,
      [processedBy, options?.payoutReference || null, options?.externalPayoutId || null, payoutId]
    );

    const changed = (result.changes || 0) > 0;
    if (changed) {
      await PartnerProgramLedgerService.appendEntry({
        partnerOrgId: payout.partner_org_id,
        entryType: 'payout.approved',
        ruleVersion: 'partner-payout-approval-v1',
        amount: Number(payout.net_amount || 0),
        currency: payout.currency || 'EUR',
        actor: 'operator',
        actorId: processedBy || null,
        idempotencyKey: `partner-payout-approved:${payoutId}`,
        sourceRef: {
          payoutId,
          payoutReference: options?.payoutReference || payout.payout_reference || null,
          providerTxId: options?.externalPayoutId || payout.external_payout_id || null,
          elevatedRiskConfirmed: Boolean(options?.dualControlConfirmed),
        },
        note: options?.reason || 'Payout approved for processing',
      });
    }

    return changed;
  } catch (err: any) {
    logger.error('[PartnerCommissionService] Error processing payout:', err);
    return false;
  }
}

/**
 * Complete a payout (admin/system action)
 */
export async function completePayout(
  payoutId: string,
  options?: {
    payoutReference?: string;
    dualControlConfirmed?: boolean;
    completedBy?: string;
    reason?: string;
  }
): Promise<boolean> {
  try {
    const payout = await getPayoutRowById(payoutId);
    if (!payout) return false;
    // Update payout status
    const result = await DbPromise.run(
      db,
      `UPDATE partner_payouts 
             SET status = 'COMPLETED', completed_at = NOW(),
                 payout_reference = COALESCE(?, payout_reference),
                 updated_at = NOW()
             WHERE id = ? AND status = 'PROCESSING'`,
      [options?.payoutReference || null, payoutId]
    );

    if (result.changes && result.changes > 0) {
      // Mark all linked commissions as paid
      await DbPromise.run(
        db,
        `UPDATE partner_commission_transactions 
                 SET status = 'PAID', updated_at = NOW()
                 WHERE payout_id = ?`,
        [payoutId]
      );

      logger.info(`[PartnerCommissionService] Completed payout ${payoutId}`);

      const providerTxId =
        payout.external_payout_id || options?.payoutReference || payout.payout_reference;
      await PartnerProgramLedgerService.appendEntry({
        partnerOrgId: payout.partner_org_id,
        entryType: 'payout.executed',
        ruleVersion: 'partner-payout-execution-v1',
        amount: Number(payout.net_amount || 0),
        currency: payout.currency || 'EUR',
        actor: 'operator',
        actorId: options?.completedBy || null,
        idempotencyKey: `partner-payout-executed:${payoutId}`,
        sourceRef: {
          payoutId,
          payoutReference: options?.payoutReference || payout.payout_reference || null,
          providerTxId: providerTxId || null,
          elevatedRiskConfirmed: Boolean(options?.dualControlConfirmed),
        },
        note: options?.reason || 'Payout executed by provider',
      });
      await PartnerProgramLedgerService.appendEntry({
        partnerOrgId: payout.partner_org_id,
        entryType: 'payout.reconciled',
        ruleVersion: 'partner-payout-reconciliation-v1',
        amount: Number(payout.net_amount || 0),
        currency: payout.currency || 'EUR',
        actor: 'operator',
        actorId: options?.completedBy || null,
        idempotencyKey: `partner-payout-reconciled:${payoutId}`,
        sourceRef: {
          payoutId,
          payoutReference: options?.payoutReference || payout.payout_reference || null,
          providerTxId: providerTxId || null,
        },
        note: 'Payout completed and reconciled in governed ledger',
      });
      try {
        await PartnerProgramLedgerService.transitionLifecycle({
          partnerOrgId: payout.partner_org_id,
          toPhase: 'earn',
          actor: 'operator',
          actorId: options?.completedBy || null,
          reason: 'Payout completed',
        });
      } catch (error) {
        logger.warn(
          '[PartnerCommissionService] Could not transition payout lifecycle back to earn',
          error
        );
      }
    }

    return (result.changes || 0) > 0;
  } catch (err: any) {
    logger.error('[PartnerCommissionService] Error completing payout:', err);
    return false;
  }
}

/**
 * Fail a payout (admin/system action)
 */
export async function failPayout(payoutId: string, reason: string): Promise<boolean> {
  try {
    const payout = await getPayoutRowById(payoutId);
    if (!payout) return false;
    // Update payout status
    const result = await DbPromise.run(
      db,
      `UPDATE partner_payouts 
             SET status = 'FAILED', failure_reason = ?, updated_at = NOW()
             WHERE id = ? AND status IN ('PENDING', 'PROCESSING')`,
      [reason, payoutId]
    );

    if (result.changes && result.changes > 0) {
      // Unlink commissions from failed payout (they can be included in next payout)
      await DbPromise.run(
        db,
        `UPDATE partner_commission_transactions 
                 SET payout_id = NULL, updated_at = NOW()
                 WHERE payout_id = ?`,
        [payoutId]
      );

      logger.warn(`[PartnerCommissionService] Failed payout ${payoutId}: ${reason}`);
      await PartnerProgramLedgerService.appendEntry({
        partnerOrgId: payout.partner_org_id,
        entryType: 'payout.failed',
        ruleVersion: 'partner-payout-failure-v1',
        amount: Number(payout.net_amount || 0),
        currency: payout.currency || 'EUR',
        actor: 'operator',
        idempotencyKey: `partner-payout-failed:${payoutId}`,
        sourceRef: {
          payoutId,
          payoutReference: payout.payout_reference || null,
          providerTxId: payout.external_payout_id || null,
        },
        note: reason,
      });
      try {
        await PartnerProgramLedgerService.transitionLifecycle({
          partnerOrgId: payout.partner_org_id,
          toPhase: 'earn',
          actor: 'operator',
          reason: 'Payout failed',
        });
      } catch (error) {
        logger.warn(
          '[PartnerCommissionService] Could not transition failed payout lifecycle back to earn',
          error
        );
      }
    }

    return (result.changes || 0) > 0;
  } catch (err: any) {
    logger.error('[PartnerCommissionService] Error failing payout:', err);
    return false;
  }
}

// ==========================================
// SUPERADMIN OPERATIONS
// ==========================================

/**
 * Get all pending commissions across all partners (SuperAdmin)
 */
export async function getAllPendingCommissions(
  options: { limit?: number; offset?: number } = {}
): Promise<(CommissionTransaction & { partnerName?: string })[]> {
  const { limit = 100, offset = 0 } = options;

  try {
    const rows = await DbPromise.all<CommissionRow & { partner_name?: string }>(
      db,
      `SELECT pct.*, po.name as partner_name, o.name as org_name
             FROM partner_commission_transactions pct
             LEFT JOIN partner_organizations po ON po.id = pct.partner_org_id
             LEFT JOIN organizations o ON o.id = pct.organization_id
             WHERE pct.status = 'PENDING'
             ORDER BY pct.transaction_date DESC
             LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return rows.map((row) => ({
      id: row.id,
      partnerOrgId: row.partner_org_id,
      partnerName: row.partner_name,
      attributionId: row.attribution_id || undefined,
      organizationId: row.organization_id,
      organizationName: row.org_name,
      transactionType: row.transaction_type as TransactionType,
      transactionDate: row.transaction_date,
      grossAmount: Number(row.gross_amount ?? 0),
      commissionRate: Number(row.commission_rate ?? 0),
      commissionAmount: Number(row.commission_amount ?? 0),
      currency: row.currency,
      status: row.status as TransactionStatus,
      createdAt: row.created_at,
    }));
  } catch (err: any) {
    logger.error('[PartnerCommissionService] Error getting pending commissions:', err);
    return [];
  }
}

/**
 * Get all pending payouts across all partners (SuperAdmin)
 */
export async function getAllPendingPayouts(
  options: { limit?: number; offset?: number } = {}
): Promise<(Payout & { partnerName?: string })[]> {
  const { limit = 100, offset = 0 } = options;

  try {
    const rows = await DbPromise.all<PayoutRow & { partner_name?: string }>(
      db,
      `SELECT pp.*, po.name as partner_name
             FROM partner_payouts pp
             LEFT JOIN partner_organizations po ON po.id = pp.partner_org_id
             WHERE pp.status IN ('PENDING', 'PROCESSING')
             ORDER BY pp.requested_at DESC
             LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    return rows.map((row) => ({
      id: row.id,
      partnerOrgId: row.partner_org_id,
      partnerName: row.partner_name,
      payoutAccountId: row.payout_account_id || undefined,
      periodStart: row.payout_period_start,
      periodEnd: row.payout_period_end,
      grossAmount: Number(row.gross_amount ?? 0),
      fees: Number(row.fees ?? 0),
      taxWithheld: Number(row.tax_withheld ?? 0),
      netAmount: Number(row.net_amount ?? 0),
      currency: row.currency,
      transactionCount: row.transaction_count,
      status: row.status as PayoutStatus,
      payoutMethod: row.payout_method || undefined,
      requestedAt: row.requested_at,
      createdAt: row.created_at,
    }));
  } catch (err: any) {
    logger.error('[PartnerCommissionService] Error getting pending payouts:', err);
    return [];
  }
}

/**
 * Get partner settlements summary (SuperAdmin)
 */
export async function getSettlementsSummary(): Promise<{
  totalPendingCommissions: number;
  totalPendingPayouts: number;
  pendingCommissionAmount: number;
  pendingPayoutAmount: number;
  thisMonthCommissions: number;
  thisMonthPayouts: number;
}> {
  try {
    const thisMonthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1
    ).toISOString();

    const stats = await DbPromise.get<{
      pending_commissions: number;
      pending_commission_amount: number;
      pending_payouts: number;
      pending_payout_amount: number;
      this_month_commissions: number;
      this_month_payouts: number;
    }>(
      db,
      `SELECT 
                (SELECT COUNT(*) FROM partner_commission_transactions WHERE status = 'PENDING') as pending_commissions,
                (SELECT COALESCE(SUM(commission_amount), 0) FROM partner_commission_transactions WHERE status = 'PENDING') as pending_commission_amount,
                (SELECT COUNT(*) FROM partner_payouts WHERE status IN ('PENDING', 'PROCESSING')) as pending_payouts,
                (SELECT COALESCE(SUM(net_amount), 0) FROM partner_payouts WHERE status IN ('PENDING', 'PROCESSING')) as pending_payout_amount,
                (SELECT COALESCE(SUM(commission_amount), 0) FROM partner_commission_transactions WHERE created_at >= ?) as this_month_commissions,
                (SELECT COALESCE(SUM(net_amount), 0) FROM partner_payouts WHERE status = 'COMPLETED' AND completed_at >= ?) as this_month_payouts`,
      [thisMonthStart, thisMonthStart]
    );

    return {
      totalPendingCommissions: stats?.pending_commissions || 0,
      totalPendingPayouts: stats?.pending_payouts || 0,
      pendingCommissionAmount: stats?.pending_commission_amount || 0,
      pendingPayoutAmount: stats?.pending_payout_amount || 0,
      thisMonthCommissions: stats?.this_month_commissions || 0,
      thisMonthPayouts: stats?.this_month_payouts || 0,
    };
  } catch (err: any) {
    logger.error('[PartnerCommissionService] Error getting settlements summary:', err);
    return {
      totalPendingCommissions: 0,
      totalPendingPayouts: 0,
      pendingCommissionAmount: 0,
      pendingPayoutAmount: 0,
      thisMonthCommissions: 0,
      thisMonthPayouts: 0,
    };
  }
}

// ==========================================
// EXPORTS
// ==========================================

const PartnerCommissionService = {
  TRANSACTION_TYPES,
  TRANSACTION_STATUS,
  PAYOUT_STATUS,
  setDependencies,
  createCommission,
  getCommissions,
  approveCommissions,
  cancelCommission,
  getEarningsSummary,
  requestPayout,
  getPayouts,
  processPayout,
  completePayout,
  failPayout,
  getAllPendingCommissions,
  getAllPendingPayouts,
  getSettlementsSummary,
};

export default PartnerCommissionService;
