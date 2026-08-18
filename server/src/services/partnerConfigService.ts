/**
 * Partner Configuration Service
 *
 * Manages partner program configuration:
 * - Commission rates per tier
 * - Discount settings for referred clients
 * - Payout settings and thresholds
 *
 * @module PartnerConfigService
 */

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { assertPartnerEconomicsOperationAllowed } from './partnerEconomicsPolicy.js';

// ==========================================
// TYPES
// ==========================================

export interface CommissionRate {
  tier: string;
  tierName: string;
  rate: number;
  minRevenue: number;
  color: string;
}

export interface DiscountConfig {
  id?: string;
  discountType: 'PERCENTAGE' | 'FLAT';
  discountValue: number;
  durationMonths: number;
  maxDiscountPerMonth?: number;
  tierOverrides?: Record<string, number>;
  isActive: boolean;
}

export interface PayoutSettings {
  minimumThreshold: number;
  payoutSchedule: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  processingFeePercent: number;
  autoPayoutEnabled: boolean;
  paymentMethods: string[];
}

// ==========================================
// SERVICE DEPENDENCIES
// ==========================================

let db: IDatabase;

export function setDependencies(newDeps: { db?: IDatabase } = {}): void {
  if (newDeps.db) {
    db = newDeps.db;
  }
}

function ensureDb(): IDatabase {
  if (!db) {
    db = getDatabase();
  }
  return db;
}

// ==========================================
// COMMISSION RATES
// ==========================================

/**
 * Get all commission rates by tier
 */
export async function getCommissionRates(): Promise<CommissionRate[]> {
  const database = ensureDb();

  try {
    const rows = await DbPromise.all<any>(
      database,
      `SELECT tier, tier_name, rate, min_revenue, color
             FROM partner_commission_rates
             ORDER BY min_revenue ASC`
    );

    return rows.map((row) => ({
      tier: row.tier,
      tierName: row.tier_name,
      rate: row.rate,
      minRevenue: row.min_revenue || 0,
      color: row.color || 'bg-slate-500',
    }));
  } catch (err: any) {
    logger.error('[PartnerConfigService] Error fetching commission rates:', err);
    throw err;
  }
}

/**
 * Update commission rate for a tier
 */
export async function updateCommissionRate(tier: string, rate: number): Promise<boolean> {
  // AMD-PRT-ECONOMICS-002: fail closed BEFORE any SQL, transaction, advisory
  // lock or client acquisition, so a refusal can never leave residue.
  assertPartnerEconomicsOperationAllowed('commission');
  const database = ensureDb();

  if (rate < 0 || rate > 100) {
    throw new Error('Rate must be between 0 and 100');
  }

  try {
    await DbPromise.run(
      database,
      `UPDATE partner_commission_rates
             SET rate = ?, updated_at = datetime('now')
             WHERE tier = ?`,
      [rate, tier]
    );

    logger.info(`[PartnerConfigService] Updated commission rate for ${tier} to ${rate}%`);
    return true;
  } catch (err: any) {
    logger.error('[PartnerConfigService] Error updating commission rate:', err);
    throw err;
  }
}

/**
 * Get commission rate for a specific tier
 */
export async function getCommissionRateForTier(tier: string): Promise<number> {
  const database = ensureDb();

  try {
    const row = await DbPromise.get<{ rate: number }>(
      database,
      `SELECT rate FROM partner_commission_rates WHERE tier = ?`,
      [tier]
    );

    return row?.rate || 10; // Default to 10% if not found
  } catch (err: any) {
    logger.error('[PartnerConfigService] Error fetching commission rate for tier:', err);
    return 10;
  }
}

// ==========================================
// DISCOUNT CONFIGURATION
// ==========================================

/**
 * Get current discount configuration
 */
export async function getDiscountConfig(): Promise<DiscountConfig | null> {
  const database = ensureDb();

  try {
    const row = await DbPromise.get<any>(
      database,
      `SELECT id, discount_type, discount_value, duration_months, 
                    max_discount_per_month, tier_overrides, is_active
             FROM partner_discount_config
             WHERE is_active = 1
             ORDER BY created_at DESC
             LIMIT 1`
    );

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      discountType: row.discount_type,
      discountValue: row.discount_value,
      durationMonths: row.duration_months,
      maxDiscountPerMonth: row.max_discount_per_month,
      tierOverrides: row.tier_overrides ? JSON.parse(row.tier_overrides) : {},
      isActive: row.is_active === 1,
    };
  } catch (err: any) {
    logger.error('[PartnerConfigService] Error fetching discount config:', err);
    throw err;
  }
}

