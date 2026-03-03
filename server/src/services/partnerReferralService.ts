/**
 * Partner Referral Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Complete referral management for partner program:
 * - Referral code generation and validation
 * - Click tracking and analytics
 * - Campaign link management
 * - Attribution creation and tracking
 *
 * @module PartnerReferralService
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

export const ATTRIBUTION_TYPES = {
  REFERRAL_LINK: 'REFERRAL_LINK',
  PROMO_CODE: 'PROMO_CODE',
  MANUAL: 'MANUAL',
  ACCESS_CODE: 'ACCESS_CODE',
  DEAL_REGISTRATION: 'DEAL_REGISTRATION',
} as const;

export type AttributionType = (typeof ATTRIBUTION_TYPES)[keyof typeof ATTRIBUTION_TYPES];

export const ATTRIBUTION_STATUS = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  CHURNED: 'CHURNED',
  DISPUTED: 'DISPUTED',
  EXPIRED: 'EXPIRED',
} as const;

export type AttributionStatus = (typeof ATTRIBUTION_STATUS)[keyof typeof ATTRIBUTION_STATUS];

export interface PartnerReferralTools {
  referralCode: string;
  referralLink: string;
  referralLinkSlug: string;
  qrCodeUrl?: string;
  campaignLinks: CampaignLink[];
}

export interface CampaignLink {
  id: string;
  name: string;
  slug: string;
  fullUrl: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  clickCount: number;
  signupCount: number;
  conversionCount: number;
  isActive: boolean;
  createdAt: string;
}

export interface CreateCampaignLinkParams {
  partnerOrgId: string;
  name: string;
  description?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  destinationUrl?: string;
}

export interface ReferralClickParams {
  partnerOrgId: string;
  referralCode: string;
  ipHash?: string;
  userAgent?: string;
  referer?: string;
  landingPage?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  sessionId?: string;
  cookieId?: string;
}

export interface CreateAttributionParams {
  partnerOrgId: string;
  organizationId: string;
  attributionType: AttributionType;
  referralCodeUsed?: string;
  commissionRatePercent: number;
  commissionDurationMonths?: number;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  landingPage?: string;
  ipHash?: string;
  userAgent?: string;
}

export interface Attribution {
  id: string;
  partnerOrgId: string;
  organizationId: string;
  attributionType: AttributionType;
  referralCodeUsed?: string;
  signupCompletedAt?: string;
  firstPaymentAt?: string;
  lifetimeValue: number;
  totalCommissionEarned: number;
  commissionRatePercent: number;
  commissionDurationMonths: number;
  status: AttributionStatus;
  attributedAt: string;
  createdAt: string;
}

export interface ReferralAnalytics {
  totalClicks: number;
  uniqueClicks: number;
  signups: number;
  trials: number;
  paidCustomers: number;
  conversionRate: number;
  clicksByDay: { date: string; clicks: number }[];
  clicksBySource: { source: string; clicks: number }[];
}

export interface ValidateReferralCodeResult {
  valid: boolean;
  partnerOrgId?: string;
  partnerName?: string;
  partnerTier?: string;
  discountPercent?: number;
  message?: string;
}

// ==========================================
// DATABASE TYPES
// ==========================================

interface PartnerOrgRow {
  id: string;
  name: string;
  referral_code: string;
  referral_link_slug: string;
  tier: string;
  commission_rate_percent: number;
  license_discount_percent: number;
  status: string;
}

interface CampaignLinkRow {
  id: string;
  partner_org_id: string;
  name: string;
  description: string | null;
  slug: string;
  destination_url: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  click_count: number;
  signup_count: number;
  conversion_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AttributionRow {
  id: string;
  partner_org_id: string;
  organization_id: string;
  attribution_type: string;
  referral_code_used: string | null;
  referral_link_clicked_at: string | null;
  signup_completed_at: string | null;
  first_payment_at: string | null;
  lifetime_value: number;
  total_commission_earned: number;
  commission_rate_percent: number;
  commission_duration_months: number;
  status: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  landing_page: string | null;
  ip_hash: string | null;
  user_agent: string | null;
  attributed_at: string;
  created_at: string;
  updated_at: string;
}

interface ClickRow {
  id: string;
  partner_org_id: string;
  referral_code: string;
  clicked_at: string;
  ip_hash: string | null;
  user_agent: string | null;
  referer: string | null;
  landing_page: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  converted: boolean;
  converted_at: string | null;
  converted_organization_id: string | null;
}

// ==========================================
// SERVICE
// ==========================================

let db: IDatabase = getDatabase();

const BASE_URL = process.env.APP_URL || 'https://app.consultify.com';

/**
 * Set database instance (for testing)
 */
