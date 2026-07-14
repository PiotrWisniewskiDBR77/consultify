/**
 * M14/F6 — execution report cadence + distribution cron handlers.
 *
 * Two background scans, each behind its own env flag (default OFF, safe for live
 * clients — behavioural change). Both iterate active orgs and delegate to the
 * already-tested services. Fail-safe per org (one org's error never aborts the run).
 *  - runReportCadenceScan: detects status reports due this period (findDueReports).
 *  - runReportDistributionScan: sends queued distributions (processReportDistributions).
 */
import distributionSvc from '../services/executionDistributionService.js';
import { findDueReports } from '../services/reportCadenceService.js';
import { all as dbAll } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export interface CadenceScanResult {
  orgs: number;
  due: number;
  errors: number;
}

/** Distinct orgs that have execution work worth scanning. */
async function activeOrgIds(): Promise<string[]> {
  try {
    const rows = (await dbAll(
      `SELECT DISTINCT organization_id FROM initiatives
       WHERE UPPER(COALESCE(status, '')) IN ('EXECUTING', 'BLOCKED')`,
      []
    )) as Array<Record<string, unknown>>;
    return rows
      .map((r) => (r.organization_id != null ? String(r.organization_id) : ''))
      .filter(Boolean);
  } catch (err: any) {
    logger.warn(`[ExecutionReportCron] activeOrgIds failed: ${err?.message || err}`);
    return [];
  }
}

export async function runReportCadenceScan(now: Date = new Date()): Promise<CadenceScanResult> {
  const orgs = await activeOrgIds();
  let due = 0;
  let errors = 0;
  for (const orgId of orgs) {
    try {
      const list = await findDueReports(orgId, now.getTime());
      due += Array.isArray(list) ? list.length : 0;
    } catch (err: any) {
      errors += 1;
      logger.warn(`[ExecutionReportCron] cadence org ${orgId}: ${err?.message || err}`);
    }
  }
  return { orgs: orgs.length, due, errors };
}

export interface DistributionScanResult {
  orgs: number;
  sent: number;
  failed: number;
  errors: number;
}

export async function runReportDistributionScan(): Promise<DistributionScanResult> {
  const orgs = await activeOrgIds();
  let sent = 0;
  let failed = 0;
  let errors = 0;
  for (const orgId of orgs) {
    try {
      const r: any = await distributionSvc.processReportDistributions(orgId);
      sent += Number(r?.sent) || 0;
      failed += Number(r?.failed) || 0;
    } catch (err: any) {
      errors += 1;
      logger.warn(`[ExecutionReportCron] distribution org ${orgId}: ${err?.message || err}`);
    }
  }
  return { orgs: orgs.length, sent, failed, errors };
}