/**
 * Update discount configuration
 */
export async function updateDiscountConfig(config: Partial<DiscountConfig>): Promise<boolean> {
  // AMD-PRT-ECONOMICS-002: fail closed BEFORE any SQL, transaction, advisory
  // lock or client acquisition, so a refusal can never leave residue.
  assertPartnerEconomicsOperationAllowed('discount');
  const database = ensureDb();

  try {
    // Get current config
    const current = await getDiscountConfig();

    if (!current) {
      // Create new config
      await DbPromise.run(
        database,
        `INSERT INTO partner_discount_config 
                 (id, discount_type, discount_value, duration_months, max_discount_per_month, tier_overrides, is_active)
                 VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?)`,
        [
          config.discountType || 'PERCENTAGE',
          config.discountValue || 15,
          config.durationMonths || 12,
          config.maxDiscountPerMonth || null,
          config.tierOverrides ? JSON.stringify(config.tierOverrides) : '{}',
          config.isActive !== false ? 1 : 0,
        ]
      );
    } else {
      // Update existing config
      await DbPromise.run(
        database,
        `UPDATE partner_discount_config
                 SET discount_type = COALESCE(?, discount_type),
                     discount_value = COALESCE(?, discount_value),
                     duration_months = COALESCE(?, duration_months),
                     max_discount_per_month = ?,
                     tier_overrides = COALESCE(?, tier_overrides),
                     is_active = COALESCE(?, is_active),
                     updated_at = datetime('now')
                 WHERE id = ?`,
        [
          config.discountType,
          config.discountValue,
          config.durationMonths,
          config.maxDiscountPerMonth,
          config.tierOverrides ? JSON.stringify(config.tierOverrides) : null,
          config.isActive !== undefined ? (config.isActive ? 1 : 0) : null,
          current.id,
        ]
      );
    }

    logger.info('[PartnerConfigService] Updated discount configuration');
    return true;
  } catch (err: any) {
    logger.error('[PartnerConfigService] Error updating discount config:', err);
    throw err;
  }
}

// ==========================================
// PAYOUT SETTINGS
// ==========================================

/**
 * Get payout settings
 */
export async function getPayoutSettings(): Promise<PayoutSettings | null> {
  const database = ensureDb();

  try {
    const row = await DbPromise.get<any>(
      database,
      `SELECT minimum_threshold, payout_schedule, processing_fee_percent,
                    auto_payout_enabled, payment_methods
             FROM partner_payout_settings
             ORDER BY created_at DESC
             LIMIT 1`
    );

    if (!row) {
      return null;
    }

    return {
      minimumThreshold: row.minimum_threshold,
      payoutSchedule: row.payout_schedule,
      processingFeePercent: row.processing_fee_percent,
      autoPayoutEnabled: row.auto_payout_enabled === 1,
      paymentMethods: row.payment_methods ? JSON.parse(row.payment_methods) : ['BANK_TRANSFER'],
    };
  } catch (err: any) {
    logger.error('[PartnerConfigService] Error fetching payout settings:', err);
    throw err;
  }
}

/**
 * Update payout settings
 */
