import type {
  FederatedActionEntry,
  FederatedManifestFinding,
} from './federatedActionManifest.types.js';

export type {
  FederatedActionEntry,
  FederatedEffect,
  FederatedManifestFinding,
  MvpDisposition,
} from './federatedActionManifest.types.js';

const REQUIRED_FOR_MUTATION: Array<keyof FederatedActionEntry> = [
  'mountedMutationId', 'idempotency', 'receipt', 'auditEvent', 'uiExecutor', 'teresaExecutor',
];

export function validateFederatedActionManifest(
  entries: readonly FederatedActionEntry[],
  mountedMutationIds: readonly string[]
): FederatedManifestFinding[] {
  const findings: FederatedManifestFinding[] = [];
  const seen = new Set<string>();
  const covered = new Set(entries.map((entry) => entry.mountedMutationId).filter(Boolean));
  for (const entry of entries) {
    if (seen.has(entry.actionId)) findings.push({ code: 'DUPLICATE_ACTION_ID', actionId: entry.actionId });
    seen.add(entry.actionId);
    if (entry.mvpDisposition === 'SUPPORTED' && entry.effect !== 'READ') {
      for (const field of REQUIRED_FOR_MUTATION) {
        if (!entry[field]) findings.push({ code: 'MISSING_FIELD', actionId: entry.actionId, field });
      }
      if (!entry.compensation.trim()) findings.push({ code: 'MISSING_FIELD', actionId: entry.actionId, field: 'compensation' });
    }
  }
  for (const mutationId of mountedMutationIds) {
    if (!covered.has(mutationId)) findings.push({ code: 'MISSING_MOUNTED_MUTATION', actionId: mutationId });
  }
  return findings;
}

export function buildFederatedActionManifest(
  adapters: ReadonlyArray<() => readonly FederatedActionEntry[]>,
  mountedMutationIds: readonly string[]
) {
  const entries = adapters.flatMap((adapter) => [...adapter()]);
  const findings = validateFederatedActionManifest(entries, mountedMutationIds);
  if (findings.length) {
    throw new Error(`FEDERATED_ACTION_MANIFEST_INVALID:${JSON.stringify(findings)}`);
  }
  return Object.freeze({ schemaVersion: 1 as const, entries: Object.freeze(entries) });
}
