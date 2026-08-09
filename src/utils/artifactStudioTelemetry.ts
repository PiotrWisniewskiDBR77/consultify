import { trackFunnelEvent } from '@/services/funnelAnalytics';

import {
  getArtifactStudioRolloutDecision,
  type ArtifactStudioFlagSource,
  type ArtifactStudioLane,
} from './artifactStudioFlags';

/**
 * PII-free rollout telemetry. It records only the lane, selected shell and
 * flag-resolution provenance. Artifact ids, titles, URLs and user content are
 * intentionally excluded.
 */
export function emitArtifactStudioShellSelected(
  lane: ArtifactStudioLane,
  source?: ArtifactStudioFlagSource
): boolean {
  try {
    const decision = getArtifactStudioRolloutDecision(lane, source);
    trackFunnelEvent('artifact_studio_shell_selected', {
      lane: decision.lane,
      shell: decision.enabled ? 'v2' : 'legacy',
      globalEnabled: decision.globalEnabled,
      laneEnabled: decision.laneEnabled,
      globalSource: decision.globalSource,
      laneSource: decision.laneSource,
    });
    return true;
  } catch {
    // Rollout telemetry is advisory and must never affect artifact opening.
    return false;
  }
}
