/**
 * Attribution Service
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Migrated from server/services/attributionService.js (ES Modules) to TypeScript (ES Modules)
 * Central service for recording organization acquisition sources.
 * Implements IMMUTABLE append-only audit trail for:
 * - Partner settlements
 * - Marketing analytics
 * - Campaign ROI tracking
 *
 * CRITICAL: This table should NEVER have UPDATE or DELETE operations.
 * Follows the same pattern as organization_events, legal_events, invitation_events.
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import * as DbPromise from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export const SOURCE_TYPES = {
  PROMO_CODE: 'PROMO_CODE',
  INVITATION: 'INVITATION',
  DEMO: 'DEMO',
  SALES: 'SALES',
  SELF_SERVE: 'SELF_SERVE',
} as const;

export type SourceType = (typeof SOURCE_TYPES)[keyof typeof SOURCE_TYPES];

interface RecordAttributionParams {
  organizationId: string;
  userId?: string | null;
  sourceType: SourceType;
  sourceId?: string | null;
  campaign?: string | null;
  partnerCode?: string | null;
  medium?: string | null;
  metadata?: Record<string, unknown>;
}

interface RecordAttributionResult {
  eventId: string;
}

interface AttributionEvent {
  id: string;
  organizationId: string;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  sourceType: SourceType;
  sourceId?: string | null;
  campaign?: string | null;
  partnerCode?: string | null;
  medium?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface ExportAttributionFilters {
  startDate?: string;
  endDate?: string;
  partnerCode?: string;
  sourceType?: SourceType;
}

interface AttributionEventRow {
  id: string;
  organization_id: string;
  user_id?: string | null;
  user_email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  source_type: string;
  source_id?: string | null;
  campaign?: string | null;
  partner_code?: string | null;
  medium?: string | null;
  metadata: string;
  created_at: string;
}

interface ExportAttributionRow extends AttributionEventRow {
  organization_name: string;
  organization_type: string;
  org_created_at: string;
}

interface PartnerSummaryRow {
  partner_code: string;
  organization_count: number;
  event_count: number;
  first_attribution: string;
  last_attribution: string;
}

interface PartnerSummary {
  partnerCode: string;
  organizationCount: number;
  eventCount: number;
  firstAttribution: string;
  lastAttribution: string;
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
 * Record a new attribution event (append-only, never updates)
 */
