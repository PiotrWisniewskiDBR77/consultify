import type { NotificationChannel, SyncProvider, SyncTargetRecord } from './types';

const SYNC_TARGET_PATTERN =
  /^(?<provider>slack|teams|jira|webhook):(?<workspace>[^:\s]+):(?<external>[^:\s]+)(?::(?<extra>[^:\s]+))?$/i;

export function normalizeProvider(raw: string): SyncProvider | null {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'slack' || value === 'teams' || value === 'jira' || value === 'webhook') {
    return value;
  }
  return null;
}

export function parseLegacySyncTarget(value: string): {
  provider: SyncProvider;
  workspaceId: string;
  externalId: string;
  extra?: string;
} | null {
  const input = String(value || '').trim();
  if (!input) return null;
  const match = input.match(SYNC_TARGET_PATTERN);
  if (!match?.groups) return null;

  const provider = normalizeProvider(match.groups.provider);
  if (!provider) return null;

  return {
    provider,
    workspaceId: match.groups.workspace,
    externalId: match.groups.external,
    extra: match.groups.extra,
  };
}

export function parseLegacySyncTargets(values: string[]): Array<{
  provider: SyncProvider;
  workspaceId: string;
  externalId: string;
  extra?: string;
}> {
  return values
    .map((value) => parseLegacySyncTarget(value))
    .filter((item): item is NonNullable<typeof item> => !!item);
}

export function buildSyncTargetLookup(targets: SyncTargetRecord[]): Map<string, SyncTargetRecord> {
  const map = new Map<string, SyncTargetRecord>();
  targets.forEach((target) => map.set(target.id, target));
  return map;
}

export function validateSyncTargetSelection(
  syncTargetIds: string[],
  targetsById: Map<string, SyncTargetRecord>,
  allowedProviders: SyncProvider[]
): { validIds: string[]; invalidIds: string[] } {
  const validIds: string[] = [];
  const invalidIds: string[] = [];

  syncTargetIds.forEach((id) => {
    const target = targetsById.get(id);
    if (!target) {
      invalidIds.push(id);
      return;
    }
    if (!allowedProviders.includes(target.provider)) {
      invalidIds.push(id);
      return;
    }
    if (target.status !== 'connected') {
      invalidIds.push(id);
      return;
    }
    validIds.push(id);
  });

  return { validIds, invalidIds };
}

export function channelToProvider(channel: NotificationChannel): SyncProvider | null {
  if (channel === 'slack' || channel === 'teams' || channel === 'jira' || channel === 'webhook') {
    return channel;
  }
  return null;
}
