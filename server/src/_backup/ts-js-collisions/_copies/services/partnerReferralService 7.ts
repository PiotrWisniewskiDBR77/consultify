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

const BASE_URL = process.env.APP_URL || 'https://app.consultinity.com';

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
            message: row.license_discount_percent > 0 
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
            [partnerOrgId]
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
            [partnerOrgId]
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
            [id, partnerOrgId, name, description || null, slug, destinationUrl, 
             utmSource || null, utmMedium || null, utmCampaign || null, utmContent || null]
        );

        // Get the partner's referral slug
        const partner = await DbPromise.get<{ referral_link_slug: string }>(
            db,
            `SELECT referral_link_slug FROM partner_organizations WHERE id = ?`,
            [partnerOrgId]
        );

        logger.info(`[PartnerReferralService] Created campaign link: ${name} for partner ${partnerOrgId}`);

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
export async function deleteCampaignLink(partnerOrgId: string, campaignId: string): Promise<boolean> {
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
export async function trackClick(params: ReferralClickParams): Promise<{ success: boolean; clickId?: string }> {
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
            [id, partnerOrgId, referralCode, ipHash || null, userAgent || null, referer || null, landingPage || null,
             utmSource || null, utmMedium || null, utmCampaign || null, utmContent || null, utmTerm || null,
             sessionId || null, cookieId || null]
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
            [id, partnerOrgId, organizationId, attributionType, referralCodeUsed || null,
             commissionRatePercent, commissionDurationMonths,
             utmSource || null, utmMedium || null, utmCampaign || null, landingPage || null,
             ipHash || null, userAgent || null, now, now]
        );

        logger.info(`[PartnerReferralService] Created attribution: partner ${partnerOrgId} -> org ${organizationId}`);

        return {
            id,
            partnerOrgId,
            organizationId,
            attributionType,
            referralCodeUsed,
            signupCompletedAt: now,
            lifetimeValue: 0,
            totalCommissionEarned: 0,
            commissionRatePercent,
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
export async function getAttributionByOrganization(organizationId: string): Promise<Attribution | null> {
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
};

export default PartnerReferralService;
