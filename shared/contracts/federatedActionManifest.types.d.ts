export type FederatedEffect =
  | 'READ'
  | 'PROPOSAL'
  | 'REVERSIBLE_MUTATION'
  | 'DESTRUCTIVE_MUTATION';

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
