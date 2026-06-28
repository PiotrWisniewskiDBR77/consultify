/**
 * Initiative candidate auto-scan cron (R5 — proactive inbox).
 *
 * Today the candidate inbox only fills on a manual `POST /candidates/scan`. This
 * cron makes it PROACTIVE: periodically it scans each org's recent discovery
 * artifacts (insights / assessments / audits) WITHOUT an initiative and proposes
 * candidates via the real LLM-backed proposer (`buildCandidateFromArtifactAI`,
 * fail-soft to the deterministic builder).
 *
 * SAFE BY DEFAULT: the Scheduler only invokes this when
 * `INITIATIVE_CANDIDATE_SCAN_CRON_ENABLED === 'true'` (behavioural + spends LLM
 * tokens → behind a flag, default OFF, safe for live clients).
 *
 * No discovery create-paths are touched (R5 gotcha): we never edit the
 * insight/assessment/audit services. `scanForCandidates` is idempotent per
 * (org, source_type, source_id), so re-runs only propose genuinely new artifacts.
 *
 * Org discovery is intentionally conservative: distinct orgs that already have
 * initiatives (active users of this area). Each org is independently fail-soft.
 */
import {
  buildCandidateFromArtifactAI,
  scanForCandidates,
} from '../services/initiative/initiativeCandidateService.js';
import Logger from '../utils/Logger.js';
import * as queryHelpers from '../utils/queryHelpers.js';

const LOG = '[cron:initiative-candidate-scan]';

export interface CandidateScanResult {
  orgs: number;
  created: number;
  errors: number;
}

/**
 * Scans all active orgs and proposes candidates from new discovery artifacts.
 * Never throws — aggregates per-org errors into the result.
 */
export async function runCandidateScan(): Promise<CandidateScanResult> {
  let orgs = 0;
  let created = 0;
  let errors = 0;

  try {
    const rows = await queryHelpers.queryAll<{ organization_id: string }>(
      `SELECT DISTINCT organization_id FROM initiatives WHERE organization_id IS NOT NULL`,
    );
    for (const r of rows || []) {
      const orgId = String(r?.organization_id || '');
      if (!orgId) continue;
      orgs++;
      try {
        const newOnes = await scanForCandidates(undefined, orgId, {
          propose: (artifact) => buildCandidateFromArtifactAI(artifact, { language: 'pl' }),
        });
        created += newOnes.length;
      } catch (e: any) {
        errors++;
        Logger.warn(`${LOG} org ${orgId} scan failed:`, e?.message || e);
      }
    }
  } catch (e: any) {
    errors++;
    Logger.warn(`${LOG} org enumeration failed:`, e?.message || e);
  }

  return { orgs, created, errors };
}

export default runCandidateScan;