export async function recordAttribution(
  params: RecordAttributionParams
): Promise<RecordAttributionResult> {
  const {
    organizationId,
    userId = null,
    sourceType,
    sourceId = null,
    campaign = null,
    partnerCode = null,
    medium = null,
    metadata = {},
  } = params;

  if (!organizationId || !sourceType) {
    throw new Error('organizationId and sourceType are required');
  }

  if (!Object.values(SOURCE_TYPES).includes(sourceType)) {
    throw new Error(`Invalid source type: ${sourceType}`);
  }

  const eventId = uuidv4();

  const insertResult = await DbPromise.run(
    db,
    `INSERT INTO attribution_events (id, organization_id, user_id, source_type, source_id, campaign, partner_code, medium, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventId,
      organizationId,
      userId,
      sourceType,
      sourceId,
      campaign,
      partnerCode,
      medium,
      JSON.stringify(metadata),
    ],
    { fallback: false }
  );

  if (!insertResult.success) {
    throw new Error(insertResult.error || 'Failed to persist attribution event');
  }

  logger.info(
    `[AttributionService] Attribution recorded: ${sourceType} for org ${organizationId}${partnerCode ? ` (partner: ${partnerCode})` : ''}`
  );

  return { eventId };
}

/**
 * Get all attribution events for an organization
 */
export async function getOrganizationAttribution(
  organizationId: string
): Promise<AttributionEvent[]> {
  const rows = await DbPromise.all<AttributionEventRow>(
    db,
    `SELECT ae.*, u.email as user_email, u.first_name, u.last_name
         FROM attribution_events ae
         LEFT JOIN users u ON u.id = ae.user_id
         WHERE ae.organization_id = ?
         ORDER BY ae.created_at ASC`,
    [organizationId]
  );

  return (rows || []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id || null,
    userEmail: row.user_email || null,
    userName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : null,
    sourceType: row.source_type as SourceType,
    sourceId: row.source_id || null,
    campaign: row.campaign || null,
    partnerCode: row.partner_code || null,
    medium: row.medium || null,
    metadata: JSON.parse(row.metadata || '{}'),
    createdAt: row.created_at,
  }));
}

/**
 * Get the first (original) attribution for an organization
 * This is the primary source used for partner settlements
 */
export async function getFirstAttribution(
  organizationId: string
): Promise<AttributionEvent | null> {
  const row = await DbPromise.get<AttributionEventRow>(
    db,
    `SELECT ae.*, u.email as user_email
         FROM attribution_events ae
         LEFT JOIN users u ON u.id = ae.user_id
         WHERE ae.organization_id = ?
         ORDER BY ae.created_at ASC
         LIMIT 1`,
    [organizationId]
  );

  if (!row) {
    return null;
  }

  return {
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id || null,
    userEmail: row.user_email || null,
    userName: null,
    sourceType: row.source_type as SourceType,
    sourceId: row.source_id || null,
    campaign: row.campaign || null,
    partnerCode: row.partner_code || null,
    medium: row.medium || null,
    metadata: JSON.parse(row.metadata || '{}'),
    createdAt: row.created_at,
  };
}

/**
 * Check if an organization has any attribution
 */
export async function hasAttribution(organizationId: string): Promise<boolean> {
  const row = await DbPromise.get<{ count: number }>(
    db,
    `SELECT COUNT(*) as count FROM attribution_events WHERE organization_id = ?`,
    [organizationId]
  );

  return (row?.count || 0) > 0;
}

/**
 * Export attribution data for compliance or settlement calculations
 */
export async function exportAttribution(
  filters: ExportAttributionFilters = {}
): Promise<AttributionEvent[]> {
  const { startDate, endDate, partnerCode, sourceType } = filters;

  let query = `
        SELECT ae.*, o.name as organization_name, o.organization_type, o.created_at as org_created_at
        FROM attribution_events ae
        JOIN organizations o ON o.id = ae.organization_id
        WHERE 1=1
    `;
  const params: unknown[] = [];

  if (startDate) {
    query += ` AND ae.created_at >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND ae.created_at <= ?`;
    params.push(endDate);
  }

  if (partnerCode) {
    query += ` AND ae.partner_code = ?`;
    params.push(partnerCode);
  }

  if (sourceType) {
    query += ` AND ae.source_type = ?`;
    params.push(sourceType);
  }

  query += ` ORDER BY ae.created_at DESC`;

  const rows = await DbPromise.all<ExportAttributionRow>(db, query, params);

  return (rows || []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    userId: row.user_id || null,
    userEmail: row.user_email || null,
    userName: row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : null,
    sourceType: row.source_type as SourceType,
    sourceId: row.source_id || null,
    campaign: row.campaign || null,
    partnerCode: row.partner_code || null,
    medium: row.medium || null,
    metadata: JSON.parse(row.metadata || '{}'),
    createdAt: row.created_at,
  }));
}

/**
 * Get attribution summary by partner code
 * For partner settlement calculations
 */
export async function getPartnerSummary(
  startDate: string | null = null,
  endDate: string | null = null
): Promise<PartnerSummary[]> {
  let query = `
        SELECT 
            ae.partner_code,
            COUNT(DISTINCT ae.organization_id) as organization_count,
            COUNT(*) as event_count,
            MIN(ae.created_at) as first_attribution,
            MAX(ae.created_at) as last_attribution
        FROM attribution_events ae
        WHERE ae.partner_code IS NOT NULL
    `;
  const params: unknown[] = [];

  if (startDate) {
    query += ` AND ae.created_at >= ?`;
    params.push(startDate);
  }

  if (endDate) {
    query += ` AND ae.created_at <= ?`;
    params.push(endDate);
  }

  query += ` GROUP BY ae.partner_code ORDER BY organization_count DESC`;

  const rows = await DbPromise.all<PartnerSummaryRow>(db, query, params);

  return (rows || []).map((row) => ({
    partnerCode: row.partner_code,
    organizationCount: row.organization_count,
    eventCount: row.event_count,
    firstAttribution: row.first_attribution,
    lastAttribution: row.last_attribution,
  }));
}

// Default export for backward compatibility
const AttributionService = {
  SOURCE_TYPES,
  setDependencies,
  recordAttribution,
  getOrganizationAttribution,
  getFirstAttribution,
  hasAttribution,
  exportAttribution,
  getPartnerSummary,
};

export default AttributionService;
