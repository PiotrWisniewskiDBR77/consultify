/**
 * KPI-E004 — Scorecards shared row + DTO types.
 *
 * Design: docs/product/results-vnext/KPI_E004_DESIGN.md §A (schema) / §D
 * ("kpiScorecardTypes.ts — Row/DTO types").
 * Schema: server/migrations/20260812_rvn_kpi_scorecards.sql.
 *
 * Convention mirrors kpiDeviationTypes.ts exactly: `*Row` interfaces are
 * snake_case, matching DB columns 1:1 (the shape a raw `client.query<...Row>()`
 * call returns); DTO interfaces are camelCase — the shape command/repository
 * functions return to their callers. `kpiScorecardCommands.ts` and
 * `kpiScorecardRepository.ts` both import from here rather than each
 * re-declaring their own copy of these interfaces (the design doc's §B/§C
 * code samples inline them per-file for readability, but this file
 * consolidates them the same way kpiDeviationTypes.ts already does for
 * KPI-E003 — one definition, two importers, no drift risk).
 */

import { toNullableNumber } from './kpiTypes.js';

// ==========================================
// ENUMS (mirror the CHECK constraints in the migration)
// ==========================================

export const KPI_SCORECARD_SCOPE_TYPES = [
  'organization',
  'business_unit',
  'team',
  'process',
  'individual',
  'custom',
] as const;
export type KpiScorecardScopeType = (typeof KPI_SCORECARD_SCOPE_TYPES)[number];

export const KPI_SCORECARD_REVIEW_FREQUENCIES = [
  'weekly',
  'monthly',
  'quarterly',
  'annual',
  'custom',
] as const;
export type KpiScorecardReviewFrequency = (typeof KPI_SCORECARD_REVIEW_FREQUENCIES)[number];

// No 'pending_approval' — a Scorecard is a curation/membership object, not a
// governed contract requiring maker-checker (migration's own column comment).
export const KPI_SCORECARD_LIFECYCLE_STATUSES = ['draft', 'active', 'suspended', 'archived'] as const;
export type KpiScorecardLifecycleStatus = (typeof KPI_SCORECARD_LIFECYCLE_STATUSES)[number];

export const KPI_SCORECARD_ITEM_ROLES = ['primary', 'supporting'] as const;
export type KpiScorecardItemRole = (typeof KPI_SCORECARD_ITEM_ROLES)[number];

export const KPI_SCORECARD_SNAPSHOT_STATUSES = ['draft', 'published', 'superseded'] as const;
export type KpiScorecardSnapshotStatus = (typeof KPI_SCORECARD_SNAPSHOT_STATUSES)[number];

// ==========================================
// rvn_kpi_scorecards
// ==========================================

export interface KpiScorecardRow {
  scorecard_id: string;
  organization_id: string;
  name: string;
  description: string | null;
  scope_type: KpiScorecardScopeType;
  scope_id: string | null;
  owner_user_id: string;
  review_frequency: KpiScorecardReviewFrequency;
  lifecycle_status: KpiScorecardLifecycleStatus;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface KpiScorecard {
  scorecardId: string;
  organizationId: string;
  name: string;
  description: string | null;
  scopeType: KpiScorecardScopeType;
  scopeId: string | null;
  ownerUserId: string;
  reviewFrequency: KpiScorecardReviewFrequency;
  lifecycleStatus: KpiScorecardLifecycleStatus;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toKpiScorecard(row: KpiScorecardRow): KpiScorecard {
  return {
    scorecardId: row.scorecard_id,
    organizationId: row.organization_id,
    name: row.name,
    description: row.description,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    ownerUserId: row.owner_user_id,
    reviewFrequency: row.review_frequency,
    lifecycleStatus: row.lifecycle_status,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ==========================================
// rvn_kpi_scorecard_items — pure membership reference (AC #1/#2, migration
// header comment: "carries NO KPI-fact column"). No row_version of its own
// (decision #8) — the scorecard row is the CAS surface for every membership
// mutation.
// ==========================================

export interface KpiScorecardItemRow {
  item_id: string;
  scorecard_id: string;
  kpi_id: string;
  organization_id: string;
  role: KpiScorecardItemRole;
  sort_order: number;
  display_config: Record<string, unknown> | null;
  added_by: string;
  added_at: string;
}

export interface KpiScorecardItem {
  itemId: string;
  scorecardId: string;
  kpiId: string;
  organizationId: string;
  role: KpiScorecardItemRole;
  sortOrder: number;
  displayConfig: Record<string, unknown> | null;
  addedBy: string;
  addedAt: string;
}

export function toKpiScorecardItem(row: KpiScorecardItemRow): KpiScorecardItem {
  return {
    itemId: row.item_id,
    scorecardId: row.scorecard_id,
    kpiId: row.kpi_id,
    organizationId: row.organization_id,
    role: row.role,
    sortOrder: row.sort_order,
    displayConfig: row.display_config,
    addedBy: row.added_by,
    addedAt: row.added_at,
  };
}

// ==========================================
// rvn_kpi_scorecard_review_snapshots — immutable published view (AC #3).
// ==========================================

export interface ScorecardSnapshotItemFact {
  kpiId: string;
  definitionVersionId: string | null;
  itemRole: KpiScorecardItemRole;
  measurementId: string | null;
  actualValue: number | null;
  unit: string | null;
  performanceStatus: 'on_target' | 'warning' | 'critical' | 'neutral' | null;
  dataQualityStatus: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export interface ScorecardStatusCounts {
  safe: number;
  warning: number;
  critical: number;
  missing: number;
}

export interface ScorecardSnapshotPayload {
  items: ScorecardSnapshotItemFact[];
  statusCounts: ScorecardStatusCounts;
}

export interface KpiScorecardReviewSnapshotRow {
  snapshot_id: string;
  scorecard_id: string;
  organization_id: string;
  review_period_start: string;
  review_period_end: string;
  snapshot_payload: ScorecardSnapshotPayload | null;
  status: KpiScorecardSnapshotStatus;
  content_hash: string | null;
  published_by: string | null;
  published_at: string | null;
  superseded_by_snapshot_id: string | null;
  superseded_at: string | null;
  row_version: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface KpiScorecardReviewSnapshot {
  snapshotId: string;
  scorecardId: string;
  organizationId: string;
  reviewPeriodStart: string;
  reviewPeriodEnd: string;
  snapshotPayload: ScorecardSnapshotPayload | null;
  status: KpiScorecardSnapshotStatus;
  contentHash: string | null;
  publishedBy: string | null;
  publishedAt: string | null;
  supersededBySnapshotId: string | null;
  supersededAt: string | null;
  rowVersion: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function toKpiScorecardReviewSnapshot(row: KpiScorecardReviewSnapshotRow): KpiScorecardReviewSnapshot {
  return {
    snapshotId: row.snapshot_id,
    scorecardId: row.scorecard_id,
    organizationId: row.organization_id,
    reviewPeriodStart: row.review_period_start,
    reviewPeriodEnd: row.review_period_end,
    snapshotPayload: row.snapshot_payload,
    status: row.status,
    contentHash: row.content_hash,
    publishedBy: row.published_by,
    publishedAt: row.published_at,
    supersededBySnapshotId: row.superseded_by_snapshot_id,
    supersededAt: row.superseded_at,
    rowVersion: row.row_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Re-exported so callers reading NUMERIC columns off raw rows (e.g. a
 * future route layer) don't need a second import path — same convention
 * kpiDeviationTypes.ts follows for this helper. */
export { toNullableNumber };