export function setDependencies(newDeps: { db?: IDatabase } = {}): void {
  if (newDeps.db) {
    db = newDeps.db;
  }
}

/**
 * Hash an IP address for privacy-compliant storage
 */
function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip).digest('hex');
}

/**
 * Generate a unique campaign slug
 */
function generateCampaignSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 30);
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base}-${suffix}`;
}

// ==========================================
// REFERRAL CODE OPERATIONS
// ==========================================

/**
 * Validate a referral/partner code
 * Used during signup to check if code is valid
 */
export async function validateReferralCode(code: string): Promise<ValidateReferralCodeResult> {
  if (!code || typeof code !== 'string') {
    return { valid: false, message: 'Invalid code format' };
  }

  const normalizedCode = code.trim().toUpperCase();

  try {
    const row = await DbPromise.get<PartnerOrgRow>(
      db,
      `SELECT id, name, referral_code, tier, commission_rate_percent, license_discount_percent, status
             FROM partner_organizations 
             WHERE (upper(referral_code) = ? OR upper(referral_link_slug) = ?)
               AND status = 'active'`,
      [normalizedCode, normalizedCode.toLowerCase()]
    );

    if (!row) {
      return { valid: false, message: 'Partner code not found' };
    }

    return {
      valid: true,
      partnerOrgId: row.id,
      partnerName: row.name,
      partnerTier: row.tier,
      discountPercent: row.license_discount_percent || 0,
      message:
        row.license_discount_percent > 0
          ? `Partner code valid! ${row.license_discount_percent}% discount applied.`
          : 'Partner code valid!',
    };
  } catch (err: any) {
    logger.error('[PartnerReferralService] Code validation error:', err);
    return { valid: false, message: 'Error validating code' };
  }
}

/**
 * Get referral tools for a partner (their codes, links, campaigns)
 */
export async function getReferralTools(partnerOrgId: string): Promise<PartnerReferralTools | null> {
  try {
    // Get partner org details
    const partner = await DbPromise.get<PartnerOrgRow>(
      db,
      `SELECT id, name, referral_code, referral_link_slug FROM partner_organizations WHERE id = ?`,
      [partnerOrgId],
      { fallback: false }
    );

    if (!partner) {
      return null;
    }

    // Get campaign links
    const campaigns = await DbPromise.all<CampaignLinkRow>(
      db,
      `SELECT * FROM partner_campaign_links 
             WHERE partner_org_id = ? AND is_active = true
             ORDER BY created_at DESC`,
      [partnerOrgId],
      { fallback: false }
    );

    const referralLink = `${BASE_URL}/r/${partner.referral_link_slug}`;

    return {
      referralCode: partner.referral_code,
      referralLink,
      referralLinkSlug: partner.referral_link_slug,
      qrCodeUrl: `${BASE_URL}/api/partner/qr/${partner.referral_link_slug}`,
      campaignLinks: campaigns.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        fullUrl: buildCampaignUrl(partner.referral_link_slug, c),
        utmSource: c.utm_source || undefined,
        utmMedium: c.utm_medium || undefined,
        utmCampaign: c.utm_campaign || undefined,
        clickCount: c.click_count,
        signupCount: c.signup_count,
        conversionCount: c.conversion_count,
        isActive: c.is_active,
        createdAt: c.created_at,
      })),
    };
  } catch (err: any) {
    logger.error('[PartnerReferralService] Error getting referral tools:', err);
    throw err;
  }
}

/**
 * Build campaign URL with UTM parameters
 */
function buildCampaignUrl(slug: string, campaign: CampaignLinkRow): string {
  const baseUrl = `${BASE_URL}/r/${slug}`;
  const params = new URLSearchParams();

  if (campaign.utm_source) params.set('utm_source', campaign.utm_source);
  if (campaign.utm_medium) params.set('utm_medium', campaign.utm_medium);
  if (campaign.utm_campaign) params.set('utm_campaign', campaign.utm_campaign);
  if (campaign.utm_content) params.set('utm_content', campaign.utm_content);
  params.set('c', campaign.slug); // Campaign identifier

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Create a new campaign link
 */
export async function createCampaignLink(params: CreateCampaignLinkParams): Promise<CampaignLink> {
  const {
    partnerOrgId,
    name,
    description,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    destinationUrl = '/',
  } = params;

  const id = uuidv4();
  const slug = generateCampaignSlug(name);

  try {
    await DbPromise.run(
      db,
      `INSERT INTO partner_campaign_links 
             (id, partner_org_id, name, description, slug, destination_url, utm_source, utm_medium, utm_campaign, utm_content)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        partnerOrgId,
        name,
        description || null,
        slug,
        destinationUrl,
        utmSource || null,
        utmMedium || null,
        utmCampaign || null,
        utmContent || null,
      ]
    );

    // Get the partner's referral slug
    const partner = await DbPromise.get<{ referral_link_slug: string }>(
      db,
      `SELECT referral_link_slug FROM partner_organizations WHERE id = ?`,
      [partnerOrgId]
    );

    logger.info(
      `[PartnerReferralService] Created campaign link: ${name} for partner ${partnerOrgId}`
    );

    return {
      id,
      name,
      slug,
      fullUrl: partner
        ? `${BASE_URL}/r/${partner.referral_link_slug}?c=${slug}${utmSource ? `&utm_source=${utmSource}` : ''}${utmMedium ? `&utm_medium=${utmMedium}` : ''}${utmCampaign ? `&utm_campaign=${utmCampaign}` : ''}`
        : `${BASE_URL}/r/unknown?c=${slug}`,
      utmSource,
      utmMedium,
      utmCampaign,
      clickCount: 0,
      signupCount: 0,
      conversionCount: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
  } catch (err: any) {
    logger.error('[PartnerReferralService] Error creating campaign link:', err);
    throw err;
  }
}

