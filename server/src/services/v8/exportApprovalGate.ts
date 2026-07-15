/**
 * M17 integrity fix (07-15 audit) — shared export-approval gate.
 *
 * Finding: `artifacts.routes.ts` has `assertArtifactExportable()` (403
 * EXPORT_NOT_APPROVED when the artifact's publish-record state is outside
 * approved/published) but it was only wired to the wave5 export-manifest /
 * exported routes. The MAIN export paths — `report-builder.routes.ts`
 * (pdf/docx/pptx/notion) and `presentations.routes.ts` (pptx/pdf/html/png) —
 * only run a quality-gate check (content completeness), never the publish
 * approval state, so an API caller can bypass an in-progress or rejected
 * review by hitting the main export endpoint instead of the wave5 one.
 *
 * Rollout: `v8_publish_records` rows are created ONLY when a caller
 * explicitly starts the wave5 review workflow
 * (`artifactRegistryService.startArtifactReview`) — not on report/deck
 * creation. On live data the overwhelming majority of reports/decks have
 * never entered that workflow, so `publishState` is NULL for them. Hard-
 * blocking every export with a NULL publish state would 403 nearly all
 * existing exports (a severe regression, not a security fix). This module
 * therefore:
 *   - NEVER blocks a NULL publish state (never entered review = nothing to
 *     bypass).
 *   - Flags a non-null, non-approved state (someone put the artifact under
 *     review and it is not yet approved/published — private_draft after
 *     review start, reviewable_share, changes_requested, etc.) as "gated".
 *   - Only actually 403s a gated artifact when `EXPORT_APPROVAL_ENFORCE=true`
 *     (default = shadow/log-only), matching the existing shadow/enforce
 *     rollout convention already used for `CAPABILITY_ENFORCE` /
 *     `RECONCILE_ENFORCE` elsewhere in this codebase. Flip the flag once
 *     M17's remediation owner confirms on live demo/prod data that the
 *     review workflow is adopted widely enough that enforcing it will not
 *     mass-break exports.
 */
import logger from '../../utils/Logger.js';

export const EXPORT_APPROVAL_EXPORTABLE_STATES = ['approved', 'published'] as const;

const LOG_PREFIX = '[ExportApprovalGate]';

export function isExportApprovalEnforced(): boolean {
  return (process.env.EXPORT_APPROVAL_ENFORCE ?? '').trim().toLowerCase() === 'true';
}

export interface ExportApprovalResult {
  /** Whether the export may proceed under the CURRENT mode (shadow vs enforce). */
  allowed: boolean;
  publishState: string | null;
  /**
   * True when the artifact has an active (non-null) publish record whose
   * state is not approved/published — i.e. it is under an in-progress or
   * rejected review, regardless of enforcement mode.
   */
  gated: boolean;
}

/**
 * Pure decision function — no I/O. `publishState` should come from the same
 * `ArtifactListItem.publishState` field `assertArtifactExportable` already
 * reads (`v8_publish_records.current_state`, LEFT JOIN'd — NULL when no
 * publish record exists for the artifact).
 */
export function evaluateExportApproval(
  publishState: string | null | undefined,
  enforced: boolean = isExportApprovalEnforced()
): ExportApprovalResult {
  const state = publishState ?? null;
  if (state === null) {
    // Never entered the review workflow — legacy/ungated. Not a bypass of
    // anything, since no approval process was ever started.
    return { allowed: true, publishState: null, gated: false };
  }
  const approved = (EXPORT_APPROVAL_EXPORTABLE_STATES as readonly string[]).includes(state);
  if (approved) {
    return { allowed: true, publishState: state, gated: false };
  }
  return { allowed: !enforced, publishState: state, gated: true };
}

export function logExportApprovalGate(params: {
  organizationId: string;
  userId: string;
  originRuntime: string;
  originRecordId: string;
  format: string;
  result: ExportApprovalResult;
  enforced: boolean;
}): void {
  if (!params.result.gated) return;
  logger.warn(`${LOG_PREFIX} export of un-approved artifact`, {
    organizationId: params.organizationId,
    userId: params.userId,
    originRuntime: params.originRuntime,
    originRecordId: params.originRecordId,
    format: params.format,
    publishState: params.result.publishState,
    mode: params.enforced ? 'enforce' : 'shadow',
    blocked: !params.result.allowed,
  });
}

/**
 * Applies the gate to an Express response. Returns true when the export
 * should proceed, false when it already sent a 403 response.
 */
export function applyExportApprovalGate(params: {
  res: import('express').Response;
  organizationId: string;
  userId: string;
  originRuntime: string;
  originRecordId: string;
  format: string;
  publishState: string | null | undefined;
}): boolean {
  const enforced = isExportApprovalEnforced();
  const result = evaluateExportApproval(params.publishState, enforced);
  logExportApprovalGate({
    organizationId: params.organizationId,
    userId: params.userId,
    originRuntime: params.originRuntime,
    originRecordId: params.originRecordId,
    format: params.format,
    result,
    enforced,
  });
  if (result.gated && !result.allowed) {
    params.res.status(403).json({
      success: false,
      error: 'Artifact must be approved before export',
      code: 'EXPORT_NOT_APPROVED',
      publishState: result.publishState,
    });
    return false;
  }
  if (result.gated) {
    // Shadow mode: don't block, but surface the warning so API clients /
    // ops dashboards can see the gate is active without breaking them yet.
    params.res.setHeader('X-Export-Approval-Warning', 'EXPORT_NOT_APPROVED');
  }
  return true;
}
