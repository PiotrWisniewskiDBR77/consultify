/**
 * ROI-E003 — `ApprovalSnapshot` read repository (§5).
 *
 * Design: docs/product/results-vnext/ROI_E003_DESIGN.md §5.
 *
 * `listRoiApprovalSnapshots`/`getRoiApprovalSnapshot` are visibility-scoped
 * via the standard `resource_type='roi_case'` join on `case_id::text`, same
 * `::text` cast discipline every join in `roiEconomicModelRepository.ts`
 * uses (ROI-E001 §5's lesson: `rvn_platform_resource_visibility.resource_id`
 * is TEXT, every domain PK here is UUID — no implicit cast).
 *
 * `getRoiApprovalSnapshot`'s read-time KPI-visibility redaction (D11's one
 * required layer) mirrors `kpiScorecardRepository.ts`'s `getPublishedSnapshot`
 * Decision #6b: re-derive the CURRENT reader's visible `kpi_id` set fresh on
 * every read (never trust anything baked into the frozen JSONB), expose
 * `kpiDetails` per evidence link — response-only, never persisted, never
 * affecting `content_hash`. Unlike the Scorecard case, ROI's evidence links
 * never carry KPI content in the frozen payload in the first place (ROI-E002
 * D14) — this file's redaction only controls whether the read-time
 * `kpiDetails` hydration is populated or `null`, it never filters OUT an
 * evidence link the way Scorecard's redaction filters out whole items.
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import {
  buildVisibilityScopedCte,
  wrapWithVisibilityScope,
  VISIBILITY_CTE_PARAM_COUNT,
} from '../platform/visibilityScopedQuery.js';

import { ROI_RESOURCE_TYPE } from './roiCaseCommands.js';
import {
  toRoiApprovalSnapshot,
  toRoiApprovalSnapshotSummary,
  type RoiApprovalSnapshotRow,
  type RoiApprovalSnapshotSummary,
} from './roiApprovalSnapshotTypes.js';
import type { RoiBenefitEvidenceLink } from './roiEconomicModelTypes.js';

async function withReadClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquirePgClient();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function queryRows<T extends QueryResultRow>(client: PoolClient, sql: string, values: unknown[]): Promise<T[]> {
  const result = await client.query<T>(sql, values);
  return result.rows;
}

// ==========================================
// listRoiApprovalSnapshots
// ==========================================

export interface ListRoiApprovalSnapshotsParams {
  userId: string;
  organizationId: string;
  caseId: string;
}

/**
 * Payload not included in the listing (matches `listReviewSnapshots`'s own
 * convention in the KPI Scorecard domain) — a caller wanting the full,
 * KPI-redacted detail follows up with `getRoiApprovalSnapshot`.
 */
