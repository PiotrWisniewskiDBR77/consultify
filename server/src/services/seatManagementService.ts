/**
 * Seat Management Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/services/seatManagementService.js (CommonJS) to TypeScript (ES Modules)
 * Handles seat purchasing, auto-adding, releasing, and seat pool management
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

interface SeatConfiguration {
  id?: string;
  organization_id: string;
  base_seats_included?: number;
  additional_seats_purchased?: number;
  total_seats_available?: number;
  seats_used?: number;
  billing_model?: string;
  seat_price_monthly?: number;
  auto_add_seats_on_invite?: number;
  auto_add_seats_threshold?: number;
  seat_pool_enabled?: number;
  seats_included?: number;
  allow_seat_pooling?: number;
  max_seats?: number;
  utilization_percent?: string;
  seats_remaining?: number;
}

interface PurchaseSeatsResult {
  transactionId: string;
  seatsPurchased: number;
  totalAmount: number;
  newTotalSeats: number;
}

interface AutoAddSeatResult {
  autoAdded: boolean;
  reason?: string;
  transactionId?: string;
}

interface ReleaseSeatResult {
  released: boolean;
  reason?: string;
  transactionId?: string;
}

interface UpdateSeatCountResult {
  seatsUsed: number;
}

interface ToggleAutoAddResult {
  enabled: boolean;
  threshold: number;
}

interface SeatConfigurationRow extends SeatConfiguration {
  seats_included?: number;
  seat_price_monthly?: number;
  billing_model?: string;
  allow_seat_pooling?: number;
  max_seats?: number;
}

interface PlanRow {
  seats_included?: number;
  seat_price_monthly?: number;
  billing_model?: string;
  allow_seat_pooling?: number;
  max_seats?: number;
}

interface UserCountRow {
  count: number;
}

interface SeatTransactionRow {
  id: string;
  organization_id: string;
  transaction_type: string;
  seats_count: number;
  unit_price?: number;
  total_amount?: number;
  billing_period_start?: string;
  billing_period_end?: string;
  triggered_by?: string;
  triggered_by_user_id?: string;
  reason?: string;
  created_at: string;
  triggered_by_email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

// ==========================================
// SERVICE
// ==========================================

let db: IDatabase = getDatabase();

/**
 * Set database instance (for testing)
 */
export function setDependencies(newDeps: { db?: IDatabase } = {}): void {
  if (newDeps.db) {
    db = newDeps.db;
  }
}

/**
 * Get seat configuration for an organization
 */
export async function getSeatConfiguration(orgId: string): Promise<SeatConfiguration> {
  const row = await DbPromise.get<SeatConfigurationRow>(
    db,
    `SELECT os.*, sp.seats_included, sp.seat_price_monthly, sp.billing_model, sp.allow_seat_pooling, sp.max_seats
         FROM organization_seats os
         LEFT JOIN organization_billing ob ON os.organization_id = ob.organization_id
         LEFT JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
         WHERE os.organization_id = ?`,
    [orgId]
  );

  if (!row) {
    // Initialize seat configuration if it doesn't exist
    await initializeSeatConfiguration(orgId);
    return getSeatConfiguration(orgId);
  }

  // Calculate total seats available
  const totalAvailable = (row.base_seats_included || 0) + (row.additional_seats_purchased || 0);
  return {
    ...row,
    total_seats_available: totalAvailable,
    seats_remaining: Math.max(0, totalAvailable - (row.seats_used || 0)),
    utilization_percent:
      totalAvailable > 0 ? (((row.seats_used || 0) / totalAvailable) * 100).toFixed(2) : '0',
  };
}

/**
 * Initialize seat configuration for an organization
 */
