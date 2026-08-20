export type FederatedEffect = 'READ' | 'PROPOSAL' | 'REVERSIBLE_MUTATION' | 'DESTRUCTIVE_MUTATION';
export type MvpDisposition = 'SUPPORTED' | 'APPROVED_OUT' | 'NOT_SUPPORTED_IN_MVP';

export interface FederatedActionEntry {
  actionId: string;
  version: number;
  module: 'IDEA' | 'DYNAMIC_SWOT' | 'CHAT' | 'EXECUTION' | 'CASE_WORKSPACE';
  surface: string;
  mountedMutationId: string | null;
  effect: FederatedEffect;
  roles: string[];
  tenantScope: 'ORGANIZATION' | 'PROJECT_IN_ORGANIZATION';
  preview: 'REQUIRED' | 'NOT_REQUIRED';
  confirm: 'REQUIRED' | 'NOT_REQUIRED';
  idempotency: string | null;
  receipt: string | null;
  auditEvent: string | null;
  compensation: string;
  uiExecutor: string | null;
  teresaExecutor: string | null;
  mvpDisposition: MvpDisposition;
}

export interface FederatedManifestFinding {
  code: 'DUPLICATE_ACTION_ID' | 'MISSING_FIELD' | 'MISSING_MOUNTED_MUTATION';
  actionId: string;
  field?: keyof FederatedActionEntry;
}

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
