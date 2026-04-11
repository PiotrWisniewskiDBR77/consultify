/**
 * useTrustState — Shared hook for fetching authoritative trust-state from
 * `GET /api/artifacts/:id/trust-state` and merging into governance summary.
 *
 * P18 contract §2.3: trust-state is the single authoritative read model.
 * List-derived governance (from `mapArtifactGovernance` in useRapData) provides
 * the baseline; this hook enriches it with the full trust bundle on selection.
 */

import { useEffect, useState } from 'react';

import { API_URL, getHeaders } from '../../services/api';
import type { ArtifactGovernanceSummary } from './types';

function mergeTrustPayload(
  base: ArtifactGovernanceSummary | null | undefined,
  payload: Record<string, unknown>
): ArtifactGovernanceSummary {
  return {
    ...(base || {}),
    visibilityScope: payload.visibilityScope as ArtifactGovernanceSummary['visibilityScope'],
    publishState: (payload.publishState as string) || null,
    validationState:
      (payload.validationState as ArtifactGovernanceSummary['validationState']) || null,
    validationChecks: Array.isArray(payload.validationChecks) ? payload.validationChecks : [],
    publishReviewers: Array.isArray(payload.reviewers) ? payload.reviewers : [],
    reviewGateCount: typeof payload.reviewGateCount === 'number' ? payload.reviewGateCount : 0,
    projectId: (payload.projectId as string) || null,
    executionRunId: (payload.executionRunId as string) || null,
    executionState: (payload.executionState as string) || null,
    contextSnapshotId: (payload.contextSnapshotId as string) || null,
    canonicalHome: (payload.canonicalHome as string) || null,
    lastTransitionAt: (payload.lastTransitionAt as string) || null,
    sourceRefs: Array.isArray(payload.sourceRefs) ? payload.sourceRefs : [],
    originSummary:
      payload.originSummary && typeof payload.originSummary === 'object'
        ? (payload.originSummary as Record<string, unknown>)
        : null,
    openPath: (payload.openPath as string) || null,
    exportPath: (payload.exportPath as string) || null,
    authority: (payload.authority as string) || null,
    manageAccessPath: (payload.manageAccessPath as string) || null,
    canManageAccess: Boolean(payload.canManageAccess),
    exportHistory: Array.isArray(payload.exportHistory) ? payload.exportHistory : [],
    reviewAuthority: (payload.reviewAuthority as 'artifact_review') || 'artifact_review',
    executionAuthority: (payload.executionAuthority as 'execution_spine') || 'execution_spine',
    accessGrants: Array.isArray(payload.accessGrants) ? payload.accessGrants : [],
    originLinks: Array.isArray(payload.originLinks) ? payload.originLinks : [],
    lineagePaths:
      payload.lineagePaths && typeof payload.lineagePaths === 'object'
        ? (payload.lineagePaths as ArtifactGovernanceSummary['lineagePaths'])
        : null,
  };
}

export function useTrustState(
  artifactId: string | null | undefined,
  baseGovernance: ArtifactGovernanceSummary | null | undefined
): ArtifactGovernanceSummary | null {
  const [governance, setGovernance] = useState<ArtifactGovernanceSummary | null>(
    baseGovernance || null
  );

  useEffect(() => {
    let isMounted = true;
    setGovernance(baseGovernance || null);

    async function fetchTrustState() {
      if (!artifactId) {
        setGovernance(baseGovernance || null);
        return;
      }

      try {
        const res = await fetch(`${API_URL}/artifacts/${artifactId}/trust-state`, {
          headers: getHeaders(),
        });
        if (!res.ok) {
          if (isMounted) setGovernance(baseGovernance || null);
          return;
        }
        const data = await res.json();
        const payload = data?.data || data;
        if (!isMounted) return;
        setGovernance(mergeTrustPayload(baseGovernance, payload));
      } catch {
        if (isMounted) setGovernance(baseGovernance || null);
      }
    }

    void fetchTrustState();
    return () => {
      isMounted = false;
    };
  }, [artifactId, baseGovernance]);

  return governance;
}