export async function initializeSeatConfiguration(orgId: string): Promise<void> {
  // Get plan details
  const planRow = await DbPromise.get<PlanRow>(
    db,
    `SELECT sp.seats_included, sp.seat_price_monthly, sp.billing_model, sp.allow_seat_pooling, sp.max_seats
         FROM organization_billing ob
         LEFT JOIN subscription_plans sp ON ob.subscription_plan_id = sp.id
         WHERE ob.organization_id = ?`,
    [orgId]
  );

  const seatsIncluded = planRow?.seats_included || 0;
  const seatPrice = planRow?.seat_price_monthly || 0;
  const billingModel = planRow?.billing_model || 'subscription';
  const allowPooling = planRow?.allow_seat_pooling || 0;

  // Count current active users
  const userRow = await DbPromise.get<UserCountRow>(
    db,
    `SELECT COUNT(*) as count FROM users WHERE organization_id = ? AND status = 'active'`,
    [orgId]
  );

  const seatsUsed = userRow?.count || 0;

  const id = `seat-${uuidv4()}`;
  await DbPromise.run(
    db,
    `INSERT INTO organization_seats(
            id, organization_id, base_seats_included, additional_seats_purchased,
            total_seats_available, seats_used, billing_model, seat_price_monthly,
            auto_add_seats_on_invite, seat_pool_enabled
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      orgId,
      seatsIncluded,
      0,
      seatsIncluded,
      seatsUsed,
      billingModel,
      seatPrice,
      0,
      allowPooling ? 1 : 0,
    ]
  );
}

/**
 * Purchase additional seats
 */
export async function purchaseSeats(
  orgId: string,
  quantity: number,
  paymentMethodId: string | null,
  triggeredByUserId: string | null = null
): Promise<PurchaseSeatsResult> {
  const config = await getSeatConfiguration(orgId);
  const seatPrice = config.seat_price_monthly || 0;
  const totalAmount = seatPrice * quantity;

  // Check max seats limit if set
  if (config.max_seats && config.max_seats > 0) {
    const newTotal = (config.total_seats_available || 0) + quantity;
    if (newTotal > config.max_seats) {
      throw new Error(
        `Cannot purchase ${quantity} seats. Maximum seats limit is ${config.max_seats}`
      );
    }
  }

  const transactionId = `seat-txn-${uuidv4()}`;
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Create seat transaction
  await DbPromise.run(
    db,
    `INSERT INTO seat_transactions(
            id, organization_id, transaction_type, seats_count, unit_price, total_amount,
            billing_period_start, billing_period_end, triggered_by, triggered_by_user_id, reason
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      transactionId,
      orgId,
      'purchase',
      quantity,
      seatPrice,
      totalAmount,
      periodStart.toISOString(),
      periodEnd.toISOString(),
      'admin',
      triggeredByUserId,
      'Manual seat purchase',
    ]
  );

  // Update organization_seats
  await DbPromise.run(
    db,
    `UPDATE organization_seats SET
            additional_seats_purchased = additional_seats_purchased + ?,
            total_seats_available = total_seats_available + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = ?`,
    [quantity, quantity, orgId]
  );

  return {
    transactionId,
    seatsPurchased: quantity,
    totalAmount,
    newTotalSeats: (config.total_seats_available || 0) + quantity,
  };
}

/**
 * Auto-add seat on user invitation
 */
