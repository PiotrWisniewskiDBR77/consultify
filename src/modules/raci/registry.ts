import type { SyncProvider, SyncTargetRecord } from './types';
import { buildSyncTargetLookup, parseLegacySyncTargets, validateSyncTargetSelection } from './syncTargets';

export interface SyncTargetRegistry {
  listByOrganization(organizationId: string): Promise<SyncTargetRecord[]>;
}

export interface ResolveSyncTargetsInput {
  organizationId: string;
  selectedTargetIds: string[];
  selectedProviders: SyncProvider[];
  legacySyncTargets?: string[];
}

export interface ResolveSyncTargetsResult {
  validTargetIds: string[];
  invalidTargetIds: string[];
  warnings: string[];
}

export async function resolveSyncTargets(
  registry: SyncTargetRegistry,
  input: ResolveSyncTargetsInput
): Promise<ResolveSyncTargetsResult> {
  const targets = await registry.listByOrganization(input.organizationId);
  const targetsById = buildSyncTargetLookup(targets);
  const warnings: string[] = [];

  const { validIds, invalidIds } = validateSyncTargetSelection(
    input.selectedTargetIds,
    targetsById,
    input.selectedProviders
  );

  const fallbackFromLegacy: string[] = [];
  if (input.legacySyncTargets?.length) {
    const parsed = parseLegacySyncTargets(input.legacySyncTargets);
    parsed.forEach((legacy) => {
      const hit = targets.find(
        (item) =>
          item.provider === legacy.provider &&
          item.workspaceId === legacy.workspaceId &&
          item.externalId === legacy.externalId
      );
      if (hit) fallbackFromLegacy.push(hit.id);
      else warnings.push(`Legacy sync target not found: ${legacy.provider}:${legacy.workspaceId}`);
    });
  }

  const mergedIds = Array.from(new Set([...validIds, ...fallbackFromLegacy]));
  return {
    validTargetIds: mergedIds,
    invalidTargetIds: invalidIds,
    warnings,
  };
}