/**
 * Delete a campaign link
 */
export async function deleteCampaignLink(
  partnerOrgId: string,
  campaignId: string
): Promise<boolean> {
  const result = await DbPromise.run(
    db,
    `DELETE FROM partner_campaign_links WHERE id = ? AND partner_org_id = ?`,
    [campaignId, partnerOrgId]
  );
  return (result.changes || 0) > 0;
}

// ==========================================
// CLICK TRACKING
// ==========================================

/**
 * Track a referral link click
 */
export async function trackClick(
  params: ReferralClickParams
): Promise<{ success: boolean; clickId?: string }> {
  const {
    partnerOrgId,
    referralCode,
    ipHash,
    userAgent,
    referer,
    landingPage,
    utmSource,
    utmMedium,
    utmCampaign,
    utmContent,
    utmTerm,
    sessionId,
    cookieId,
  } = params;

  const id = uuidv4();

  try {
    await DbPromise.run(
      db,
      `INSERT INTO partner_referral_clicks 
             (id, partner_org_id, referral_code, ip_hash, user_agent, referer, landing_page,
              utm_source, utm_medium, utm_campaign, utm_content, utm_term, session_id, cookie_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        partnerOrgId,
        referralCode,
        ipHash || null,
        userAgent || null,
        referer || null,
        landingPage || null,
        utmSource || null,
        utmMedium || null,
        utmCampaign || null,
        utmContent || null,
        utmTerm || null,
        sessionId || null,
        cookieId || null,
      ]
    );

    // Update campaign link click count if applicable
    if (utmCampaign) {
      await DbPromise.run(
        db,
        `UPDATE partner_campaign_links 
                 SET click_count = click_count + 1, updated_at = NOW()
                 WHERE partner_org_id = ? AND (slug = ? OR utm_campaign = ?)`,
        [partnerOrgId, utmCampaign, utmCampaign]
      );
    }

    return { success: true, clickId: id };
  } catch (err: any) {
    logger.error('[PartnerReferralService] Error tracking click:', err);
    return { success: false };
  }
}

/**
 * Mark a click as converted (signup completed)
 */
export async function markClickConverted(
  clickId: string | null,
  cookieId: string | null,
  organizationId: string,
  conversionType: 'SIGNUP' | 'TRIAL' | 'PAID' = 'SIGNUP'
): Promise<boolean> {
  try {
    let whereClause = '';
    let params: any[] = [];

    if (clickId) {
      whereClause = 'id = ?';
      params = [clickId];
    } else if (cookieId) {
      whereClause = 'cookie_id = ? AND converted = false';
      params = [cookieId];
    } else {
      return false;
    }

    const result = await DbPromise.run(
      db,
      `UPDATE partner_referral_clicks 
             SET converted = true, converted_at = NOW(), 
                 converted_organization_id = ?, conversion_type = ?
             WHERE ${whereClause}`,
      [...params, organizationId, conversionType]
    );

    // Update campaign link conversion count
    if (result.changes && result.changes > 0) {
      await DbPromise.run(
        db,
        `UPDATE partner_campaign_links cl
                 SET signup_count = signup_count + 1, updated_at = NOW()
                 FROM partner_referral_clicks rc
                 WHERE rc.${clickId ? 'id' : 'cookie_id'} = ?
                   AND rc.utm_campaign IS NOT NULL
                   AND cl.utm_campaign = rc.utm_campaign`,
        [clickId || cookieId]
      );
    }

    return (result.changes || 0) > 0;
  } catch (err: any) {
    logger.error('[PartnerReferralService] Error marking click converted:', err);
    return false;
  }
}

// ==========================================
// ATTRIBUTION
// ==========================================

/**
 * Create a partner attribution (link organization to referring partner)
 */
export async function createAttribution(params: CreateAttributionParams): Promise<Attribution> {
  const {
    partnerOrgId,
    organizationId,
    attributionType,
    referralCodeUsed,
    commissionRatePercent,
    commissionDurationMonths = 12,
    utmSource,
    utmMedium,
    utmCampaign,
    landingPage,
    ipHash,
    userAgent,
  } = params;

  const id = uuidv4();
  const now = new Date().toISOString();

  try {
    // Resolve commission rate (supports incentive tier floor from partner certifications)
    let resolvedCommissionRatePercent = Number(commissionRatePercent);
    if (!Number.isFinite(resolvedCommissionRatePercent) || resolvedCommissionRatePercent <= 0) {
      const tierOrder = ['REGISTERED', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM'] as const;
      const rank = (t: unknown): number => {
        const upper = String(t || '')
          .trim()
          .toUpperCase();
        const idx = tierOrder.indexOf(upper as any);
        return idx >= 0 ? idx : 0;
      };
      const legacyToCanonical = (legacy: unknown): string => {
        const v = String(legacy || '').toLowerCase();
        if (v === 'elite') return 'PLATINUM';
        if (v === 'premier') return 'GOLD';
        if (v === 'certified') return 'SILVER';
        return 'REGISTERED';
      };
      const maxTier = (a: unknown, b: unknown): string =>
        rank(a) >= rank(b)
          ? String(a || 'REGISTERED').toUpperCase()
          : String(b || 'REGISTERED').toUpperCase();

      const org = await DbPromise.get<any>(
        db,
        `SELECT tier, tier_override, certification_tier_floor, commission_rate_percent
         FROM partner_organizations
         WHERE id = ?`,
        [partnerOrgId]
      );
      const legacy = legacyToCanonical(org?.tier);
      const effectiveTier = maxTier(
        maxTier(legacy, org?.tier_override),
        org?.certification_tier_floor
      );

      const rateRow = await DbPromise.get<{ rate: number }>(
        db,
        `SELECT rate FROM partner_commission_rates WHERE tier = ?`,
        [effectiveTier]
      );

      const fallback = Number(org?.commission_rate_percent);
      resolvedCommissionRatePercent = Number.isFinite(rateRow?.rate)
        ? Number(rateRow?.rate)
        : Number.isFinite(fallback) && fallback > 0
          ? fallback
          : 10;
    }

    // Check if attribution already exists
    const existing = await DbPromise.get<{ id: string }>(
      db,
      `SELECT id FROM partner_attributions WHERE organization_id = ?`,
      [organizationId]
    );

    if (existing) {
      logger.warn(`[PartnerReferralService] Attribution already exists for org ${organizationId}`);
      throw new Error('Attribution already exists for this organization');
    }

    await DbPromise.run(
      db,
      `INSERT INTO partner_attributions 
             (id, partner_org_id, organization_id, attribution_type, referral_code_used,
              commission_rate_percent, commission_duration_months, status,
              utm_source, utm_medium, utm_campaign, landing_page, ip_hash, user_agent,
              signup_completed_at, attributed_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        partnerOrgId,
        organizationId,
        attributionType,
        referralCodeUsed || null,
        resolvedCommissionRatePercent,
        commissionDurationMonths,
        utmSource || null,
        utmMedium || null,
        utmCampaign || null,
        landingPage || null,
        ipHash || null,
        userAgent || null,
        now,
        now,
      ]
    );

    logger.info(
      `[PartnerReferralService] Created attribution: partner ${partnerOrgId} -> org ${organizationId}`
    );

    return {
      id,
      partnerOrgId,
      organizationId,
      attributionType,
      referralCodeUsed,
      signupCompletedAt: now,
      lifetimeValue: 0,
      totalCommissionEarned: 0,
      commissionRatePercent: resolvedCommissionRatePercent,
      commissionDurationMonths,
      status: 'PENDING',
      attributedAt: now,
      createdAt: now,
    };
  } catch (err: any) {
    logger.error('[PartnerReferralService] Error creating attribution:', err);
    throw err;
  }
}

