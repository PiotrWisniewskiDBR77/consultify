/**
 * ROI-E006 — `PostInvestmentReview` read repository.
 *
 * Design: docs/product/results-vnext/ROI_E006_DESIGN.md §5.
 *
 * `listRoiPostInvestmentReviews`/`getRoiPostInvestmentReview` — visibility
 * -gated via the standard `resource_type='roi_case'` join, mandatory
 * `::text` cast on `pir.case_id` (Decision D11: inherits visibility via
 * `case_id` only, no dedicated `resource_type` for this table). Payload
 * returned as stored — no read-time redaction needed (D8's payload has no
 * foreign visibility domain the way ApprovalSnapshot's KPI evidence links
 * do).
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import { wrapWithVisibilityScope, VISIBILITY_CTE_PARAM_COUNT } from '../platform/visibilityScopedQuery.js';

import { ROI_RESOURCE_TYPE } from './roiCaseCommands.js';
import {
  toRoiPostInvestmentReview,
  type RoiPostInvestmentReview,
  type RoiPostInvestmentReviewRow,
} from './roiPirTypes.js';

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

export interface ListRoiPostInvestmentReviewsParams {
  userId: string;
  organizationId: string;
  caseId: string;
}

export async function listRoiPostInvestmentReviews(
  params: ListRoiPostInvestmentReviewsParams
): Promise<RoiPostInvestmentReview[]> {
  const { userId, organizationId, caseId } = params;
  const baseQuerySql = `
    SELECT pir.*
      FROM rvn_roi_post_investment_reviews pir
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = pir.case_id::text
     WHERE pir.organization_id = $1
       AND pir.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
     ORDER BY pir.sequence_number DESC
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values = [...wrapped.values, caseId];
  const rows = await withReadClient((client) => queryRows<RoiPostInvestmentReviewRow>(client, wrapped.sql, values));
  return rows.map(toRoiPostInvestmentReview);
}

export interface GetRoiPostInvestmentReviewParams {
  userId: string;
  organizationId: string;
  caseId: string;
  pirId: string;
}

export async function getRoiPostInvestmentReview(
  params: GetRoiPostInvestmentReviewParams
): Promise<RoiPostInvestmentReview | null> {
  const { userId, organizationId, caseId, pirId } = params;
  const baseQuerySql = `
    SELECT pir.*
      FROM rvn_roi_post_investment_reviews pir
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = '${ROI_RESOURCE_TYPE}' AND vr.resource_id = pir.case_id::text
     WHERE pir.organization_id = $1
       AND pir.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
       AND pir.pir_id = $${VISIBILITY_CTE_PARAM_COUNT + 2}
  `;
  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: ROI_RESOURCE_TYPE });
  const values = [...wrapped.values, caseId, pirId];
  const rows = await withReadClient((client) => queryRows<RoiPostInvestmentReviewRow>(client, wrapped.sql, values));
  const row = rows[0];
  return row ? toRoiPostInvestmentReview(row) : null;
}