export async function listRoiApprovalSnapshots(
  params: ListRoiApprovalSnapshotsParams
): Promise<RoiApprovalSnapshotSummary[]> {
  const { userId, organizationId, caseId } = params;
  const baseQuerySql = `
    SELECT s.*
      FROM rvn_roi_approval_snapshots s
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = s.case_id::text
     WHERE s.organization_id = $1
       AND s.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
     ORDER BY s.sequence_number DESC
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, {
    userId,
    organizationId,
    resourceType: ROI_RESOURCE_TYPE,
  });
  const values = [...wrapped.values, caseId];
  const rows = await withReadClient((client) => queryRows<RoiApprovalSnapshotRow>(client, wrapped.sql, values));
  return rows.map(toRoiApprovalSnapshotSummary);
}

// ==========================================
// getRoiApprovalSnapshot (D11's read-time redaction layer)
// ==========================================

export interface GetRoiApprovalSnapshotParams {
  userId: string;
  organizationId: string;
  caseId: string;
  snapshotId: string;
}

export interface RoiApprovalSnapshotBenefitEvidenceLinkDetail extends RoiBenefitEvidenceLink {
  kpiDetails: { kpiId: string; kpiCode: string; status: string } | null;
}

/**
 * Response-only shape: same `RoiApprovalSnapshot` the types file declares,
 * except `payload.benefitEvidenceLinks` is widened with a per-reader
 * `kpiDetails` field. Never persisted — `content_hash` on the returned
 * object is always the value stored at INSERT time, identical for every
 * reader regardless of what `kpiDetails` resolves to for them.
 */
export interface RoiApprovalSnapshotDetail {
  snapshotId: string;
  caseId: string;
  sequenceNumber: number;
  decisionCalculationRunId: string;
  approvedBy: string;
  approvedAt: string;
  contentHash: string;
  createdAt: string;
  payload: Omit<RoiApprovalSnapshotRow['snapshot_payload'], 'benefitEvidenceLinks'> & {
    benefitEvidenceLinks: RoiApprovalSnapshotBenefitEvidenceLinkDetail[];
  };
}

export async function getRoiApprovalSnapshot(
  params: GetRoiApprovalSnapshotParams
): Promise<RoiApprovalSnapshotDetail | null> {
  const { userId, organizationId, caseId, snapshotId } = params;

  // Step 1: visibility gate on the CASE (roi_case resource type), + the
  // exact snapshot_id. No row -> null, non-distinguishing between "doesn't
  // exist" and "can't see it" (design §5).
  const baseQuerySql = `
    SELECT s.*
      FROM rvn_roi_approval_snapshots s
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = s.case_id::text
     WHERE s.organization_id = $1
       AND s.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
       AND s.snapshot_id = $${VISIBILITY_CTE_PARAM_COUNT + 2}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, {
    userId,
    organizationId,
    resourceType: ROI_RESOURCE_TYPE,
  });
  const values = [...wrapped.values, caseId, snapshotId];
  const rows = await withReadClient((client) => queryRows<RoiApprovalSnapshotRow>(client, wrapped.sql, values));
  const row = rows[0];
  if (!row) return null;

  const snapshot = toRoiApprovalSnapshot(row);
  const links = snapshot.payload.benefitEvidenceLinks ?? [];

  if (links.length === 0) {
    return {
      snapshotId: snapshot.snapshotId,
      caseId: snapshot.caseId,
      sequenceNumber: snapshot.sequenceNumber,
      decisionCalculationRunId: snapshot.decisionCalculationRunId,
      approvedBy: snapshot.approvedBy,
      approvedAt: snapshot.approvedAt,
      contentHash: snapshot.contentHash,
      createdAt: snapshot.createdAt,
      payload: { ...snapshot.payload, benefitEvidenceLinks: [] },
    };
  }

  // Step 2: read-time redaction (D11's one required layer) — re-derive the
  // CURRENT reader's visible kpi_id set fresh on every read, never trust
  // anything baked into the frozen JSONB.
  const kpiCte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: 'kpi' });
  const kpiIds = links.map((l) => l.kpiId);
  const kpiQuerySql = `
    ${kpiCte.sql}
    SELECT kd.kpi_id, kd.kpi_code, kd.status
      FROM rvn_kpi_definitions kd
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = 'kpi' AND vr.resource_id = kd.kpi_id::text
     WHERE kd.organization_id = $1
       AND kd.kpi_id = ANY($${VISIBILITY_CTE_PARAM_COUNT + 1}::uuid[])
  `;
  const kpiValues = [...kpiCte.values, kpiIds];
  const kpiRows = await withReadClient((client) =>
    queryRows<{ kpi_id: string; kpi_code: string; status: string }>(client, kpiQuerySql, kpiValues)
  );
  const kpiDetailsById = new Map(kpiRows.map((k) => [k.kpi_id, { kpiId: k.kpi_id, kpiCode: k.kpi_code, status: k.status }]));

  const benefitEvidenceLinks: RoiApprovalSnapshotBenefitEvidenceLinkDetail[] = links.map((link) => ({
    ...link,
    kpiDetails: kpiDetailsById.get(link.kpiId) ?? null,
  }));

  return {
    snapshotId: snapshot.snapshotId,
    caseId: snapshot.caseId,
    sequenceNumber: snapshot.sequenceNumber,
    decisionCalculationRunId: snapshot.decisionCalculationRunId,
    approvedBy: snapshot.approvedBy,
    approvedAt: snapshot.approvedAt,
    contentHash: snapshot.contentHash,
    createdAt: snapshot.createdAt,
    payload: { ...snapshot.payload, benefitEvidenceLinks },
  };
}