export async function updatePayoutSettings(settings: Partial<PayoutSettings>): Promise<boolean> {
  // AMD-PRT-ECONOMICS-002: fail closed BEFORE any SQL, transaction, advisory
  // lock or client acquisition, so a refusal can never leave residue.
  assertPartnerEconomicsOperationAllowed('payout_settings');
  const database = ensureDb();

  try {
    // Get current settings
    const current = await getPayoutSettings();

    if (!current) {
      // Create new settings
      await DbPromise.run(
        database,
        `INSERT INTO partner_payout_settings 
                 (id, minimum_threshold, payout_schedule, processing_fee_percent, auto_payout_enabled, payment_methods)
                 VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?)`,
        [
          settings.minimumThreshold || 100,
          settings.payoutSchedule || 'MONTHLY',
          settings.processingFeePercent || 1,
          settings.autoPayoutEnabled ? 1 : 0,
          settings.paymentMethods ? JSON.stringify(settings.paymentMethods) : '["BANK_TRANSFER"]',
        ]
      );
    } else {
      // Update existing settings
      await DbPromise.run(
        database,
        `UPDATE partner_payout_settings
                 SET minimum_threshold = COALESCE(?, minimum_threshold),
                     payout_schedule = COALESCE(?, payout_schedule),
                     processing_fee_percent = COALESCE(?, processing_fee_percent),
                     auto_payout_enabled = COALESCE(?, auto_payout_enabled),
                     payment_methods = COALESCE(?, payment_methods),
                     updated_at = datetime('now')`,
        [
          settings.minimumThreshold,
          settings.payoutSchedule,
          settings.processingFeePercent,
          settings.autoPayoutEnabled !== undefined ? (settings.autoPayoutEnabled ? 1 : 0) : null,
          settings.paymentMethods ? JSON.stringify(settings.paymentMethods) : null,
        ]
      );
    }

    logger.info('[PartnerConfigService] Updated payout settings');
    return true;
  } catch (err: any) {
    logger.error('[PartnerConfigService] Error updating payout settings:', err);
    throw err;
  }
}

// ==========================================
// ORGANIZATION DISCOUNTS
// ==========================================

/**
 * Create a discount for an organization
 */
export async function createOrganizationDiscount(
  organizationId: string,
  partnerOrgId: string,
  discountType: 'PERCENTAGE' | 'FLAT',
  discountValue: number,
  durationMonths: number
): Promise<string> {
  const database = ensureDb();

  try {
    const id = crypto.randomUUID();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + durationMonths);

    await DbPromise.run(
      database,
      `INSERT INTO organization_discounts 
             (id, organization_id, partner_org_id, discount_type, discount_value, start_date, end_date, status)
             VALUES (?, ?, ?, ?, ?, datetime('now'), ?, 'ACTIVE')`,
      [id, organizationId, partnerOrgId, discountType, discountValue, endDate.toISOString()]
    );

    logger.info(
      `[PartnerConfigService] Created discount for org ${organizationId} from partner ${partnerOrgId}`
    );
    return id;
  } catch (err: any) {
    logger.error('[PartnerConfigService] Error creating organization discount:', err);
    throw err;
  }
}

/**
 * Get active discount for an organization
 */
export async function getOrganizationActiveDiscount(organizationId: string): Promise<{
  discountType: string;
  discountValue: number;
  endDate: string;
  partnerOrgId: string;
} | null> {
  const database = ensureDb();

  try {
    const row = await DbPromise.get<any>(
      database,
      `SELECT discount_type, discount_value, end_date, partner_org_id
             FROM organization_discounts
             WHERE organization_id = ? 
               AND status = 'ACTIVE'
               AND date(end_date) > date('now')
             ORDER BY created_at DESC
             LIMIT 1`,
      [organizationId]
    );

    if (!row) {
      return null;
    }

    return {
      discountType: row.discount_type,
      discountValue: row.discount_value,
      endDate: row.end_date,
      partnerOrgId: row.partner_org_id,
    };
  } catch (err: any) {
    logger.error('[PartnerConfigService] Error fetching organization discount:', err);
    return null;
  }
}

/**
 * Cancel organization discount
 */
export async function cancelOrganizationDiscount(
  organizationId: string,
  partnerOrgId: string
): Promise<boolean> {
  const database = ensureDb();

  try {
    await DbPromise.run(
      database,
      `UPDATE organization_discounts
             SET status = 'CANCELLED', updated_at = datetime('now')
             WHERE organization_id = ? AND partner_org_id = ? AND status = 'ACTIVE'`,
      [organizationId, partnerOrgId]
    );

    logger.info(`[PartnerConfigService] Cancelled discount for org ${organizationId}`);
    return true;
  } catch (err: any) {
    logger.error('[PartnerConfigService] Error cancelling discount:', err);
    throw err;
  }
}

export default {
  setDependencies,
  getCommissionRates,
  updateCommissionRate,
  getCommissionRateForTier,
  getDiscountConfig,
  updateDiscountConfig,
  getPayoutSettings,
  updatePayoutSettings,
  createOrganizationDiscount,
  getOrganizationActiveDiscount,
  cancelOrganizationDiscount,
};