export async function autoAddSeatOnInvite(
  orgId: string,
  userId: string
): Promise<AutoAddSeatResult> {
  const config = await getSeatConfiguration(orgId);

  if (!config.auto_add_seats_on_invite) {
    return { autoAdded: false, reason: 'Auto-add disabled' };
  }

  // Check if we need to auto-add based on threshold
  const utilizationPercent = parseFloat(config.utilization_percent || '0');
  if (utilizationPercent < (config.auto_add_seats_threshold || 80)) {
    return { autoAdded: false, reason: 'Below threshold' };
  }

  // Check if we can add a user
  const canAdd = await canAddUser(orgId);
  if (!canAdd) {
    // Auto-purchase one seat
    const result = await purchaseSeats(orgId, 1, null, userId);

    // Record auto-add transaction
    const transactionId = `seat-txn-${uuidv4()}`;
    try {
      await DbPromise.run(
        db,
        `INSERT INTO seat_transactions(
                    id, organization_id, transaction_type, seats_count, unit_price, total_amount,
                    triggered_by, triggered_by_user_id, reason
                ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId,
          orgId,
          'auto_add',
          1,
          config.seat_price_monthly || 0,
          config.seat_price_monthly || 0,
          'auto',
          userId,
          'Auto-added on invitation',
        ]
      );
    } catch (err: any) {
      logger.error('Error recording auto-add transaction:', err);
    }

    return { autoAdded: true, transactionId: result.transactionId };
  } else {
    return { autoAdded: false, reason: 'Seats available' };
  }
}

/**
 * Release a seat (when user is removed)
 */
export async function releaseSeat(orgId: string, userId: string): Promise<ReleaseSeatResult> {
  const config = await getSeatConfiguration(orgId);

  // Only release if we have more seats used than base seats
  if ((config.seats_used || 0) <= (config.base_seats_included || 0)) {
    return { released: false, reason: 'No additional seats to release' };
  }

  const transactionId = `seat-txn-${uuidv4()}`;
  await DbPromise.run(
    db,
    `INSERT INTO seat_transactions(
            id, organization_id, transaction_type, seats_count,
            triggered_by, triggered_by_user_id, reason
        ) VALUES(?, ?, ?, ?, ?, ?, ?)`,
    [transactionId, orgId, 'release', -1, 'admin', userId, 'User removed']
  );

  // Update organization_seats
  await DbPromise.run(
    db,
    `UPDATE organization_seats SET
            additional_seats_purchased = MAX(0, additional_seats_purchased - 1),
            total_seats_available = MAX(base_seats_included, total_seats_available - 1),
            updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = ?`,
    [orgId]
  );

  return { released: true, transactionId };
}

/**
 * Check if a user can be added (seats available)
 */
export async function canAddUser(orgId: string): Promise<boolean> {
  const config = await getSeatConfiguration(orgId);
  const seatsRemaining = (config.total_seats_available || 0) - (config.seats_used || 0);
  return seatsRemaining > 0;
}

/**
 * Update seat count (recalculate seats_used from active users)
 */
export async function updateSeatCount(orgId: string): Promise<UpdateSeatCountResult> {
  const userRow = await DbPromise.get<UserCountRow>(
    db,
    `SELECT COUNT(*) as count FROM users WHERE organization_id = ? AND status = 'active'`,
    [orgId]
  );

  const seatsUsed = userRow?.count || 0;

  await DbPromise.run(
    db,
    `UPDATE organization_seats SET seats_used = ?, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ?`,
    [seatsUsed, orgId]
  );

  return { seatsUsed };
}

/**
 * Get seat transaction history
 */
export async function getSeatHistory(
  orgId: string,
  limit: number = 50
): Promise<SeatTransactionRow[]> {
  const rows = await DbPromise.all<SeatTransactionRow>(
    db,
    `SELECT st.*, u.email as triggered_by_email, u.first_name, u.last_name
         FROM seat_transactions st
         LEFT JOIN users u ON st.triggered_by_user_id = u.id
         WHERE st.organization_id = ?
         ORDER BY st.created_at DESC
         LIMIT ?`,
    [orgId, limit]
  );

  return rows || [];
}

/**
 * Toggle auto-add seats on invite
 */
export async function toggleAutoAddSeats(
  orgId: string,
  enabled: boolean,
  threshold: number = 80
): Promise<ToggleAutoAddResult> {
  await DbPromise.run(
    db,
    `UPDATE organization_seats SET
            auto_add_seats_on_invite = ?,
            auto_add_seats_threshold = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE organization_id = ?`,
    [enabled ? 1 : 0, threshold, orgId]
  );

  return { enabled, threshold };
}

// Default export for backward compatibility
const SeatManagementService = {
  setDependencies,
  getSeatConfiguration,
  initializeSeatConfiguration,
  purchaseSeats,
  autoAddSeatOnInvite,
  releaseSeat,
  canAddUser,
  updateSeatCount,
  getSeatHistory,
  toggleAutoAddSeats,
};

export default SeatManagementService;