/**
 * Get attribution for an organization
 */
export async function getAttributionByOrganization(
  organizationId: string
): Promise<Attribution | null> {
  try {
    const row = await DbPromise.get<AttributionRow>(
      db,
      `SELECT * FROM partner_attributions WHERE organization_id = ?`,
      [organizationId]
    );

    if (!row) return null;

    return {
      id: row.id,
      partnerOrgId: row.partner_org_id,
      organizationId: row.organization_id,
      attributionType: row.attribution_type as AttributionType,
      referralCodeUsed: row.referral_code_used || undefined,
      signupCompletedAt: row.signup_completed_at || undefined,
      firstPaymentAt: row.first_payment_at || undefined,
      lifetimeValue: row.lifetime_value,
      totalCommissionEarned: row.total_commission_earned,
      commissionRatePercent: row.commission_rate_percent,
      commissionDurationMonths: row.commission_duration_months,
      status: row.status as AttributionStatus,
      attributedAt: row.attributed_at,
      createdAt: row.created_at,
    };
  } catch (err: any) {
    logger.error('[PartnerReferralService] Error getting attribution:', err);
    return null;
  }
}

/**
 * Get all attributions for a partner
 */
export async function getPartnerAttributions(
  partnerOrgId: string,
  options: { status?: AttributionStatus; limit?: number; offset?: number } = {}
): Promise<Attribution[]> {
  const { status, limit = 50, offset = 0 } = options;

  let query = `SELECT pa.*, o.name as org_name 
                 FROM partner_attributions pa
                 LEFT JOIN organizations o ON o.id = pa.organization_id
                 WHERE pa.partner_org_id = ?`;
  const params: any[] = [partnerOrgId];

  if (status) {
    query += ` AND pa.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY pa.attributed_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  try {
    const rows = await DbPromise.all<AttributionRow & { org_name?: string }>(db, query, params);

    return rows.map((row) => ({
      id: row.id,
      partnerOrgId: row.partner_org_id,
      organizationId: row.organization_id,
      attributionType: row.attribution_type as AttributionType,
      referralCodeUsed: row.referral_code_used || undefined,
      signupCompletedAt: row.signup_completed_at || undefined,
      firstPaymentAt: row.first_payment_at || undefined,
      lifetimeValue: row.lifetime_value,
      totalCommissionEarned: row.total_commission_earned,
      commissionRatePercent: row.commission_rate_percent,
      commissionDurationMonths: row.commission_duration_months,
      status: row.status as AttributionStatus,
      attributedAt: row.attributed_at,
      createdAt: row.created_at,
    }));
  } catch (err: any) {
    logger.error('[PartnerReferralService] Error getting partner attributions:', err);
    return [];
  }
}

/**
 * Update attribution status (e.g., when first payment made)
 */
export async function updateAttributionStatus(
  attributionId: string,
  status: AttributionStatus,
  updates?: { firstPaymentAt?: string }
): Promise<boolean> {
  try {
    let query = `UPDATE partner_attributions SET status = ?, updated_at = NOW()`;
    const params: any[] = [status];

    if (updates?.firstPaymentAt) {
      query += `, first_payment_at = ?`;
      params.push(updates.firstPaymentAt);
    }

    query += ` WHERE id = ?`;
    params.push(attributionId);

    const result = await DbPromise.run(db, query, params);
    return (result.changes || 0) > 0;
  } catch (err: any) {
    logger.error('[PartnerReferralService] Error updating attribution status:', err);
    return false;
  }
}

// ==========================================
// ANALYTICS
// ==========================================

/**
 * Get referral analytics for a partner
 */
export async function getReferralAnalytics(
  partnerOrgId: string,
  days: number = 30
): Promise<ReferralAnalytics> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    // Get click stats
    const clickStats = await DbPromise.get<{
      total_clicks: number;
      unique_clicks: number;
      signups: number;
    }>(
      db,
      `SELECT 
                COUNT(*) as total_clicks,
                COUNT(DISTINCT COALESCE(cookie_id, ip_hash)) as unique_clicks,
                COUNT(*) FILTER (WHERE converted = true) as signups
             FROM partner_referral_clicks 
             WHERE partner_org_id = ? AND clicked_at >= ?`,
      [partnerOrgId, startDate.toISOString()]
    );

    // Get attribution stats
    const attrStats = await DbPromise.get<{
      trials: number;
      paid: number;
    }>(
      db,
      `SELECT 
                COUNT(*) FILTER (WHERE status = 'PENDING') as trials,
                COUNT(*) FILTER (WHERE status = 'ACTIVE') as paid
             FROM partner_attributions 
             WHERE partner_org_id = ? AND attributed_at >= ?`,
      [partnerOrgId, startDate.toISOString()]
    );

    // Get clicks by day
    const clicksByDay = await DbPromise.all<{ date: string; clicks: number }>(
      db,
      `SELECT DATE(clicked_at) as date, COUNT(*) as clicks
             FROM partner_referral_clicks 
             WHERE partner_org_id = ? AND clicked_at >= ?
             GROUP BY DATE(clicked_at)
             ORDER BY date`,
      [partnerOrgId, startDate.toISOString()]
    );

    // Get clicks by source
    const clicksBySource = await DbPromise.all<{ source: string; clicks: number }>(
      db,
      `SELECT COALESCE(utm_source, 'direct') as source, COUNT(*) as clicks
             FROM partner_referral_clicks 
             WHERE partner_org_id = ? AND clicked_at >= ?
             GROUP BY COALESCE(utm_source, 'direct')
             ORDER BY clicks DESC
             LIMIT 10`,
      [partnerOrgId, startDate.toISOString()]
    );

    const totalClicks = clickStats?.total_clicks || 0;
    const paidCustomers = attrStats?.paid || 0;

    return {
      totalClicks,
      uniqueClicks: clickStats?.unique_clicks || 0,
      signups: clickStats?.signups || 0,
      trials: attrStats?.trials || 0,
      paidCustomers,
      conversionRate: totalClicks > 0 ? Math.round((paidCustomers / totalClicks) * 10000) / 100 : 0,
      clicksByDay: clicksByDay || [],
      clicksBySource: clicksBySource || [],
    };
  } catch (err: any) {
    logger.error('[PartnerReferralService] Error getting referral analytics:', err);
    return {
      totalClicks: 0,
      uniqueClicks: 0,
      signups: 0,
      trials: 0,
      paidCustomers: 0,
      conversionRate: 0,
      clicksByDay: [],
      clicksBySource: [],
    };
  }
}

/**
 * Look up partner by referral code or slug
 */
export async function getPartnerByReferralCode(code: string): Promise<{
  partnerOrgId: string;
  partnerName: string;
  commissionRate: number;
  tier: string;
} | null> {
  const normalizedCode = code.trim().toUpperCase();

  try {
    const row = await DbPromise.get<PartnerOrgRow>(
      db,
      `SELECT id, name, commission_rate_percent, tier
             FROM partner_organizations 
             WHERE (upper(referral_code) = ? OR lower(referral_link_slug) = ?)
               AND status = 'active'`,
      [normalizedCode, code.toLowerCase()]
    );

    if (!row) return null;

    return {
      partnerOrgId: row.id,
      partnerName: row.name,
      commissionRate: row.commission_rate_percent,
      tier: row.tier,
    };
  } catch (err: any) {
    logger.error('[PartnerReferralService] Error looking up partner:', err);
    return null;
  }
}

// ==========================================
// EXPIRING ATTRIBUTIONS (GAP-PARTNER-004)
// ==========================================

export interface ExpiringAttribution {
  id: string;
  partnerOrgId: string;
  partnerName: string;
  organizationId: string;
  organizationName: string;
  referralCodeUsed?: string;
  status: string;
  attributedAt: string;
  discountEndDate?: string;
  daysRemaining: number;
  discountPercent?: number;
  lifetimeValue: number;
  totalCommissionEarned: number;
}

/**
 * Get attributions with expiring discounts
 * GAP-PARTNER-004
 */
export async function getExpiringAttributions(
  days: number = 30,
  limit: number = 100,
  offset: number = 0
): Promise<ExpiringAttribution[]> {
  try {
    const rows = await DbPromise.all<{
      id: string;
      partner_org_id: string;
      partner_name: string;
      organization_id: string;
      organization_name: string;
      referral_code_used: string | null;
      status: string;
      attributed_at: string;
      discount_end_date: string | null;
      days_remaining: number;
      discount_value: number | null;
      lifetime_value: number;
      total_commission_earned: number;
    }>(
      db,
      `SELECT 
                pa.id,
                pa.partner_org_id,
                COALESCE(po.partner_name, 'Unknown Partner') as partner_name,
                pa.organization_id,
                COALESCE(o.name, 'Unknown Organization') as organization_name,
                pa.referral_code_used,
                pa.status,
                pa.attributed_at,
                od.end_date as discount_end_date,
                CAST(julianday(od.end_date) - julianday('now') AS INTEGER) as days_remaining,
                od.discount_value,
                pa.lifetime_value,
                pa.total_commission_earned
            FROM partner_attributions pa
            LEFT JOIN partner_organizations po ON pa.partner_org_id = po.id
            LEFT JOIN organizations o ON pa.organization_id = o.id
            LEFT JOIN organization_discounts od ON pa.organization_id = od.organization_id 
                AND pa.partner_org_id = od.partner_org_id
                AND od.status = 'ACTIVE'
            WHERE pa.status = 'ACTIVE'
                AND od.end_date IS NOT NULL
                AND od.end_date > datetime('now')
                AND od.end_date <= datetime('now', '+' || ? || ' days')
            ORDER BY od.end_date ASC
            LIMIT ? OFFSET ?`,
      [days, limit, offset]
    );

    return (rows || []).map((row) => ({
      id: row.id,
      partnerOrgId: row.partner_org_id,
      partnerName: row.partner_name,
      organizationId: row.organization_id,
      organizationName: row.organization_name,
      referralCodeUsed: row.referral_code_used || undefined,
      status: row.status,
      attributedAt: row.attributed_at,
      discountEndDate: row.discount_end_date || undefined,
      daysRemaining: row.days_remaining || 0,
      discountPercent: row.discount_value || undefined,
      lifetimeValue: row.lifetime_value || 0,
      totalCommissionEarned: row.total_commission_earned || 0,
    }));
  } catch (err: any) {
    logger.error('[PartnerReferralService] Error fetching expiring attributions:', err);
    return [];
  }
}

// ==========================================
// CODE ANALYTICS (GAP-PARTNER-003)
// ==========================================

export interface CodeAnalytics {
  referralCode: string;
  partnerOrgId: string;
  partnerName: string;
  totalClicks: number;
  totalSignups: number;
  totalConversions: number;
  conversionRate: number;
  totalRevenue: number;
  totalCommissions: number;
  avgCommissionRate: number;
  activeAttributions: number;
  firstUsed?: string;
  lastUsed?: string;
}

/**
 * Get analytics per referral code
 * GAP-PARTNER-003
 */
export async function getCodeAnalytics(
  days: number = 90,
  limit: number = 20
): Promise<CodeAnalytics[]> {
  try {
    const rows = await DbPromise.all<{
      referral_code: string;
      partner_org_id: string;
      partner_name: string;
      total_clicks: number;
      total_signups: number;
      total_conversions: number;
      total_revenue: number;
      total_commissions: number;
      avg_commission_rate: number;
      active_attributions: number;
      first_used: string | null;
      last_used: string | null;
    }>(
      db,
      `WITH code_stats AS (
                SELECT 
                    po.referral_code,
                    po.id as partner_org_id,
                    po.partner_name,
                    COALESCE((
                        SELECT COUNT(*) FROM partner_referral_clicks prc 
                        WHERE prc.partner_org_id = po.id 
                        AND prc.clicked_at >= datetime('now', '-' || ? || ' days')
                    ), 0) as total_clicks,
                    COALESCE((
                        SELECT COUNT(*) FROM partner_referral_clicks prc 
                        WHERE prc.partner_org_id = po.id 
                        AND prc.signup_at IS NOT NULL
                        AND prc.clicked_at >= datetime('now', '-' || ? || ' days')
                    ), 0) as total_signups,
                    COALESCE((
                        SELECT COUNT(*) FROM partner_referral_clicks prc 
                        WHERE prc.partner_org_id = po.id 
                        AND prc.converted_at IS NOT NULL
                        AND prc.clicked_at >= datetime('now', '-' || ? || ' days')
                    ), 0) as total_conversions,
                    COALESCE((
                        SELECT SUM(pct.gross_amount) FROM partner_commission_transactions pct 
                        WHERE pct.partner_org_id = po.id 
                        AND pct.transaction_date >= datetime('now', '-' || ? || ' days')
                    ), 0) as total_revenue,
                    COALESCE((
                        SELECT SUM(pct.commission_amount) FROM partner_commission_transactions pct 
                        WHERE pct.partner_org_id = po.id 
                        AND pct.transaction_date >= datetime('now', '-' || ? || ' days')
                    ), 0) as total_commissions,
                    COALESCE((
                        SELECT AVG(pct.commission_rate) FROM partner_commission_transactions pct 
                        WHERE pct.partner_org_id = po.id 
                        AND pct.transaction_date >= datetime('now', '-' || ? || ' days')
                    ), 0) as avg_commission_rate,
                    (
                        SELECT COUNT(*) FROM partner_attributions pa 
                        WHERE pa.partner_org_id = po.id AND pa.status = 'ACTIVE'
                    ) as active_attributions,
                    (
                        SELECT MIN(prc.clicked_at) FROM partner_referral_clicks prc 
                        WHERE prc.partner_org_id = po.id
                    ) as first_used,
                    (
                        SELECT MAX(prc.clicked_at) FROM partner_referral_clicks prc 
                        WHERE prc.partner_org_id = po.id
                    ) as last_used
                FROM partner_organizations po
                WHERE po.referral_code IS NOT NULL
                AND po.status = 'ACTIVE'
            )
            SELECT * FROM code_stats
            ORDER BY total_revenue DESC, total_clicks DESC
            LIMIT ?`,
      [days, days, days, days, days, days, limit]
    );

    return (rows || []).map((row) => ({
      referralCode: row.referral_code,
      partnerOrgId: row.partner_org_id,
      partnerName: row.partner_name,
      totalClicks: row.total_clicks || 0,
      totalSignups: row.total_signups || 0,
      totalConversions: row.total_conversions || 0,
      conversionRate:
        row.total_clicks > 0
          ? Math.round((row.total_conversions / row.total_clicks) * 100 * 10) / 10
          : 0,
      totalRevenue: row.total_revenue || 0,
      totalCommissions: row.total_commissions || 0,
      avgCommissionRate: row.avg_commission_rate || 0,
      activeAttributions: row.active_attributions || 0,
      firstUsed: row.first_used || undefined,
      lastUsed: row.last_used || undefined,
    }));
  } catch (err: any) {
    logger.error('[PartnerReferralService] Error fetching code analytics:', err);
    return [];
  }
}

// ==========================================
// EXPORTS
// ==========================================

const PartnerReferralService = {
  ATTRIBUTION_TYPES,
  ATTRIBUTION_STATUS,
  setDependencies,
  validateReferralCode,
  getReferralTools,
  createCampaignLink,
  deleteCampaignLink,
  trackClick,
  markClickConverted,
  createAttribution,
  getAttributionByOrganization,
  getPartnerAttributions,
  updateAttributionStatus,
  getReferralAnalytics,
  getPartnerByReferralCode,
  getExpiringAttributions,
  getCodeAnalytics,
};

export default PartnerReferralService;
